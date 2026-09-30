/*
 * Copyright 2026 Christian Grobmeier
 * Licensed under the Apache License, Version 2.0.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { strFromU8, unzipSync } from "fflate";
import { parseMarkdown } from "../src/core/markdown";
import { DocxRenderer } from "../src/docx/renderer";

describe("DocxRenderer", () => {
  it("creates an editable A4 general manuscript with expected formatting", async () => {
    const document = parseMarkdown(
      `---
title: Portable Story
author: Alex Example
surname: Example
short-title: Portable
---

# Chapter One

This is **editable** prose.

1. First
2. Second
`,
      "Fallback",
    );
    const output = await new DocxRenderer().render(
      document,
      "general-manuscript",
      "a4",
    );

    assert.equal(output.extension, "docx");
    assert.equal(
      output.mediaType,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    const files = unzipSync(output.bytes);
    const contentTypes = strFromU8(files["[Content_Types].xml"]!);
    const documentXml = strFromU8(files["word/document.xml"]!);
    const headerXml = Object.entries(files)
      .filter(([name]) => /^word\/header\d+\.xml$/u.test(name))
      .map(([, bytes]) => strFromU8(bytes))
      .join("\n");

    assert.doesNotMatch(contentTypes, /macroEnabled/u);
    assert.match(documentXml, /w:pgSz w:w="11906" w:h="16838"/u);
    assert.match(documentXml, /w:pgMar[^>]*w:top="1440"[^>]*w:right="1440"/u);
    assert.match(documentXml, /w:spacing[^>]*w:line="480"/u);
    assert.match(documentXml, /w:firstLine="720"/u);
    assert.match(documentXml, /Times New Roman/u);
    assert.match(documentXml, /w:pgNumType w:start="1"/u);
    assert.match(headerXml, /Example \/ Portable \/ /u);
    assert.match(headerXml, /PAGE/u);
  });

  it("creates a plain editable US Letter document", async () => {
    const output = await new DocxRenderer().render(
      parseMarkdown("## Section\n\nHello, *editor*.", "Draft"),
      "plain-editable",
      "us-letter",
    );
    const files = unzipSync(output.bytes);
    const documentXml = strFromU8(files["word/document.xml"]!);

    assert.match(documentXml, /w:pgSz w:w="12240" w:h="15840"/u);
    assert.match(documentXml, /Draft/u);
    assert.match(documentXml, /Section/u);
    assert.match(documentXml, /w:i/u);
  });
});
