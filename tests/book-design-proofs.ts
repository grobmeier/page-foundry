/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import assert from "node:assert/strict";
import { TypstPdfRenderer } from "../src/pdf/renderer";
import { parseMarkdown } from "../src/core/markdown";
import { assembleBook } from "../src/books/assemble";
import { DEFAULT_BOOK_DESIGN } from "../src/books/design";
import { bookManifest, bookNotes } from "./fixtures/book";
import { parseBookManifest } from "../src/books/manifest";

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
const mixed = assembleBook(
  parseBookManifest(bookManifest),
  new Map(
    Object.entries(bookNotes).map(([path, raw]) => [
      path,
      parseMarkdown(raw, path),
    ]),
  ),
);
mixed.bookDesign = { ...DEFAULT_BOOK_DESIGN, chapterRule: true };
const roles = await renderer.renderPrint(mixed, {
  trim: "6x9",
  paper: "white",
  recto: true,
});
assert.ok(roles.proofReport?.includes("scene scene-one:"));
assert.ok(roles.proofReport?.includes("part first-part:"));
await writeFile(join(output, "mixed-roles.pdf"), roles.bytes);
await writeFile(join(output, "mixed-roles-proof.txt"), roles.proofReport!);
mixed.bookDesign = {
  ...DEFAULT_BOOK_DESIGN,
  titlePage: false,
  contents: false,
  imprintPage: false,
  header: "none",
};
const simple = await renderer.renderPrint(mixed, {
  trim: "6x9",
  paper: "white",
  recto: false,
});
await writeFile(join(output, "no-opening-pages.pdf"), simple.bytes);
await writeFile(
  join(output, "no-opening-pages-proof.txt"),
  simple.proofReport!,
);
// Short, two-line paragraphs expose boundary collisions hidden by long prose.
// The companion PDF geometry check compares the paragraph boundary with the
// measured line advance, for ordinary pages and measured paperback interiors.
for (const [bodySizePt, lineSpacing] of [
  [8, 1],
  [11, 1.35],
  [20, 2],
] as const) {
  for (const paragraphSpaceMm of [0, 3, 12]) {
    const sample = assembleBook(
      {
        metadata: { title: "Paragraph proof", author: "Alex Example" },
        entries: [
          { id: "one", role: "chapter", title: "Spacing", path: "One.md" },
        ],
      },
      new Map([
        [
          "One.md",
          parseMarkdown(
            "AlphaLine  \nBetaLine\n\nGammaLine  \nDeltaLine\n\nFinalLine",
            "Spacing",
          ),
        ],
      ]),
    );
    sample.style = { bodySizePt, lineSpacing };
    sample.bookDesign = {
      ...DEFAULT_BOOK_DESIGN,
      titlePage: false,
      contents: false,
      imprintPage: false,
      paragraphSpaceMm,
    };
    for (const profile of ["a4", "us-letter", "paperback"] as const) {
      const bytes =
        profile === "paperback"
          ? (
              await renderer.renderPrint(sample, {
                trim: "5x8",
                paper: "cream",
                recto: false,
              })
            ).bytes
          : await renderer.render(sample, "plain-document", profile);
      await writeFile(
        join(
          output,
          `paragraphs-${bodySizePt}-${paragraphSpaceMm}-${profile}.pdf`,
        ),
        bytes,
      );
    }
  }
}
console.log(output);
