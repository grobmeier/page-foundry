/*
 * Copyright 2026 Christian Grobmeier
 * Licensed under the Apache License, Version 2.0.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { strFromU8, unzipSync } from "fflate";
import { parseMarkdown } from "../src/core/markdown";
import { EpubRenderer } from "../src/epub/renderer";

describe("EpubRenderer", () => {
  it("creates a conforming local container with semantic content and navigation", () => {
    const document = parseMarkdown(
      `---
title: A & B
author: Alex Example
language: en-GB
identifier: urn:example:portable-book
---

# First & Chapter

Hello, **reader**. Visit [the example](https://example.com).

1. First
2. Second
`,
      "Fallback",
    );
    const output = new EpubRenderer().render(document, {
      language: "de",
      modified: new Date("2026-09-30T12:34:56Z"),
    });

    assert.equal(output.extension, "epub");
    assert.equal(output.mediaType, "application/epub+zip");
    assert.equal(readLocalFilename(output.bytes), "mimetype");
    assert.equal(readUint16(output.bytes, 8), 0, "mimetype must be stored");

    const files = unzipSync(output.bytes);
    assert.equal(strFromU8(files.mimetype!), "application/epub+zip");
    assert.match(
      strFromU8(files["META-INF/container.xml"]!),
      /full-path="EPUB\/package\.opf"/u,
    );

    const packageXml = strFromU8(files["EPUB/package.opf"]!);
    assert.match(packageXml, /<dc:title>A &amp; B<\/dc:title>/u);
    assert.match(packageXml, /<dc:language>de<\/dc:language>/u);
    assert.match(packageXml, /<dc:creator>Alex Example<\/dc:creator>/u);
    assert.match(packageXml, /2026-09-30T12:34:56Z/u);

    const navigation = strFromU8(files["EPUB/nav.xhtml"]!);
    assert.match(navigation, /epub:type="toc"/u);
    assert.match(navigation, /content\.xhtml#heading-1/u);
    assert.match(navigation, /First &amp; Chapter/u);

    const content = strFromU8(files["EPUB/content.xhtml"]!);
    assert.match(content, /<h2 id="heading-1">First &amp; Chapter<\/h2>/u);
    assert.match(content, /<strong>reader<\/strong>/u);
    assert.match(content, /href="https:\/\/example\.com"/u);
    assert.match(content, /<ol>/u);
  });

  it("rejects missing language and strips executable links", () => {
    const renderer = new EpubRenderer();
    assert.throws(
      () => renderer.render(parseMarkdown("Text", "Draft"), { language: "" }),
      /publication language/u,
    );

    const output = renderer.render(
      parseMarkdown("[Do not run](javascript:alert(1))", "Draft"),
      {
        language: "en",
        identifier: "urn:example:safe",
        modified: new Date("2026-09-30T00:00:00Z"),
      },
    );
    const content = strFromU8(unzipSync(output.bytes)["EPUB/content.xhtml"]!);
    assert.doesNotMatch(content, /javascript:/u);
    assert.match(content, />Do not run</u);
  });
});

function readLocalFilename(bytes: Uint8Array): string {
  const length = readUint16(bytes, 26);
  return new TextDecoder().decode(bytes.subarray(30, 30 + length));
}

function readUint16(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! | (bytes[offset + 1]! << 8);
}
