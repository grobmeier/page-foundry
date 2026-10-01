/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { unzipSync, strFromU8 } from "fflate";
import { CORE_PACK, CORE_CATALOG } from "../src/packs/core";
import {
  applyPreset,
  catalogue,
  choosePreset,
  initialMetadata,
  metadataErrors,
  parsePack,
} from "../src/packs/model";
import { parseMarkdown } from "../src/core/markdown";
import { createTypstSource } from "../src/pdf/typstSource";
import { DocxRenderer } from "../src/docx/renderer";
import { EpubRenderer } from "../src/epub/renderer";

const source = readFileSync(
  "examples/neutral-pack/page-foundry-pack.json",
  "utf8",
);
const catalog = catalogue([CORE_PACK, parsePack(source)], "test");
const preset = choosePreset(catalog, "neutral-example:studio-proof", "pdf");
const document = parseMarkdown(
  "---\ntitle: A Proof\nauthor: Alex Example\n---\n\nA paragraph.",
  "Proof",
);

describe("preset packs", () => {
  it("uses the same contract for built-ins and namespaced private packs", () => {
    assert.equal(CORE_CATALOG.presets.length, 8);
    assert.equal(preset.packVersion, "1.0.0");
    assert.throws(
      () => catalogue([CORE_PACK, { ...parsePack(source), id: "core" }], "x"),
      /cannot replace core/,
    );
    assert.throws(
      () => choosePreset(catalog, "studio-proof", "pdf"),
      /Choose a preset/,
    );
    assert.throws(
      () => choosePreset(catalog, "letter", "epub"),
      /Choose a preset/,
    );
  });
  it("rejects incompatible, oversized, duplicate and executable contracts", () => {
    assert.throws(() => parsePack("{"), /valid JSON/);
    assert.throws(() => parsePack(" ".repeat(128 * 1024 + 1)), /128 KiB/);
    const cases = [
      (p: any) => (p.schemaVersion = 2),
      (p: any) => (p.compatibility.minEngine = 2),
      (p: any) => p.presets.push(p.presets[0]),
      (p: any) => (p.presets[0].outputs.pdf.recipe = "reflowable-ebook"),
      (p: any) => (p.presets[0].outputs.pdf.style.marginXmm = 41),
      (p: any) =>
        (p.presets[0].outputs.pdf.style.color = 'red);#include("secret")'),
      (p: any) => (p.presets[0].outputs.epub.style.font = "url(secret)"),
      (p: any) => (p.presets[0].metadata[0].key = "__proto__"),
      (p: any) => (p.presets[0].template = '#read("secret")'),
      (p: any) => (p.assets = ["private.png"]),
    ];
    for (const mutate of cases) {
      const value = JSON.parse(source);
      mutate(value);
      assert.throws(() => parsePack(JSON.stringify(value)));
    }
  });
  it("prefills and validates fields without mutating the note or retaining another preset's values", () => {
    const values = initialMetadata(document, preset);
    assert.equal(values.language, "en");
    assert.equal(values.title, "A Proof");
    assert.deepEqual(metadataErrors(preset, { ...values, author: "" }, "pdf"), [
      "Enter author.",
    ]);
    assert.ok(
      metadataErrors(preset, { ...values, language: "not a tag" }, "epub")
        .length,
    );
    assert.throws(
      () => applyPreset(document, preset, "pdf", { ...values, title: "" }),
      /Enter title/,
    );
    const changed = applyPreset(document, preset, "pdf", {
      ...values,
      title: "Export only",
    });
    assert.equal(changed.title, "Export only");
    assert.equal(document.title, "A Proof");
    assert.equal(
      initialMetadata(
        document,
        choosePreset(catalog, "general-manuscript", "pdf"),
      ).title,
      "A Proof",
    );
  });
  it("applies style settings to all three native outputs", async () => {
    const values = initialMetadata(document, preset);
    const pdf = createTypstSource(
      applyPreset(document, preset, "pdf", values),
      "plain-document",
      "a4",
    );
    assert.match(pdf, /x: 30mm, y: 30mm/);
    assert.match(pdf, /size: 14pt/);
    assert.match(pdf, /#243b53/);
    const docx = await new DocxRenderer().render(
      applyPreset(document, preset, "docx", values),
      "plain-editable",
      "a4",
    );
    const xml = unzipSync(docx.bytes);
    assert.match(strFromU8(xml["word/styles.xml"]!), /Arial/);
    assert.match(strFromU8(xml["word/styles.xml"]!), /w:line="360"/);
    assert.match(strFromU8(xml["word/document.xml"]!), /w:left="1701"/);
    const epub = new EpubRenderer().render(
      applyPreset(document, preset, "epub", values),
      { language: "en", identifier: "urn:test:proof" },
    );
    assert.match(
      strFromU8(unzipSync(epub.bytes)["EPUB/styles.css"]!),
      /font-family: sans-serif/,
    );
  });
  it("produces a manuscript title page and escaped running header", () => {
    const manuscript = choosePreset(CORE_CATALOG, "general-manuscript", "pdf");
    const applied = applyPreset(
      document,
      manuscript,
      "pdf",
      initialMetadata(document, manuscript),
    );
    const source = createTypstSource(applied, "manuscript", "us-letter");
    assert.match(source, /#page\(header: none, footer: none\)/);
    assert.match(source, /Example \/ A Proof \/ /);
    assert.match(source, /first-line-indent: 12.7mm/);
    assert.equal(document.style, undefined);
  });
});
