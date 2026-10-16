/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import assert from "node:assert/strict";
import { it } from "node:test";
import { strFromU8, unzipSync } from "fflate";
import { parseMarkdown } from "../src/core/markdown";
import { imageNodes, imageSize, resolveImages } from "../src/core/images";
import { inlineText } from "../src/core/headings";
import { preflight } from "../src/core/preflight";
import { CORE_CATALOG } from "../src/packs/core";
import { choosePreset } from "../src/packs/model";
import { createTypstSource } from "../src/pdf/typstSource";
import { EpubRenderer } from "../src/epub/renderer";
import { DocxRenderer } from "../src/docx/renderer";
import { assembleBook } from "../src/books/assemble";
import { fixturePng } from "./fixtures/images";

it("parses aligned pipe tables, escaped pipes, inline formatting and missing cells", () => {
  const source =
    "Name | Detail | Total\n:--- | :---: | ---:\n**North** | Left \\| right and `a < b` | 12\nEmpty |\n";
  const document = parseMarkdown(source, "Tables");
  const table = document.blocks[0]!;
  assert.equal(table.type, "table");
  if (table.type !== "table") throw new Error("Expected table");
  assert.deepEqual(table.align, ["left", "center", "right"]);
  assert.equal(table.rows.length, 3);
  assert.equal(table.rows[1]![0]![0]!.type, "strong");
  assert.equal(inlineText(table.rows[1]![1]!), "Left | right and a < b");
  assert.deepEqual(table.rows[2]!.slice(1), [[], []]);
  assert.deepEqual(document.resourceErrors, []);
  assert.equal(
    parseMarkdown("a | b\nnot a delimiter", "Prose").blocks[0]!.type,
    "paragraph",
  );
});

it("blocks extra cells and excessive table dimensions rather than losing content", () => {
  assert.match(
    parseMarkdown("| A |\n| --- |\n| B | C |", "Extra").resourceErrors!.join(
      " ",
    ),
    /more cells/,
  );
  const header = Array.from({ length: 21 }, (_, i) => `Column ${i}`).join(
    " | ",
  );
  const delimiter = Array(21).fill("---").join(" | ");
  assert.match(
    parseMarkdown(`${header}\n${delimiter}`, "Wide").resourceErrors!.join(" "),
    /20 columns/,
  );
  assert.match(
    parseMarkdown(
      `| A |\n| --- |\n${"| Row |\n".repeat(1001)}`,
      "Tall",
    ).resourceErrors!.join(" "),
    /1000 body rows/,
  );
});

it("keeps code literal, preserves its whitespace and never resolves images from it", () => {
  const code =
    '  #image("remote.png")\n\t![Not an image](other.png)\n\n  <tag> & *not bold*';
  const document = parseMarkdown(`\`\`\`typst\n${code}\n\`\`\``, "Code");
  assert.deepEqual(document.blocks, [
    { type: "code", value: code, language: "typst" },
  ]);
  assert.equal(imageNodes(document).length, 0);
  assert.deepEqual(document.sourceWarnings, []);
  const source = createTypstSource(document, "plain-document", "a4");
  assert.match(source, /DejaVu Sans Mono/);
  assert.match(source, /#linebreak\(\)/);
  assert.doesNotMatch(source, /#raw\(|#image\("remote/);
  assert.match(source.replaceAll("\u200b", ""), /#text\(".*#image\(\\"remote/);
});

it("keeps nested tables and numbered-list starts, including zero", () => {
  const document = parseMarkdown(
    "3. Third\n\n   | A | B |\n   | --- | --- |\n   | One | Two |\n\n4. Fourth\n\n> | Q | R |\n> | --- | --- |\n> | Three | Four |",
    "Nesting",
  );
  const list = document.blocks[0]!;
  assert.equal(list.type, "list");
  if (list.type !== "list") throw new Error("Expected list");
  assert.equal(list.start, 3);
  assert.equal(list.items[0]![1]!.type, "table");
  assert.equal(document.blocks[1]!.type, "blockquote");
  assert.match(
    createTypstSource(document, "plain-document", "a4"),
    /#enum\(start: 3,/,
  );
  assert.match(
    createTypstSource(parseMarkdown("0. Zero", "Zero"), "plain-document", "a4"),
    /start: 0/,
  );
  const xhtml = strFromU8(
    unzipSync(
      new EpubRenderer().render(parseMarkdown("0. Zero", "Zero"), {
        language: "en",
      }).bytes,
    )["EPUB/content.xhtml"]!,
  );
  assert.match(xhtml, /<ol start="0">/);
});

it("finds images and links inside table cells, rejects unsafe sources, and bounds requested dimensions", async () => {
  const document = parseMarkdown(
    "| Art | Link |\n| --- | --- |\n| ![[panel.png\\|120x30]] | [Missing](#unknown) |\n| ![Remote](https://example.org/x.png) | ![HTML](asset.svg) |",
    "Resources",
  );
  const nodes = imageNodes(document);
  assert.equal(nodes.length, 3);
  assert.equal(nodes[0]!.width, 120);
  assert.equal(nodes[0]!.height, 30);
  const resolved: string[] = [];
  const bytes = fixturePng();
  const review = await resolveImages(document, {
    resolve: (path) => {
      resolved.push(path);
      return { path, size: bytes.length, read: async () => bytes };
    },
    decode: async () => {},
  });
  assert.deepEqual(resolved, ["panel.png"]);
  assert.equal(review.errors.length, 2);
  assert.deepEqual(imageSize({ width: 480, height: 240 }, 120, 480, 600, 30), {
    width: 60,
    height: 30,
  });
  const preset = choosePreset(CORE_CATALOG, "reflowable-ebook", "epub");
  const report = preflight(document, {
    format: "epub",
    profile: "a4",
    preset,
    metadata: { title: "Resources", language: "en" },
  });
  assert.ok(
    report.findings.some(
      (f) => f.code === "heading-link" && f.severity === "blocker",
    ),
  );
});

it("keeps table-only and code-only notes exportable and emits safe semantic tables in every format", async () => {
  for (const content of [
    "| A | B |\n| --- | --- |\n| One | Two |",
    "```\ncode only\n```",
  ]) {
    const document = parseMarkdown(content, "Body");
    const preset = choosePreset(CORE_CATALOG, "plain-document", "pdf");
    assert.ok(
      !preflight(document, {
        format: "pdf",
        profile: "a4",
        preset,
        metadata: {},
      }).findings.some((f) => f.code === "empty-content"),
    );
  }
  const document = parseMarkdown(
    "# Target\n\n| Left | Right |\n| :--- | ---: |\n| **A & B** | [Go](#target) |\n\n```\n  a < b\n  #not-executed()\n```",
    "Formats",
  );
  const before = JSON.stringify(document);
  const xhtml = strFromU8(
    unzipSync(new EpubRenderer().render(document, { language: "en" }).bytes)[
      "EPUB/content.xhtml"
    ]!,
  );
  assert.match(
    xhtml,
    /<table><thead><tr><th scope="col" style="text-align: left">Left/,
  );
  assert.match(xhtml, /<td style="text-align: right"><a href="#heading-1">Go/);
  assert.match(xhtml, /<pre><code>  a &lt; b\n  #not-executed\(\)/);
  const xml = strFromU8(
    unzipSync(
      (await new DocxRenderer().render(document, "plain-editable", "a4")).bytes,
    )["word/document.xml"]!,
  );
  assert.match(xml, /<w:tbl>/);
  assert.match(xml, /w:tblHeader/);
  assert.match(xml, /A &amp; B/);
  assert.match(xml, /Courier New/);
  const typst = createTypstSource(document, "plain-document", "a4");
  assert.match(typst, /table.header\(repeat: true/);
  assert.match(typst, /align: right/);
  assert.match(typst, /breakable: true/);
  assert.match(typst, /size.width \/ 2 < 60pt/);
  assert.equal(JSON.stringify(document), before);
});

it("remaps table images and included-note links without mutating chapter sources", async () => {
  const bytes = fixturePng();
  const source = (
    await resolveImages(
      parseMarkdown(
        "| Art | Next |\n| --- | --- |\n| ![Panel](panel.png) | [Next](Second.md#destination) |",
        "First",
      ),
      {
        resolve: (path) => ({
          path,
          size: bytes.length,
          read: async () => bytes,
        }),
        decode: async () => {},
      },
    )
  ).document;
  const before = JSON.stringify(source);
  const book = assembleBook(
    {
      metadata: { title: "Table book" },
      entries: [
        { id: "first", role: "chapter", path: "First.md" },
        { id: "second", role: "chapter", path: "Second.md" },
      ],
    },
    new Map([
      ["First.md", source],
      ["Second.md", parseMarkdown("# Destination\n\nBody", "Second")],
    ]),
  );
  assert.equal(imageNodes(book)[0]!.resourceId, "book-image-1");
  const xhtml = strFromU8(
    unzipSync(new EpubRenderer().render(book, { language: "en" }).bytes)[
      "EPUB/content.xhtml"
    ]!,
  );
  assert.match(xhtml, /images\/book-image-1.png/);
  assert.match(xhtml, /href="#entry-heading-second-heading-1"/);
  assert.equal(JSON.stringify(source), before);
});
