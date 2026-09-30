/*
 * Copyright 2026 Christian Grobmeier
 * Licensed under the Apache License, Version 2.0.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseMarkdown } from "../src/core/markdown";
import { createTypstSource } from "../src/pdf/typstSource";

describe("createTypstSource", () => {
  it("renders a plain A4 document without interpreting manuscript markup", () => {
    const document = parseMarkdown(
      "# A #heading\n\nText with *emphasis* and $money.",
      "Draft",
    );
    const source = createTypstSource(document, "plain-document", "a4");

    assert.match(source, /paper: "a4"/u);
    assert.match(source, /#heading\(level: 1\)/u);
    assert.match(source, /#text\("A #heading"\)/u);
    assert.match(source, /#emph\[#text\("emphasis"\)\]/u);
    assert.match(source, /#text\(" and \$money\."\)/u);
  });

  it("adds letter metadata and a closing", () => {
    const document = parseMarkdown(
      `---
title: A Letter
author: Alex Example
to: Jamie Example
subject: A portable publishing test
closing: Kind regards,
---

Hello.
`,
      "Letter",
    );
    const source = createTypstSource(document, "letter", "us-letter");

    assert.match(source, /paper: "us-letter"/u);
    assert.match(source, /Alex Example/u);
    assert.match(source, /Jamie Example/u);
    assert.match(source, /Kind regards,/u);
  });
});
