/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import { parse } from "yaml";

export interface BookEntry {
  id: string;
  role: "front-matter" | "part" | "chapter" | "scene" | "back-matter";
  path?: string;
  title?: string;
}
export interface BookManifest {
  metadata: Record<string, string>;
  entries: BookEntry[];
}
export const MAX_BOOK_BYTES = 20 * 1024 * 1024;
export function isBookPlan(markdown: string, basename = ""): boolean {
  if (basename.endsWith(".book")) return true;
  const match = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(markdown);
  if (!match || match[1]!.length > 128 * 1024) return false;
  try {
    const root = parse(match[1]!, { maxAliasCount: 20, uniqueKeys: true });
    return Boolean(
      root &&
        typeof root === "object" &&
        Object.hasOwn(root, "page-foundry-book"),
    );
  } catch {
    return /page-foundry-book\s*["']?\s*:/.test(match[1]!);
  }
}
export function parseBookManifest(markdown: string): BookManifest {
  if (new TextEncoder().encode(markdown).length > 128 * 1024)
    throw new Error("The book manifest exceeds 128 KiB.");
  const match = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(markdown);
  if (!match) throw new Error("A book needs a leading YAML manifest.");
  const root = parse(match[1]!, { maxAliasCount: 20, uniqueKeys: true });
  if (
    !root ||
    typeof root !== "object" ||
    Array.isArray(root) ||
    root["page-foundry-book"] !== 1
  )
    throw new Error("Use page-foundry-book: 1 in the manifest.");
  const fields = [
    "title",
    "author",
    "language",
    "identifier",
    "surname",
    "short-title",
  ];
  for (const key of Object.keys(root))
    if (![...fields, "page-foundry-book", "entries"].includes(key))
      throw new Error(`Unknown book field: ${key}.`);
  const metadata: Record<string, string> = {};
  for (const field of fields) {
    if (root[field] === undefined) continue;
    if (
      typeof root[field] !== "string" ||
      !root[field].trim() ||
      root[field].length > 2000
    )
      throw new Error(
        `Book ${field} must be non-empty text, at most 2000 characters.`,
      );
    metadata[field] = root[field].trim();
  }
  if (!metadata.title) throw new Error("The book needs a title.");
  if (
    !Array.isArray(root.entries) ||
    !root.entries.length ||
    root.entries.length > 50
  )
    throw new Error("List between 1 and 50 book entries.");
  const ids = new Set<string>();
  const paths = new Set<string>();
  const entries: BookEntry[] = root.entries.map((entry: unknown) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry))
      throw new Error("Each book entry must be a mapping.");
    const value = entry as Record<string, unknown>;
    if (
      Object.keys(value).some(
        (key) => !["id", "role", "path", "title"].includes(key),
      )
    )
      throw new Error("Unknown book entry field.");
    const { id, role, path, title } = value;
    if (
      typeof id !== "string" ||
      !/^[a-z][a-z0-9-]{0,63}$/.test(id) ||
      ids.has(id) ||
      ["constructor", "prototype"].includes(id)
    )
      throw new Error("Entry IDs must be unique lowercase hyphenated names.");
    ids.add(id);
    if (
      !["front-matter", "part", "chapter", "scene", "back-matter"].includes(
        String(role),
      )
    )
      throw new Error(`Invalid role for ${id}.`);
    if (
      title !== undefined &&
      (typeof title !== "string" || !title.trim() || title.length > 2000)
    )
      throw new Error(`Invalid title for ${id}.`);
    if (path !== undefined) {
      if (
        typeof path !== "string" ||
        path.length > 1000 ||
        !path.endsWith(".md") ||
        /[\\:%?#\u0000-\u001f]/.test(path) ||
        path
          .split("/")
          .some((part) => !part || part === "." || part === "..") ||
        paths.has(path)
      )
        throw new Error(
          `Use a unique, exact vault-relative Markdown path for ${id}.`,
        );
      paths.add(path);
    } else if (role !== "part" || !title)
      throw new Error(`Entry ${id} needs a note path.`);
    return { id, role, path, title } as BookEntry;
  });
  return { metadata, entries };
}
