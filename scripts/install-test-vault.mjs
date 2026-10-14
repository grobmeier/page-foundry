/*
 * Copyright 2026 Christian Grobmeier
 * Licensed under the Apache License, Version 2.0.
 */

import { cp as replacePluginFile, mkdir } from "node:fs/promises";
import {
  copyMissing as cp,
  writeMissing as writeFile,
  enableFoundry,
} from "./test-vault-files.mjs";
import { resolve } from "node:path";
import { fixtureJpeg, fixturePng } from "../tests/fixtures/images.ts";
import { bookManifest, bookNotes } from "../tests/fixtures/book.ts";
import { editableBook, serializeBookPlan } from "../src/books/editor.ts";

const root = resolve(".test-vault");
const pluginDirectory = resolve(root, ".obsidian/plugins/page-foundry");
await mkdir(pluginDirectory, { recursive: true });
await mkdir(resolve(root, "Book"), { recursive: true });
await cp(resolve("docs/start-here.md"), resolve(root, "Start here.md"));
await writeFile(resolve(root, "A Neutral Journey.book.md"), bookManifest);
await writeFile(
  resolve(root, "Readable Journey.book.md"),
  serializeBookPlan(editableBook(bookManifest)),
);
for (const [path, source] of Object.entries(bookNotes))
  await writeFile(resolve(root, path), source);
await cp(
  resolve("docs/testing/ordered-books.md"),
  resolve(root, "Ordered book test plan.md"),
);
await cp(
  resolve("docs/testing/paperback-proof.md"),
  resolve(root, "Paperback proof test plan.md"),
);
await cp(
  resolve("docs/testing/simple-create.md"),
  resolve(root, "Simple Create test plan.md"),
);
await cp(
  resolve("docs/testing/authoring-templates.md"),
  resolve(root, "Authoring templates test plan.md"),
);
await cp(
  resolve("docs/note-templates.md"),
  resolve(root, "Note templates guide.md"),
);
await Promise.all(
  ["main.js", "manifest.json", "styles.css"].map((file) =>
    replacePluginFile(resolve(file), resolve(pluginDirectory, file)),
  ),
);
await enableFoundry(resolve(root, ".obsidian/community-plugins.json"));
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
const designs = resolve(root, "Designs");
await mkdir(designs, { recursive: true });
await cp(
  resolve("examples/neutral-pack/page-foundry-pack.json"),
  resolve(designs, "page-foundry-pack.json"),
);
await cp(
  resolve("docs/testing/preset-packs.md"),
  resolve(root, "Preset pack test plan.md"),
);
await cp(
  resolve("docs/preset-packs.md"),
  resolve(root, "Preset pack authoring.md"),
);
await cp(
  resolve("docs/testing/author-preflight.md"),
  resolve(root, "Author preflight test plan.md"),
);
const preflightFixtures = {
  "Preflight clean": `---\ntitle: A Neutral Draft\nauthor: Alex Example\nlanguage: en-GB\nidentifier: urn:example:preflight-clean\nto: Jamie Example\nsubject: A neutral submission\n---\n\n# Chapter One\n\nA complete neutral paragraph. [Return to Chapter One](#chapter-one).\n`,
  "Preflight advice": `### Skipped level\n\nA neutral paragraph with [an other-note link](Another%20note.md).\n\n<span>Literal HTML</span>\n\n\`\`\`text\nCode stays text, without block formatting.\n\`\`\`\n`,
  "Preflight broken link": `# Chapter One\n\n[Missing destination](#chapter-two)\n`,
  "Preflight empty": `---\ntitle: Metadata Only\n---\n`,
};
for (const [name, source] of Object.entries(preflightFixtures))
  await writeFile(resolve(root, `${name}.md`), source);
console.log(root);
