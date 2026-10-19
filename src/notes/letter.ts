/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import { isMap, parseDocument } from "yaml";
import { noteProperties, splitNote } from "./model";

export function letterWriting(source: string): string {
  const values = noteProperties(source);
  const { body } = splitNote(source);
  if (
    !values.salutation &&
    !Object.hasOwn(values, "closing") &&
    !values.from &&
    !values.to
  )
    throw new Error(
      "This letter already keeps its greeting and sign-off in the writing.",
    );
  const closing = values.closing ?? "Yours sincerely,";
  const signature =
    values.author ??
    values["sender-name"] ??
    values.from?.split(/\r?\n/)[0] ??
    "";
  const text = (value: string) => value.replace(/([\\`*_{}[\]<>#!|])/g, "\\$1");
  return `${values.salutation ? `${text(values.salutation)}\n\n` : ""}${body.trim()}\n\n${text(closing)}${signature ? `\n\n${text(signature)}` : ""}\n`;
}

export function convertLetterWriting(source: string, writing: string): string {
  if (new TextEncoder().encode(writing).length > 2 * 1024 * 1024)
    throw new Error("The letter writing is too large.");
  const { yaml } = splitNote(source);
  const doc = parseDocument(yaml);
  if (doc.errors.length) throw new Error("Check the letter's properties.");
  if (isMap(doc.contents)) doc.contents.flow = false;
  for (const key of ["salutation", "closing", "author"]) doc.delete(key);
  for (const [old, prefix] of [
    ["from", "sender"],
    ["to", "recipient"],
  ]) {
    const value = doc.get(old!);
    if (typeof value !== "string") {
      if (doc.has(old!))
        throw new Error(
          "Older sender/recipient properties must be plain text blocks before conversion.",
        );
      continue;
    }
    if (!doc.has(`${prefix}-name`) && !doc.has(`${prefix}-address`)) {
      const [name, ...address] = value.split(/\r?\n/);
      if (name) doc.set(`${prefix}-name`, name);
      if (address.length) doc.set(`${prefix}-address`, address.join("\n"));
    }
    doc.delete(old!);
  }
  doc.set(
    "document",
    doc.get("document") === "submission-letter"
      ? "submission-letter"
      : "letter",
  );
  const result = `---\n${doc.toString()}---\n\n${writing}`;
  splitNote(result);
  return result;
}
