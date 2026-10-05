/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import { parseDocument, stringify } from "yaml";
import { bookPlanPath } from "../books/editor";
import type { TemplateUse } from "../templates/catalog";

export function cleanNoteHistory(value: unknown): TemplateUse[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value
    .slice(0, 500)
    .flatMap((row) => {
      if (
        !row ||
        typeof row.key !== "string" ||
        !/^[a-z][a-z0-9-]{0,63}$/.test(row.key) ||
        seen.has(row.key) ||
        !Number.isSafeInteger(row.uses) ||
        row.uses < 1 ||
        !Number.isSafeInteger(row.lastUsed) ||
        row.lastUsed < 0
      )
        return [];
      seen.add(row.key);
      return [
        {
          key: row.key,
          uses: Math.min(row.uses, 1_000_000),
          lastUsed: row.lastUsed,
        },
      ];
    })
    .slice(0, 50);
}
export function rememberNoteTemplate(
  value: unknown,
  key: string,
  now = Date.now(),
): TemplateUse[] {
  const rows = cleanNoteHistory(value),
    previous = rows.find((r) => r.key === key);
  return cleanNoteHistory([
    { key, uses: (previous?.uses ?? 0) + 1, lastUsed: now },
    ...rows.filter((r) => r.key !== key),
  ]);
}

export interface NoteField {
  key: string;
  label: string;
  multiline?: boolean;
}
export interface NoteTemplate {
  id: string;
  name: string;
  kind: string;
  body: string;
  defaults: Record<string, string>;
}
const common: NoteField[] = [
  { key: "title", label: "Title" },
  { key: "author", label: "Author" },
  { key: "language", label: "Language" },
];
export const LETTER_FIELDS: NoteField[] = [
  { key: "sender-name", label: "Sender name" },
  { key: "sender-address", label: "Sender address", multiline: true },
  { key: "recipient-name", label: "Recipient name" },
  { key: "recipient-address", label: "Recipient address", multiline: true },
  { key: "date", label: "Date" },
  { key: "subject", label: "Subject" },
  { key: "salutation", label: "Salutation" },
  { key: "closing", label: "Closing" },
];
export function noteFields(kind: string): NoteField[] {
  return [
    ...common,
    ...(kind.includes("letter")
      ? LETTER_FIELDS
      : kind === "manuscript"
        ? [
            { key: "surname", label: "Header surname" },
            { key: "short-title", label: "Short title" },
          ]
        : []),
  ];
}
export const NOTE_TEMPLATES: NoteTemplate[] = [
  {
    id: "letter",
    name: "Letter",
    kind: "letter",
    body: "Write your letter here.\n",
    defaults: { closing: "Yours sincerely,", salutation: "Dear …," },
  },
  {
    id: "submission-letter",
    name: "Submission letter",
    kind: "submission-letter",
    body: "Introduce your manuscript here.\n",
    defaults: { closing: "Yours sincerely,", salutation: "Dear Editor," },
  },
  {
    id: "manuscript",
    name: "Manuscript",
    kind: "manuscript",
    body: "# Chapter one\n\nStart writing here.\n",
    defaults: {},
  },
  {
    id: "book",
    name: "Book",
    kind: "book",
    body: "Use **Page Foundry: Edit document details** to add your existing chapter notes.\n",
    defaults: {},
  },
  {
    id: "plain",
    name: "Plain document",
    kind: "plain",
    body: "Start writing here.\n",
    defaults: {},
  },
];
export function splitNote(source: string): { yaml: string; body: string } {
  if (new TextEncoder().encode(source).length > 2 * 1024 * 1024)
    throw new Error("This note exceeds 2 MiB.");
  const match = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source);
  if (match && new TextEncoder().encode(match[1]!).length > 128 * 1024)
    throw new Error("The document properties exceed 128 KiB.");
  return match
    ? { yaml: match[1]!, body: source.slice(match[0].length) }
    : { yaml: "", body: source };
}
export function noteProperties(source: string): Record<string, string> {
  const { yaml } = splitNote(source);
  const doc = propertyDocument(yaml);
  const root: unknown = doc.toJS({ maxAliasCount: 20 });
  return Object.fromEntries(
    Object.entries(root ?? {})
      .filter(([, v]) => ["string", "number", "boolean"].includes(typeof v))
      .map(([k, v]) => [k, String(v)]),
  );
}
function propertyDocument(yaml: string) {
  const doc = parseDocument(yaml || "{}", { uniqueKeys: true });
  if (doc.errors.length)
    throw new Error("Check the note's YAML properties before editing details.");
  const root: unknown = doc.toJS({ maxAliasCount: 20 });
  if (!root || typeof root !== "object" || Array.isArray(root))
    throw new Error("Document properties must be a YAML mapping.");
  return doc;
}
export function updateNoteDetails(
  source: string,
  kind: string,
  values: Record<string, string>,
  convertLegacy = false,
): string {
  const { yaml, body } = splitNote(source);
  const doc = propertyDocument(yaml);
  for (const field of noteFields(kind)) {
    const value = values[field.key] ?? "";
    if (
      value.length > 2000 ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value)
    )
      throw new Error(
        `${field.label} must be at most 2000 characters and contain no control characters.`,
      );
    doc.set(field.key, value);
    if (field.multiline && value.includes("\n")) {
      const node = doc.get(field.key, true);
      if (node && typeof node === "object" && "type" in node)
        node.type = "BLOCK_LITERAL";
    }
  }
  doc.set("document", kind);
  if (convertLegacy && kind.includes("letter")) {
    doc.delete("from");
    doc.delete("to");
  }
  return `---\n${doc.toString()}---\n${body}`;
}
export function createNoteSource(
  template: NoteTemplate,
  values: Record<string, string>,
): string {
  const defaults = { ...template.defaults, ...values };
  const source = `---\n${stringify({ ...defaults, document: template.kind })}---\n\n${template.body}`;
  return updateNoteDetails(source, template.kind, defaults);
}
export function newNotePath(folder: string, name: string): string {
  if (!name.trim() || name.trim().includes("/"))
    throw new Error("Enter a filename, without folder separators.");
  return bookPlanPath(
    `${folder.trim() ? `${folder.trim()}/` : ""}${name.trim().endsWith(".md") ? name.trim() : `${name.trim()}.md`}`,
  );
}
