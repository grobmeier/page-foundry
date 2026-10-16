/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import assert from "node:assert/strict";
import { TypstPdfRenderer } from "../src/pdf/renderer";
import { parseMarkdown } from "../src/core/markdown";
import { resolveImages } from "../src/core/images";
import { assembleBook } from "../src/books/assemble";
import { DEFAULT_BOOK_DESIGN } from "../src/books/design";
import { fixturePng, fixtureJpeg } from "./fixtures/images";

const markdown = `# Markdown layout proof

## Aligned cells and wrapping

| Item | Description | Amount |
| :--- | :---: | ---: |
| **North** | A longer description that must wrap without touching its neighbours. | 12.50 |
| South | An escaped pipe: left \\| right and \`a < b\` | 3.00 |
| Empty value | | 0.00 |
| Link | [Read more](https://example.org) and *emphasis* | 9.00 |
| Long token | abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ | 1.00 |
| Artwork | ![[panels.png\\|120x60]] | 2.00 |

## A wide table

| A | B | C | D | E | F | G |
| --- | --- | --- | --- | --- | --- | --- |
| Alpha | Bravo | Charlie | Delta | Echo | Foxtrot | Golf |
| One | Two | Three | Four | Five | Six | Seven |

## Nesting

3. Third item with an image ![[panels.png|80]]
   - Nested bullet with **bold** text.

   A second paragraph in the same numbered item.

4. Fourth item with a table:

   | Label | Value |
   | --- | --- |
   | Inner | ![[panels.png\\|120]] |

> A quotation followed by a table.
>
> | Quote heading | Value |
> | --- | --- |
> | Nested | Contained in the quotation |

## Literal code

\`\`\`text
  indented = true
  #image("https://example.invalid/not-fetched.png")
  brackets = [one, two]; price = "$20"
  very_long_identifier_abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_ends_here
\`\`\`

## Wide and tall images

![Wide panels](panels.png)

![Portrait pattern](portrait.jpg)

## Multi-page table

| Record | Detail | Status |
| --- | --- | --- |
${Array.from({ length: 90 }, (_, i) => `| Record ${i + 1} | This table continues across pages and retains its headings. | Complete |`).join("\n")}

## A row taller than a page

| Label | Detail |
| --- | --- |
| Tall row | ${"The row must continue safely on the next page. ".repeat(180)}END OF TALL ROW |

END OF PROOF
`;
const document = parseMarkdown(markdown, "Layout proof");
const assets = {
  "panels.png": { bytes: fixturePng(1200, 600), width: 1200, height: 600 },
  "portrait.jpg": { bytes: fixtureJpeg(), width: 240, height: 480 },
};
const review = await resolveImages(document, {
  resolve: (url) => {
    const asset = assets[url as keyof typeof assets];
    assert.ok(asset, `Unexpected resource request: ${url}`);
    return {
      path: url,
      size: asset.bytes.length,
      read: async () => asset.bytes,
    };
  },
  decode: async () => {},
});
assert.deepEqual(review.errors, []);
const renderer = new TypstPdfRenderer();
const output = process.argv[2]!;
for (const profile of ["a4", "us-letter"] as const) {
  await writeFile(
    join(output, `${profile}.pdf`),
    await renderer.render(review.document, "plain-document", profile),
  );
}
const book = assembleBook(
  {
    metadata: { title: "Markdown proof book" },
    entries: [
      {
        id: "layout",
        role: "chapter",
        title: "Markdown edge cases",
        path: "Layout.md",
      },
    ],
  },
  new Map([["Layout.md", review.document]]),
);
book.bookDesign = {
  ...DEFAULT_BOOK_DESIGN,
  titlePage: false,
  contents: false,
  imprintPage: false,
};
const print = await renderer.renderPrint(book, {
  trim: "5x8",
  paper: "cream",
  recto: false,
});
await writeFile(join(output, "paperback.pdf"), print.bytes);
await writeFile(join(output, "paperback-proof.txt"), print.proofReport!);
console.log(output);
