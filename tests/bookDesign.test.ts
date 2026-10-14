/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import assert from "node:assert/strict";
import { it } from "node:test";
import { DEFAULT_BOOK_DESIGN, parseBookDesign } from "../src/books/design";
import { CORE_PACK } from "../src/packs/core";
import { updatedPack } from "../src/packs/editor";
import { parsePack, catalogue, applyPreset } from "../src/packs/model";
import { parseMarkdown } from "../src/core/markdown";

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
