/*
 * Copyright 2026 Christian Grobmeier
 * Licensed under the Apache License, Version 2.0.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseMarkdown } from "../src/core/markdown";

describe("parseMarkdown", () => {
  it("keeps frontmatter as metadata and produces portable blocks", () => {
    const document = parseMarkdown(
      `---
title: A Portable Letter
author: Alex Example
date: 2026-09-29
---

# Greeting

Hello, **reader**.

1. First
2. Second
`,
      "Fallback",
    );

    assert.equal(document.title, "A Portable Letter");
    assert.equal(document.metadata.author, "Alex Example");
    assert.equal(document.blocks[0]?.type, "heading");
    assert.equal(document.blocks[1]?.type, "paragraph");
    assert.deepEqual(document.blocks[2], {
      type: "list",
      ordered: true,
      items: [
        [{ type: "paragraph", children: [{ type: "text", value: "First" }] }],
        [{ type: "paragraph", children: [{ type: "text", value: "Second" }] }],
      ],
    });
  });

  it("uses the note name when frontmatter has no title", () => {
    assert.equal(parseMarkdown("A paragraph.", "Notes").title, "Notes");
  });
});
