/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import { isMap, parseDocument, stringify } from "yaml";
import {
  parseBookManifest,
  type BookEntry,
  type BookManifest,
  ORDER_START,
  ORDER_END,
} from "./manifest";

export function editableBook(source?: string): BookManifest {
  const book = source
    ? parseBookManifest(source, true)
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
  convert = false,
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
  let source: string;
  const legacy =
    original !== undefined &&
    /^\uFEFF?---\r?\n[\s\S]*?page-foundry-book\s*:/.test(original) &&
    !/^document: book$/m.test(original);
  if (legacy && !convert)
    source = `---\n${stringify({ "page-foundry-book": 1, ...metadata, entries })}---\n${body}`;
  else {
    const yaml = original?.match(
      /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/,
    )?.[1];
    const doc = parseDocument(yaml || "{}");
    if (isMap(doc.contents)) doc.contents.flow = false;
    doc.delete("entries");
    doc.delete("page-foundry-book");
    doc.set("document", "book");
    for (const key of [
      "title",
      "author",
      "language",
      "identifier",
      "surname",
      "short-title",
      "subtitle",
      "imprint",
    ]) {
      if (metadata[key]) {
        doc.set(key, metadata[key]);
        if (key === "imprint" && metadata[key].includes("\n")) {
          const node = doc.get(key, true);
          if (node && typeof node === "object" && "type" in node)
            node.type = "BLOCK_LITERAL";
        }
      } else doc.delete(key);
    }
    const labels = {
      "front-matter": "Opening pages",
      part: "Part",
      chapter: "Chapter",
      scene: "Scene",
      "back-matter": "Closing pages",
    };
    const outline = entries
      .map((entry) => {
        if (
          [entry.path, entry.title].some(
            (v) => v !== undefined && /[\r\n\[\]|]/.test(v),
          )
        )
          throw new Error(
            "Section titles and paths cannot contain newlines, brackets or a vertical bar.",
          );
        const heading = `## ${labels[entry.role]}${entry.title ? `: ${entry.title}` : ""}`;
        return entry.path
          ? `${heading}\n- [[${entry.path}${entry.title ? `|${entry.title}` : ""}]] %% foundry-section: ${entry.id} %%`
          : `${heading}\n%% foundry-section: ${entry.id} %%`;
      })
      .join("\n\n");
    const region = `${ORDER_START}\n\n${outline}\n\n${ORDER_END}`;
    let prose = original
      ? body
      : "\nUse **Page Foundry: Edit document details** to edit the order and **Publish** when ready.\n";
    if (original && !legacy && !prose.includes(ORDER_START)) {
      let inOrder = false,
        fence: string | undefined;
      prose = prose
        .split(/\r?\n/)
        .filter((line) => {
          const code = /^\s*(`{3,}|~{3,})/.exec(line);
          if (code) {
            if (!fence) fence = code[1]![0];
            else if (fence === code[1]![0]) fence = undefined;
            return true;
          }
          if (fence) return true;
          if (
            /^## (Opening pages|Part|Chapter|Scene|Closing pages)(?:\s*:.*)?\s*$/.test(
              line,
            )
          ) {
            inOrder = true;
            return false;
          }
          if (/^#{1,6}\s/.test(line)) inOrder = false;
          return !(
            inOrder &&
            (/^\s*- \[\[/.test(line) || /^%% foundry-section:/.test(line))
          );
        })
        .join("\n");
    }
    const updated = prose.includes(ORDER_START)
      ? prose.replace(
          new RegExp(
            `${ORDER_START.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?${ORDER_END.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
          ),
          region,
        )
      : `${prose}\n${region}\n`;
    source = `---\n${doc.toString()}---\n${updated}`;
  }
  try {
    parseBookManifest(source);
  } catch (error) {
    let message =
      error instanceof Error ? error.message : "Check the book information.";
    message = message.replace(
      "List between 1 and 50 book entries.",
      "Add between 1 and 50 sections.",
    );
    for (const [index, entry] of entries.entries())
      message = message.replaceAll(entry.id, `section ${index + 1}`);
    throw new Error(message);
  }
  return source;
}
