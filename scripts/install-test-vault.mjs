/*
 * Copyright 2026 Christian Grobmeier
 * Licensed under the Apache License, Version 2.0.
 */

import { cp, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

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
to: Jamie Example
date: 29 September 2026
subject: Page Foundry mobile feasibility
closing: Kind regards,
---

This letter was created from an ordinary Markdown note.

## What this proves

- The note remains authoritative.
- The PDF is generated on this device.
- No Docker or rendering server is involved.
`,
);

console.log(root);
