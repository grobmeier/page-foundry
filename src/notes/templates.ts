/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import { parseDocument } from "yaml";
import { splitNote, noteProperties, type NoteTemplate } from "./model";
import { bookPlanPath } from "../books/editor";
export const TEMPLATE_MAX_BYTES = 128 * 1024;
export function configuredTemplates(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 30)
    throw new Error("Register at most 30 exact note-template paths.");
  const paths = value.map((path) => {
    if (typeof path !== "string")
      throw new Error("Choose exact Markdown template paths.");
    return bookPlanPath(path);
  });
  if (new Set(paths).size !== paths.length)
    throw new Error("A note template is registered twice.");
  return paths;
}
const keys = ["title", "author", "language", "date", "sender-name"];
function replaceTokens(
  value: string,
  fields: Record<string, string>,
  body: boolean,
): string {
  return value.replace(/\{\{([^{}]+)\}\}/g, (_match, key: string) => {
    if (!keys.includes(key.trim()))
      throw new Error(
        `Unsupported template placeholder: ${key}. Use title, author, language, date or sender-name.`,
      );
    const text = fields[key.trim()] ?? "";
    return body ? text.replace(/([\\`*_{}[\]<>#!|])/g, "\\$1") : text;
  });
}
export function parseNoteTemplate(
  source: string,
  id: string,
  name: string,
): NoteTemplate {
  if (new TextEncoder().encode(source).length > TEMPLATE_MAX_BYTES)
    throw new Error("A note template must be at most 128 KiB.");
  const { yaml, body } = splitNote(source);
  const root: unknown = parseDocument(yaml || "{}").toJS({ maxAliasCount: 20 });
  if (
    Object.values(root ?? {}).some(
      (value) => !["string", "number", "boolean"].includes(typeof value),
    )
  )
    throw new Error(
      "Note templates use plain scalar properties, not nested objects or lists.",
    );
  const defaults = noteProperties(source);
  const kind = defaults.document ?? "plain";
  if (
    !["plain", "letter", "submission-letter", "manuscript", "book"].includes(
      kind,
    )
  )
    throw new Error("Choose a supported document type in the note template.");
  replaceTokens(source, {}, false); // Validate placeholder names before showing the picker.
  delete defaults.document;
  return { id, name, kind, defaults, body };
}
export function expandNoteTemplate(
  template: NoteTemplate,
  fields: Record<string, string>,
): NoteTemplate {
  return {
    ...template,
    body: replaceTokens(template.body, fields, true),
    defaults: Object.fromEntries(
      Object.entries(template.defaults).map(([k, v]) => [
        k,
        replaceTokens(v, fields, false),
      ]),
    ),
  };
}
export function privateTemplateSource(
  source: string,
  clearPersonal: boolean,
): string {
  const { yaml, body } = splitNote(source);
  const doc = parseDocument(yaml || "{}");
  if (doc.errors.length)
    throw new Error("Check the note's properties before saving a template.");
  if (clearPersonal) {
    for (const key of [
      "author",
      "from",
      "to",
      "sender-name",
      "sender-address",
      "recipient-name",
      "recipient-address",
      "date",
      "subject",
      "identifier",
      "salutation",
      "surname",
    ])
      if (doc.has(key)) doc.set(key, "");
  }
  const template = `---\n${doc.toString()}---\n${body}`;
  parseNoteTemplate(template, "preview", "Preview");
  return template;
}
