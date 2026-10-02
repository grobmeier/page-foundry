/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { strFromU8, unzipSync } from "fflate";
import { parseMarkdown } from "../src/core/markdown";
import { preflight, reportText } from "../src/core/preflight";
import { headingIndex, resolveFragment } from "../src/core/headings";
import { CORE_CATALOG } from "../src/packs/core";
import { choosePreset, initialMetadata } from "../src/packs/model";
import { EpubRenderer } from "../src/epub/renderer";
import { createTypstSource } from "../src/pdf/typstSource";
import { DocxRenderer } from "../src/docx/renderer";
import type { OutputFormat } from "../src/core/model";

function check(source: string, format: OutputFormat = "epub") {
  const document = parseMarkdown(source, "Neutral draft");
  const preset = choosePreset(
    CORE_CATALOG,
    format === "epub"
      ? "reflowable-ebook"
      : format === "pdf"
        ? "plain-document"
        : "plain-editable",
    format,
  );
  const metadata = { ...initialMetadata(document, preset), language: "en" };
  const options = { format, profile: "a4" as const, preset, metadata };
  return { document, options, report: preflight(document, options) };
}

describe("author preflight", () => {
  it("separates advice and unchecked claims from blockers and is deterministic", () => {
    const { report, document, options } = check(
      "---\nauthor: Alex Example\n---\n\n# Chapter One\n\nA complete paragraph.",
    );
    assert.equal(report.findings.length, 0);
    assert.deepEqual(preflight(document, options), report);
    assert.match(reportText(report), /0 blocker\(s\)/);
    assert.ok(
      report.notChecked.some((message) => message.includes("not certified")),
    );
    assert.ok(
      report.notChecked.some((message) => message.includes("Physical-device")),
    );
  });
  it("blocks empty notes without treating metadata or decorative separators as body", () => {
    for (const source of ["", "---\ntitle: A title\n---\n", "---\n\n***"]) {
      assert.ok(
        check(source, "pdf").report.findings.some(
          (finding) =>
            finding.code === "empty-content" && finding.severity === "blocker",
        ),
      );
    }
    assert.ok(
      !check("![A panel](panel.png)", "pdf").report.findings.some(
        (finding) => finding.code === "empty-content",
      ),
    );
  });
  it("combines and deduplicates metadata, configured-pack and image blockers", () => {
    const { document, options } = check("A paragraph.");
    const report = preflight(document, {
      ...options,
      metadata: { title: "", language: "invalid tag" },
      packError: "Invalid pack",
      resourceErrors: ["Missing image", "Missing image"],
    });
    assert.equal(
      report.findings.filter((f) => f.message === "Missing image").length,
      1,
    );
    assert.ok(
      report.findings.filter((f) => f.severity === "blocker").length >= 4,
    );
  });
  it("indexes nested headings and resolves encoded Unicode, normalised names and explicit IDs", () => {
    const { document } = check("# First\n\n> ## Café & Thé\n\n- ### Last\n");
    const index = headingIndex(document);
    assert.equal(index.entries.length, 3);
    assert.equal(
      resolveFragment(index, "#caf%C3%A9--th%C3%A9").id,
      "heading-2",
    );
    assert.equal(resolveFragment(index, "#Café%20%26%20Thé").id, "heading-2");
    assert.equal(resolveFragment(index, "#heading-3").id, "heading-3");
  });
  it("blocks missing, ambiguous, malformed and block-reference EPUB fragments", () => {
    for (const target of ["missing", "Repeat", "%zz", "^Repeat"]) {
      const { report } = check(`# Repeat\n\n## Repeat\n\n[Jump](#${target})`);
      assert.ok(
        report.findings.some(
          (f) => f.code === "heading-link" && f.severity === "blocker",
        ),
      );
    }
    assert.ok(
      !check(
        "# Repeat\n\n## Repeat\n\n[Jump](#heading-2)",
      ).report.findings.some((f) => f.code === "heading-link"),
    );
  });
  it("maps reference-style and named EPUB links to exactly the emitted heading IDs", () => {
    const { document, report } = check(
      "# Café\n\n[Go][jump]\n\n[jump]: #caf%C3%A9",
    );
    assert.ok(!report.findings.some((f) => f.severity === "blocker"));
    const output = new EpubRenderer().render(document, {
      language: "en",
      identifier: "urn:example:preflight",
    });
    const files = unzipSync(output.bytes);
    const content = strFromU8(files["EPUB/content.xhtml"]!);
    assert.match(content, /href="#heading-1">Go<\/a>/);
    assert.match(content, /id="heading-1"/);
    assert.match(
      strFromU8(files["EPUB/nav.xhtml"]!),
      /content.xhtml#heading-1/,
    );
    assert.throws(
      () =>
        new EpubRenderer().render(check("[Missing](#unknown)").document, {
          language: "en",
        }),
      /no destination/,
    );
  });
  it("advises rather than blocks PDF/DOCX fragments and never emits unsafe PDF actions", async () => {
    const source =
      "[Jump](#missing) and [Local](another.md) and [Bad](javascript:alert(1)) and [Safe](https://example.com).";
    for (const format of ["pdf", "docx"] as const) {
      const { report, document } = check(source, format);
      assert.ok(
        report.findings.some(
          (f) => f.code === "heading-link" && f.severity === "advice",
        ),
      );
      assert.ok(!report.findings.some((f) => f.severity === "blocker"));
      if (format === "pdf") {
        const typst = createTypstSource(document, "plain-document", "a4");
        assert.doesNotMatch(
          typst,
          /javascript:|#link\("#missing"\)|another.md/,
        );
        assert.match(typst, /#link\("https:\/\/example.com"\)/);
      } else {
        const output = await new DocxRenderer().render(
          document,
          "plain-editable",
          "a4",
        );
        const relationships = strFromU8(
          unzipSync(output.bytes)["word/_rels/document.xml.rels"]!,
        );
        assert.doesNotMatch(relationships, /javascript:|another.md|#missing/);
      }
    }
  });
  it("reports unsupported local links, missing descriptions, heading gaps and lost formatting without reading anything", () => {
    const { report } = check(
      "### Skipped\n\n![](panel.png)\n\n[Other](other.md)\n\n```text\ncode\n```\n\n<span>Literal</span>",
    );
    for (const code of [
      "author",
      "image-description",
      "heading-order",
      "unsupported-link",
      "source-format",
    ])
      assert.ok(
        report.findings.some((f) => f.code === code && f.severity === "advice"),
      );
    assert.ok(!report.findings.some((f) => f.severity === "blocker"));
    assert.ok(
      check("Text only").report.findings.some((f) => f.code === "navigation"),
    );
  });
  it("preserves the source and honours export-only author values", () => {
    const { document, options } = check(
      "---\nauthor: Alex Example\n---\n\nA paragraph.",
    );
    const before = structuredClone(document);
    const cleared = preflight(document, {
      ...options,
      metadata: { ...options.metadata, author: "" },
    });
    assert.ok(cleared.findings.some((f) => f.code === "author"));
    assert.deepEqual(document, before);
  });
  it("labels geometry, publisher, page and device checks honestly", () => {
    const { document } = check("A paragraph.");
    const preset = choosePreset(CORE_CATALOG, "general-manuscript", "pdf");
    const report = preflight(document, {
      format: "pdf",
      profile: "us-letter",
      preset,
      metadata: initialMetadata(document, preset),
    });
    assert.match(report.summary, /US Letter/);
    assert.match(report.summary, /inspect the generated file/);
    assert.ok(report.notChecked.some((message) => message.includes("KDP")));
    assert.ok(
      report.notChecked.some((message) => message.includes("font embedding")),
    );
  });
});
