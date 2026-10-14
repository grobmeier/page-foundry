/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import assert from "node:assert/strict";
import { TypstPdfRenderer } from "../src/pdf/renderer";
import { parseMarkdown } from "../src/core/markdown";
import { assembleBook } from "../src/books/assemble";
import { DEFAULT_BOOK_DESIGN } from "../src/books/design";

const entries = Array.from({ length: 50 }, (_, i) => ({
  id: `chapter-${i + 1}`,
  role: "chapter" as const,
  title: `Chapter ${i + 1} A journey through the valley and a longer heading to test wrapping`,
  path: `Chapter ${i + 1}.md`,
}));
const sources = new Map(
  entries.map((entry) => [
    entry.path,
    parseMarkdown(
      `${"The traveller walked through the quiet valley. A bright morning brought new questions and careful answers. ".repeat(15)}\n\n## A subheading that must not replace the running title\n\n${"A second paragraph continues the chapter. ".repeat(10)}`,
      entry.title,
    ),
  ]),
);
const document = assembleBook(
  {
    metadata: {
      title: "A Neutral Journey",
      subtitle: "Notes from a quiet valley",
      author: "Alex Example",
      imprint: "Example Press\nA neutral development proof",
    },
    entries,
  },
  sources,
);
document.bookDesign = { ...DEFAULT_BOOK_DESIGN, chapterRule: true };
const renderer = new TypstPdfRenderer();
const output = process.argv[2]!;
const pdf = await renderer.render(document, "plain-document", "a4");
assert.equal(new TextDecoder().decode(pdf.slice(0, 5)), "%PDF-");
await writeFile(join(output, "book.pdf"), pdf);
const print = await renderer.renderPrint(document, {
  trim: "5x8",
  paper: "cream",
  recto: true,
});
assert.ok(print.proofReport?.includes("chapter chapter-50:"));
await writeFile(join(output, "paperback.pdf"), print.bytes);
await writeFile(join(output, "paperback-proof.txt"), print.proofReport!);
console.log(output);
