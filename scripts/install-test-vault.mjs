/*
 * Copyright 2026 Christian Grobmeier
 * Licensed under the Apache License, Version 2.0.
 */

import { cp, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fixtureJpeg, fixturePng } from "../tests/fixtures/images.ts";

const root = resolve(".test-vault");
const pluginDirectory = resolve(root, ".obsidian/plugins/page-foundry");
await mkdir(pluginDirectory, { recursive: true });
await Promise.all(
  ["main.js", "manifest.json", "styles.css"].map((file) =>
    cp(resolve(file), resolve(pluginDirectory, file)),
  ),
);
await writeFile(
  resolve(root, ".obsidian/community-plugins.json"),
  '["page-foundry"]\n',
);
await writeFile(
  resolve(root, "Portable letter.md"),
  `---
title: A Portable Letter
author: Alex Example
language: en-GB
identifier: urn:page-foundry:test:portable-letter
surname: Example
short-title: Portable Letter
to: Jamie Example
date: 29 September 2026
subject: Page Foundry mobile feasibility
closing: Kind regards,
---

This letter was created from an ordinary Markdown note.

## What this proves

- The note remains authoritative.
- The PDF is generated on this device.
- The same note can become a reflowable EPUB or editable DOCX.
- No Docker or rendering server is involved.
`,
);

const artwork = resolve(root, "Artwork");
await mkdir(artwork, { recursive: true });
await writeFile(resolve(artwork, "landscape.png"), fixturePng());
await writeFile(resolve(artwork, "portrait.png"), fixturePng(240, 480));
await writeFile(resolve(artwork, "portrait.jpg"), fixtureJpeg());
await writeFile(
  resolve(root, "Portable images.md"),
  `---
title: Portable Images
author: Alex Example
language: en-GB
identifier: urn:page-foundry:test:portable-images
---

# Landscape

![Blue and gold landscape](Artwork/landscape.png)

# Portrait

![Blue and gold portrait](Artwork/portrait.jpg)

# Sized repeat

![[Artwork/landscape.png|300]]

# Reference image

![Landscape repeat][panel]

[panel]: Artwork/landscape.png

The note stays editable. These original neutral fixtures contain no private
designs. Landscape and portrait images should keep their proportions, and the
sized repeat should be smaller than the original landscape.
`,
);
for (const [name, image] of [
  ["Missing image", "![Missing](Artwork/missing.png)"],
  ["Remote image", "![Remote](https://example.com/image.png)"],
  ["Unsupported image", "![[Artwork/image.svg]]"],
  ["Traversal image", "![Traversal](../outside.png)"],
  ["Missing alt text", "![](Artwork/landscape.png)"],
])
  await writeFile(resolve(root, `${name}.md`), `# ${name}\n\n${image}\n`);
await cp(
  resolve("docs/testing/local-images-and-mobile.md"),
  resolve(root, "Page Foundry test plan.md"),
);
console.log(root);
