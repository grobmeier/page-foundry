/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import { parseDocument, stringify } from "yaml";
import { bookPlanPath } from "../books/editor";
import { isBookPlan } from "../books/manifest";
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
];
export function noteFields(kind: string): NoteField[] {
  return [
    ...(kind.includes("letter") ? common.slice(0, 1) : common),
    ...(kind.includes("letter")
      ? LETTER_FIELDS
      : kind === "book"
        ? [
            { key: "subtitle", label: "Subtitle (optional)" },
            { key: "imprint", label: "Imprint (optional)", multiline: true },
          ]
        : kind === "manuscript"
          ? [
              { key: "surname", label: "Header surname" },
              { key: "short-title", label: "Short title" },
            ]
          : []),
  ];
}
export function advancedNoteFields(
  kind: string,
  _values: Record<string, string>,
): NoteField[] {
  if (!kind.includes("letter")) return [];
  return [common[2]!];
}
export const DOCUMENT_TYPES = [
  { id: "plain", name: "Plain document" },
  { id: "letter", name: "Letter" },
  { id: "submission-letter", name: "Submission letter" },
  { id: "manuscript", name: "Manuscript" },
] as const;
/** Unknown/invalid explicit types require an author's choice, not inference. */
export function documentKind(source: string): string {
  const doc = propertyDocument(splitNote(source).yaml);
  if (doc.has("document")) {
    const value = doc.get("document");
    return typeof value === "string" ? value : "";
  }
  return ["from", "to", "subject", "sender-name", "recipient-name"].some(
    (key) => Boolean(doc.get(key)),
  )
    ? "letter"
    : "plain";
}
export function documentTypeLabel(kind: string): string {
  return (
    DOCUMENT_TYPES.find((type) => type.id === kind)?.name ?? "Unrecognised type"
  );
}
/** Individual-note editing never converts book plans or inserts starter writing. */
export function updateDocumentDetails(
  source: string,
  kind: string,
  values: Record<string, string>,
): string {
  if (isBookPlan(source))
    throw new Error("Edit this book's reading order instead.");
  if (!DOCUMENT_TYPES.some((type) => type.id === kind))
    throw new Error("Choose a document type before saving.");
  const fields = new Map(
    DOCUMENT_TYPES.flatMap((type) =>
      [...noteFields(type.id), ...advancedNoteFields(type.id, values)].map(
        (field) => [field.key, field] as const,
      ),
    ),
  );
  return writeNoteDetails(source, kind, values, [...fields.values()]);
}
export const NOTE_TEMPLATES: NoteTemplate[] = [
  {
    id: "letter",
    name: "Letter",
    kind: "letter",
    body: "Dear …,\n\nWrite your letter here.\n\nYours sincerely,\n\n{{sender-name}}\n",
    defaults: {},
  },
  {
    id: "submission-letter",
    name: "Submission letter",
    kind: "submission-letter",
    body: "Dear Editor,\n\nIntroduce your manuscript here.\n\nYours sincerely,\n\n{{sender-name}}\n",
    defaults: {},
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
  return writeNoteDetails(
    source,
    kind,
    values,
    [...noteFields(kind), ...advancedNoteFields(kind, values)],
    convertLegacy,
  );
}
function writeNoteDetails(
  source: string,
  kind: string,
  values: Record<string, string>,
  fields: NoteField[],
  convertLegacy = false,
): string {
  const { yaml, body } = splitNote(source);
  const doc = propertyDocument(yaml);
  const legacyGreeting =
    kind.includes("letter") &&
    ["salutation", "closing", "from", "to"].some((key) => doc.has(key));
  const oldSender = doc.get("from");
  for (const field of fields) {
    if (!Object.hasOwn(values, field.key)) continue;
    const value = values[field.key] ?? "";
    if (
      value.length > 2000 ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value)
    )
      throw new Error(
        `${field.label} must be at most 2000 characters and contain no control characters.`,
      );
    if (!value.trim()) {
      if (
        legacyGreeting &&
        ["salutation", "closing", "author"].includes(field.key)
      )
        doc.set(field.key, value);
      else doc.delete(field.key);
      continue;
    }
    doc.set(field.key, value);
    if (field.multiline && value.includes("\n")) {
      const node = doc.get(field.key, true);
      if (node && typeof node === "object" && "type" in node)
        node.type = "BLOCK_LITERAL";
    }
  }
  doc.set("document", kind);
  if (convertLegacy && kind.includes("letter")) {
    if (legacyGreeting && !doc.has("closing"))
      doc.set("closing", "Yours sincerely,");
    if (typeof oldSender === "string" && !doc.has("author"))
      doc.set("author", oldSender);
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
/** Suggest a portable filename without changing the author's title. */
export function suggestedNoteFilename(title: string, kind: string): string {
  let stem = title
    .replace(/[\\/:*?"<>|%#\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.md$/i, "")
    .replace(/\.book$/i, "")
    .replace(/^[. ]+|[. ]+$/g, "")
    .slice(0, 100)
    .trim();
  if (!stem) stem = kind === "book" ? "My Book" : "Untitled";
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(stem))
    stem = `_${stem}`;
  return `${stem}${kind === "book" ? ".book" : ""}.md`;
}

export function newNotePath(folder: string, name: string): string {
  if (!name.trim() || name.trim().includes("/"))
    throw new Error("Enter a filename, without folder separators.");
  return bookPlanPath(
    `${folder.trim() ? `${folder.trim()}/` : ""}${name.trim().endsWith(".md") ? name.trim() : `${name.trim()}.md`}`,
  );
}
