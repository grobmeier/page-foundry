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
        (Object.hasOwn(root, "page-foundry-book") || root.document === "book"),
    );
  } catch {
    return /page-foundry-book\s*["']?\s*:/.test(match[1]!);
  }
}
export function parseBookManifest(
  markdown: string,
  allowEmpty = false,
): BookManifest {
  if (new TextEncoder().encode(markdown).length > 128 * 1024)
    throw new Error("The book manifest exceeds 128 KiB.");
  const match = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(markdown);
  if (!match) throw new Error("A book needs a leading YAML manifest.");
  const root = parse(match[1]!, { maxAliasCount: 20, uniqueKeys: true });
  if (
    !root ||
    typeof root !== "object" ||
    Array.isArray(root) ||
    (root["page-foundry-book"] !== 1 && root.document !== "book")
  )
    throw new Error("Use page-foundry-book: 1 in the manifest.");
  const fields = [
    "title",
    "author",
    "language",
    "identifier",
    "surname",
    "short-title",
    "subtitle",
    "imprint",
  ];
  for (const key of Object.keys(root))
    if (
      root.document !== "book" &&
      ![...fields, "page-foundry-book", "entries"].includes(key)
    )
      throw new Error(`Unknown book field: ${key}.`);
  const metadata: Record<string, string> = {};
  for (const field of fields) {
    if (root[field] === undefined) continue;
    if (
      typeof root[field] !== "string" ||
      (!root[field].trim() && field === "title") ||
      root[field].length > 2000 ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(root[field])
    )
      throw new Error(
        `Book ${field} must be non-empty text, at most 2000 characters.`,
      );
    if (root[field].trim()) metadata[field] = root[field].trim();
  }
  if (!metadata.title) throw new Error("The book needs a title.");
  if (root.document === "book")
    root.entries = parseOutline(markdown.slice(match[0].length));
  if (
    !Array.isArray(root.entries) ||
    (!root.entries.length && !allowEmpty) ||
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

export const ORDER_START = "%% page-foundry:book-order:start %%";
export const ORDER_END = "%% page-foundry:book-order:end %%";
function stableId(path: string): string {
  let hash = 2166136261;
  for (const char of path) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `note-${(hash >>> 0).toString(16)}`;
}
function parseOutline(body: string): BookEntry[] {
  const starts = body.split(ORDER_START),
    ends = body.split(ORDER_END);
  if (
    starts.length > 2 ||
    ends.length > 2 ||
    starts.length !== ends.length ||
    (starts.length === 2 && body.indexOf(ORDER_END) < body.indexOf(ORDER_START))
  )
    throw new Error(
      "The book-order boundary comments are incomplete or repeated.",
    );
  if (starts.length === 2) body = starts[1]!.split(ORDER_END)[0]!;
  const entries: BookEntry[] = [];
  let section:
    | { role: BookEntry["role"]; title?: string; count: number }
    | undefined;
  let fence: string | undefined;
  const finish = () => {
    if (section && section.count === 0)
      throw new Error(
        `Add a note link beneath ${section.title ?? section.role}, or remove that empty heading.`,
      );
  };
  for (const line of body.split(/\r?\n/)) {
    const code = /^\s*(`{3,}|~{3,})/.exec(line);
    if (code) {
      if (!fence) fence = code[1]![0];
      else if (fence === code[1]![0]) fence = undefined;
      continue;
    }
    if (fence) continue;
    const heading =
      /^## (Opening pages|Part|Chapter|Scene|Closing pages)(?:\s*:\s*(.*))?\s*$/.exec(
        line,
      );
    if (heading) {
      finish();
      const role = (
        {
          "Opening pages": "front-matter",
          Part: "part",
          Chapter: "chapter",
          Scene: "scene",
          "Closing pages": "back-matter",
        } as const
      )[heading[1] as "Part"];
      const title = heading[2]?.trim();
      section = { role, title, count: 0 };
      if (role === "part") {
        if (!title) throw new Error("Give each Part heading a title.");
        entries.push({ id: stableId(`part:${title}`), role, title });
        section.count = 1;
      }
      continue;
    }
    if (/^#{1,6}\s/.test(line)) {
      finish();
      section = undefined;
      continue;
    }
    const partId = /^%% foundry-section: ([a-z][a-z0-9-]{0,63}) %%$/.exec(line);
    if (partId && section?.role === "part") {
      entries.at(-1)!.id = partId[1]!;
      continue;
    }
    if (!section) continue;
    const link =
      /^\s*- \[\[([^\]|]+)(?:\|([^\]]+))?\]\](?:\s+%% foundry-section: ([a-z][a-z0-9-]{0,63}) %%)?\s*$/.exec(
        line,
      );
    if (link) {
      if (
        (section.role === "chapter" || section.role === "scene") &&
        section.count
      )
        throw new Error(
          "Each Chapter or Scene heading must have exactly one note link.",
        );
      const path = link[1]!.trim();
      const role = section.role === "part" ? "chapter" : section.role;
      entries.push({
        id: link[3] ?? stableId(path),
        role,
        path,
        title:
          link[2]?.trim() ||
          (section.role === "part" ? undefined : section.title),
      });
      section.count++;
    } else if (/^\s*-\s/.test(line) || /foundry-section:/.test(line))
      throw new Error(
        "Use a direct note link such as - [[Book/Chapter.md|Chapter title]] in the book order.",
      );
  }
  finish();
  return entries;
}
