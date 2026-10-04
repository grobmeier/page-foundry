/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import { stringify } from "yaml";
import {
  parseBookManifest,
  type BookEntry,
  type BookManifest,
} from "./manifest";

export function editableBook(source?: string): BookManifest {
  const book = source
    ? parseBookManifest(source)
    : { metadata: { title: "My Book", language: "en" }, entries: [] };
  return {
    metadata: { ...book.metadata },
    entries: book.entries.map((entry) => ({ ...entry })),
  };
}
export function newBookEntry(
  role: BookEntry["role"] = "chapter",
  id: string = crypto.randomUUID(),
): BookEntry {
  return { id: `section-${id}`, role };
}
export function moveBookEntry(
  book: BookManifest,
  index: number,
  offset: -1 | 1,
): void {
  const target = index + offset;
  if (
    index < 0 ||
    index >= book.entries.length ||
    target < 0 ||
    target >= book.entries.length
  )
    return;
  [book.entries[index], book.entries[target]] = [
    book.entries[target]!,
    book.entries[index]!,
  ];
}
export function bookPlanPath(value: string): string {
  const path = value.trim();
  if (
    !path ||
    path.length > 1000 ||
    !path.endsWith(".md") ||
    /[\\:%?#\u0000-\u001f]/.test(path) ||
    path.split("/").some((part) => !part || part === "." || part === "..")
  )
    throw new Error(
      "Choose a Markdown file inside this vault, using an existing folder. Example: My Book.book.md.",
    );
  return path;
}
export function serializeBookPlan(
  book: BookManifest,
  original?: string,
): string {
  const metadata = Object.fromEntries(
    Object.entries(book.metadata)
      .map(([key, value]) => [key, value.trim()])
      .filter(([, value]) => value),
  );
  const entries = book.entries.map((entry) => ({
    id: entry.id,
    role: entry.role,
    ...(entry.path?.trim() ? { path: entry.path.trim() } : {}),
    ...(entry.title?.trim() ? { title: entry.title.trim() } : {}),
  }));
  const body = original
    ? original.replace(/^\uFEFF?---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, "")
    : "\nUse **Page Foundry: Set up book** to edit the book order and **Create** to publish it.\n";
  const source = `---\n${stringify({ "page-foundry-book": 1, ...metadata, entries })}---\n${body}`;
  try {
    parseBookManifest(source);
  } catch (error) {
    let message =
      error instanceof Error ? error.message : "Check the book information.";
    for (const [index, entry] of entries.entries())
      message = message.replaceAll(entry.id, `section ${index + 1}`);
    throw new Error(message);
  }
  return source;
}
