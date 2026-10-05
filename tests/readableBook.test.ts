/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import assert from "node:assert/strict";
import { it } from "node:test";
import { isBookPlan, parseBookManifest } from "../src/books/manifest";
import {
  editableBook,
  moveBookEntry,
  serializeBookPlan,
} from "../src/books/editor";
import { bookManifest, bookNotes } from "./fixtures/book";
import { assembleBook } from "../src/books/assemble";
import { parseMarkdown } from "../src/core/markdown";
import { EpubRenderer } from "../src/epub/renderer";
import { strFromU8, unzipSync } from "fflate";
import { bookControlComments } from "../src/books/controlComments";
const manual = `---\ndocument: book\ntitle: A Neutral Book\nauthor: Alex Example\ncustom: kept\n---\nNotes for the author.\n\n## Opening pages\n- [[Book/Preface.md|Preface]]\n\n## Part: First steps\n\n## Chapter: Arrival\n- [[Book/One.md|Arrival]]\n\n## Closing pages\n- [[Book/Afterword.md|Afterword]]\n`;
it("hides only internal book control comments outside fenced examples", () => {
  const source = serializeBookPlan(editableBook(manual), manual);
  const ranges = bookControlComments(source);
  assert.equal(ranges.length, 6);
  assert.ok(ranges.every((r) => source.slice(r.from, r.to).startsWith("%% ")));
  const shown =
    source +
    "\n%% ordinary author comment %%\n```\n%% foundry-section: example %%\n```\n";
  assert.equal(bookControlComments(shown).length, ranges.length);
  assert.equal(
    bookControlComments(
      "---\ndocument: plain\n---\n%% foundry-section: not-a-book %%",
    ).length,
    0,
  );
});
it("reads an ordinary Markdown outline with flat properties and exact ordered links", () => {
  assert.equal(isBookPlan(manual, "Ordinary name"), true);
  const book = parseBookManifest(manual);
  assert.deepEqual(
    book.entries.map((e) => e.role),
    ["front-matter", "part", "chapter", "back-matter"],
  );
  assert.deepEqual(
    book.entries.map((e) => e.path),
    ["Book/Preface.md", undefined, "Book/One.md", "Book/Afterword.md"],
  );
  assert.equal(
    editableBook("---\ndocument: book\ntitle: Empty draft\n---\nStart here.")
      .entries.length,
    0,
  );
  assert.throws(
    () =>
      parseBookManifest(
        "---\ndocument: book\ntitle: Empty draft\n---\nStart here.",
      ),
    /between 1 and 50/,
  );
});
it("round trips readable plans without duplicate outlines or losing unrelated properties/prose", () => {
  const book = editableBook(manual);
  moveBookEntry(book, 2, 1);
  const updated = serializeBookPlan(book, manual);
  assert.match(updated, /custom: kept/);
  assert.match(updated, /Notes for the author/);
  assert.doesNotMatch(updated, /^entries:/m);
  assert.doesNotMatch(updated, /^page-foundry-book:/m);
  assert.equal((updated.match(/## Chapter: Arrival/g) ?? []).length, 1);
  assert.deepEqual(parseBookManifest(updated), book);
  assert.equal(serializeBookPlan(book, updated), updated);
});
it("keeps legacy plans unchanged in format until explicitly converted and retains destinations", () => {
  const book = editableBook(bookManifest);
  assert.match(serializeBookPlan(book, bookManifest), /page-foundry-book: 1/);
  const converted = serializeBookPlan(book, bookManifest, true);
  assert.match(converted, /document: book/);
  assert.doesNotMatch(converted, /^entries:/m);
  assert.deepEqual(parseBookManifest(converted), book);
  const input = new Map(
    Object.entries(bookNotes).map(([p, raw]) => [p, parseMarkdown(raw, p)]),
  );
  const legacy = assembleBook(book, input),
    readable = assembleBook(parseBookManifest(converted), input);
  assert.deepEqual(readable, legacy);
  const output = new EpubRenderer().render(readable, {
    language: "en-GB",
    identifier: "urn:neutral:readable",
  });
  const text = Object.values(unzipSync(output.bytes))
    .map((bytes) => strFromU8(bytes))
    .join("\n");
  assert.ok(text.includes("book-first-chapter"));
  assert.ok(!text.includes("foundry-section:"));
});
it("rejects duplicate paths, incomplete regions and malformed structural sections", () => {
  for (const source of [
    manual.replace("Book/One.md", "Book/Preface.md"),
    manual.replace("Book/One.md", "../outside.md"),
    manual.replace("- [[Book/One.md|Arrival]]", "- broken entry"),
    manual.replace("- [[Book/One.md|Arrival]]", ""),
    `${manual}\n%% page-foundry:book-order:start %%`,
  ])
    assert.throws(() => parseBookManifest(source));
  const prose =
    manual +
    "\n## Author notes\n- [[Unrelated.md]]\n```markdown\n## Chapter: Example\n- [[NotIncluded.md]]\n```\n";
  assert.equal(parseBookManifest(prose).entries.length, 4);
});
