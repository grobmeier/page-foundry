/*
 * Copyright 2026 Christian Grobmeier
 * Licensed under the Apache License, Version 2.0.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseMarkdown } from "../src/core/markdown";
import { DocxRenderer } from "../src/docx/renderer";
import { EpubRenderer } from "../src/epub/renderer";

const vault = resolve(".test-vault");
const outputDirectory = resolve(vault, "Page Foundry");
const sourcePath = resolve(vault, "Portable letter.md");
const source = await readFile(sourcePath, "utf8");
const document = parseMarkdown(source, "Portable letter");

const epub = new EpubRenderer().render(document, { language: "en-GB" });
const docx = await new DocxRenderer().render(
  document,
  "general-manuscript",
  "a4",
);

await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  writeFile(resolve(outputDirectory, "Portable letter.epub"), epub.bytes),
  writeFile(resolve(outputDirectory, "Portable letter.docx"), docx.bytes),
]);

console.log(outputDirectory);
