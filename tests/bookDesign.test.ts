/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import assert from "node:assert/strict";
import { it } from "node:test";
import { DEFAULT_BOOK_DESIGN, parseBookDesign } from "../src/books/design";
import { CORE_PACK } from "../src/packs/core";
import { updatedPack } from "../src/packs/editor";
import { parsePack, catalogue, applyPreset } from "../src/packs/model";
import { parseMarkdown } from "../src/core/markdown";
import { createTypstSource } from "../src/pdf/typstSource";
import { createPrintSource } from "../src/pdf/printSource";
import { assembleBook } from "../src/books/assemble";
import { bookManifest, bookNotes } from "./fixtures/book";
import { parseBookManifest } from "../src/books/manifest";
import { editableBook, serializeBookPlan } from "../src/books/editor";

it("keeps version-one packs readable and upgrades only designs needing book controls", () => {
  assert.deepEqual(parsePack(JSON.stringify(CORE_PACK)), CORE_PACK);
  const original = parsePack(
    updatedPack(undefined, { ...CORE_PACK.presets[0]!, id: "plain" }),
  );
  const snapshot = structuredClone(original);
  const design = {
    id: "book",
    name: "Neutral book",
    description: "Neutral proof",
    metadata: [],
    outputs: {
      pdf: { recipe: "plain-document" as const, book: DEFAULT_BOOK_DESIGN },
    },
  };
  const upgraded = parsePack(updatedPack(original, design));
  assert.equal(upgraded.schemaVersion, 2);
  assert.deepEqual(upgraded.compatibility, { minEngine: 2, maxEngine: 2 });
  assert.deepEqual(upgraded.presets[0], original.presets[0]);
  assert.deepEqual(original, snapshot);
  assert.equal(
    parsePack(updatedPack(original, original.presets[0]!)).schemaVersion,
    1,
  );
  const preset = catalogue([upgraded], "").presets[1]!;
  assert.throws(
    () => applyPreset(parseMarkdown("Writing", "Note"), preset, "pdf", {}),
    /ordered book/,
  );
});
it("validates bounded non-executable book designs and format mappings", () => {
  for (const value of [
    null,
    [],
    { titlePage: "true" },
    { chapterSizePt: NaN },
    { titleTopMm: 81 },
    { header: "raw-code" },
    { chapterAlign: "#eval" },
    { include: "file" },
    { printDefaults: { trim: "bad" } },
  ])
    assert.throws(() => parseBookDesign(value));
  assert.equal(parseBookDesign({ chapterRule: true }).chapterRule, true);
  const pack = JSON.parse(
    updatedPack(undefined, {
      id: "book",
      name: "Neutral",
      description: "Proof",
      metadata: [],
      outputs: { pdf: { recipe: "plain-document", book: DEFAULT_BOOK_DESIGN } },
    }),
  );
  pack.schemaVersion = 1;
  pack.compatibility = { minEngine: 1, maxEngine: 1 };
  assert.throws(() => parsePack(JSON.stringify(pack)), /unsupported field/);
  pack.schemaVersion = 2;
  pack.compatibility = { minEngine: 2, maxEngine: 2 };
  pack.presets[0].outputs.pdf.recipe = "letter";
  assert.throws(() => parsePack(JSON.stringify(pack)), /Book PDF/);
  pack.presets[0].outputs = { epub: { recipe: "reflowable-ebook", book: {} } };
  assert.throws(() => parsePack(JSON.stringify(pack)), /Book PDF/);
});
it("renders only structural chapter designs, safe opening text, measured print markers and contents links", () => {
  const book = assembleBook(
    parseBookManifest(bookManifest),
    new Map(
      Object.entries(bookNotes).map(([path, raw]) => [
        path,
        parseMarkdown(raw, path),
      ]),
    ),
  );
  book.metadata.subtitle = '#include("private")';
  book.metadata.imprint = "Example Press\nNeutral proof";
  book.bookDesign = { ...DEFAULT_BOOK_DESIGN, chapterRule: true };
  const before = structuredClone(book);
  const source = createTypstSource(book, "plain-document", "a4");
  assert.match(source, /#text\("#include/);
  assert.match(source, /#link\(target\)/);
  assert.match(source, /query\(<foundry-section>\)/);
  assert.match(source, /#line\(length: 25%, stroke: 0.5pt\)/);
  assert.equal(
    (source.match(/#v\(18mm\)/g) ?? []).length,
    book.book!.entries.filter((e) => e.role === "chapter").length,
  );
  assert.doesNotMatch(source, /foundry-proof/);
  const print = createPrintSource(
    book,
    { trim: "5x8", paper: "cream", recto: true },
    0.625,
  );
  assert.match(print, /inside: 0.625in, outside: 0.5in/);
  assert.match(print, /fill: black/);
  assert.match(print, /foundry-proof/);
  assert.match(print, /foundry-blanks/);
  assert.deepEqual(book, before);
  assert.throws(() => createTypstSource(book, "letter", "a4"), /Book PDF/);
});
it("round-trips subtitle and readable multiline imprint without changing outline or unrelated prose", () => {
  const source = serializeBookPlan(parseBookManifest(bookManifest));
  const draft = editableBook(source);
  draft.metadata.subtitle = "A neutral subtitle";
  draft.metadata.imprint = "Example Press\nDevelopment edition";
  const saved = serializeBookPlan(draft, source);
  assert.match(saved, /imprint: \|/);
  assert.equal(
    parseBookManifest(saved).metadata.imprint,
    draft.metadata.imprint,
  );
  assert.deepEqual(parseBookManifest(saved).entries, draft.entries);
});
