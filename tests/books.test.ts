/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import assert from "node:assert/strict";
import { it } from "node:test";
import { strFromU8, unzipSync } from "fflate";
import { parseBookManifest } from "../src/books/manifest";
import { assembleBook } from "../src/books/assemble";
import { parseMarkdown } from "../src/core/markdown";
import { headingIndex } from "../src/core/headings";
import { EpubRenderer } from "../src/epub/renderer";
import { DocxRenderer } from "../src/docx/renderer";
import { createTypstSource } from "../src/pdf/typstSource";
import { bookManifest, bookNotes } from "./fixtures/book";
const sources = () =>
  new Map(
    Object.entries(bookNotes).map(([path, raw]) => [
      path,
      parseMarkdown(raw, path),
    ]),
  );
it("assembles explicit order, hierarchy and page breaks without mutating sources", () => {
  const input = sources();
  const before = JSON.stringify([...input]);
  const book = assembleBook(parseBookManifest(bookManifest), input);
  assert.equal(JSON.stringify([...input]), before);
  assert.equal(book.title, "A Neutral Journey");
  assert.equal(book.book!.entries.length, 6);
  assert.equal(book.blocks.filter((b) => b.type === "page-break").length, 4);
  const index = headingIndex(book);
  assert.equal(
    new Set(index.entries.map((h) => h.id)).size,
    index.entries.length,
  );
  assert.equal(
    index.entries.find((h) => h.id === "book-first-chapter")!.depth,
    2,
  );
  assert.equal(index.entries.find((h) => h.id === "book-scene-one")!.depth, 3);
  assert.equal(
    index.entries.find((h) => h.id === "entry-heading-first-chapter-heading-2")!
      .depth,
    3,
  );
  assert.equal(
    index.entries.filter((h) => h.label === "Chapter One").length,
    1,
  );
  assert.doesNotMatch(JSON.stringify(book), /explanatory manifest text/);
  const typst = createTypstSource(book, "plain-document", "a4");
  assert.equal((typst.match(/#pagebreak/g) ?? []).length, 4);
  assert.match(typst, /#page\(header: none/);
});
it("rejects unsafe, duplicate and oversized manifests", () => {
  for (const path of [
    "../outside.md",
    "/outside.md",
    "https://example.com/a.md",
    "Book\\a.md",
    "Book/%2e%2e/a.md",
    "Book//a.md",
  ])
    assert.throws(() =>
      parseBookManifest(bookManifest.replace("Book/Preface.md", path)),
    );
  assert.throws(() =>
    parseBookManifest(
      bookManifest.replace("Book/Afterword.md", "Book/Preface.md"),
    ),
  );
  assert.throws(() =>
    parseBookManifest(bookManifest.replace("id: afterword", "id: preface")),
  );
  assert.throws(() =>
    parseBookManifest(bookManifest.replace("role: scene", "role: unknown")),
  );
  assert.throws(() =>
    parseBookManifest(
      bookManifest.replace("title: A Neutral Journey", "title: ''"),
    ),
  );
  assert.throws(() => parseBookManifest(bookManifest + "x".repeat(128 * 1024)));
});
it("scopes repeated EPUB headings and resolves included-note links only", () => {
  const book = assembleBook(parseBookManifest(bookManifest), sources());
  const zip = unzipSync(
    new EpubRenderer().render(book, { language: "en-GB" }).bytes,
  );
  const content = Object.entries(zip)
    .filter(([path]) => path.endsWith(".xhtml"))
    .map(([, bytes]) => strFromU8(bytes))
    .join("\n");
  assert.match(content, /href="#entry-heading-last-chapter-heading-2"/);
  assert.match(content, /href="#entry-heading-first-chapter-heading-2"/);
  assert.match(content, /href="#book-first-chapter"/);
  assert.doesNotMatch(content, /href="Unlisted/);
});
it("a missing local heading cannot accidentally bind to a different chapter", () => {
  const input = sources();
  input.set("Book/Preface.md", parseMarkdown("[Wrong](#arrival)", "Preface"));
  const book = assembleBook(parseBookManifest(bookManifest), input);
  assert.throws(
    () => new EpubRenderer().render(book, { language: "en" }),
    /no destination/,
  );
});
it("entry IDs cannot collide with scoped heading IDs", () => {
  const manifest = parseBookManifest(
    bookManifest.replace("id: afterword", "id: first-chapter-heading-2"),
  );
  const entries = headingIndex(assembleBook(manifest, sources())).entries;
  assert.equal(new Set(entries.map((entry) => entry.id)).size, entries.length);
});
it("creates DOCX chapter breaks and one book title page", async () => {
  const book = assembleBook(parseBookManifest(bookManifest), sources());
  const output = await new DocxRenderer().render(
    book,
    "general-manuscript",
    "a4",
  );
  const xml = strFromU8(unzipSync(output.bytes)["word/document.xml"]!);
  assert.equal((xml.match(/w:type="page"/g) ?? []).length, 4);
  assert.match(xml, /w:pgNumType w:start="1"/);
});
