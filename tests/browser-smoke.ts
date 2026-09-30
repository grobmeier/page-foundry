/*
 * Copyright 2026 Christian Grobmeier
 * Licensed under the Apache License, Version 2.0.
 */

import { unzipSync } from "fflate";
import { parseMarkdown } from "../src/core/markdown";
import type { PublishedFile } from "../src/core/model";
import { DocxRenderer } from "../src/docx/renderer";
import { EpubRenderer } from "../src/epub/renderer";
import { TypstPdfRenderer } from "../src/pdf/renderer";

const button = document.querySelector<HTMLButtonElement>("#generate");
const status = document.querySelector<HTMLParagraphElement>("#status");
const downloads = document.querySelector<HTMLUListElement>("#downloads");
if (!button || !status || !downloads)
  throw new Error("Browser smoke controls are missing.");

button.addEventListener("click", async () => {
  button.disabled = true;
  status.textContent = "Generating";
  try {
    const markdown = `---
title: Page Foundry
author: Alex Example
language: en
identifier: urn:page-foundry:browser-smoke
---

# Portable publishing

This document was generated **on this device** without a rendering server.
`;
    const document = parseMarkdown(markdown, "Page Foundry");
    const pdf: PublishedFile = {
      bytes: await new TypstPdfRenderer().render(
        document,
        "plain-document",
        "a4",
      ),
      extension: "pdf",
      mediaType: "application/pdf",
    };
    const epub = new EpubRenderer().render(document, {
      language: "en",
      modified: new Date("2026-09-30T00:00:00Z"),
    });
    const docx = await new DocxRenderer().render(
      document,
      "general-manuscript",
      "a4",
    );

    assertPdf(pdf.bytes);
    assertZipContains(epub.bytes, "EPUB/package.opf");
    assertZipContains(docx.bytes, "word/document.xml");
    showDownloads(downloads, [pdf, epub, docx]);
    status.textContent = "Generated valid PDF, EPUB, and DOCX";
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : String(error);
  } finally {
    button.disabled = false;
  }
});

function assertPdf(bytes: Uint8Array): void {
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") {
    throw new Error("The renderer did not return a PDF.");
  }
}

function assertZipContains(bytes: Uint8Array, name: string): void {
  if (!unzipSync(bytes)[name]) {
    throw new Error(`The generated archive does not contain ${name}.`);
  }
}

function showDownloads(
  container: HTMLUListElement,
  outputs: PublishedFile[],
): void {
  container.replaceChildren();
  for (const output of outputs) {
    const filename = `page-foundry-browser-smoke.${output.extension}`;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(
      new Blob([output.bytes.slice().buffer], { type: output.mediaType }),
    );
    link.download = filename;
    link.textContent = `${output.extension.toUpperCase()} (${output.bytes.length} bytes)`;
    const item = document.createElement("li");
    item.append(link);
    container.append(item);
  }
  container.hidden = false;
}
