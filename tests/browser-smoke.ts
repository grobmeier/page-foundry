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
import { decodeImage, resolveImages } from "../src/core/images";
import { fixturePng } from "./fixtures/images";

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

![Blue and gold landscape](landscape.png)

## Portrait JPEG

![Blue and gold portrait](portrait.jpg)

## Sized repeat

![[landscape.png|300]]

The landscape repeats below as a reference-style image. Neither the note nor
its original images are changed by publishing.

![Landscape repeat][panel]

[panel]: landscape.png
`;
    const canvas = window.document.createElement("canvas");
    canvas.width = 240;
    canvas.height = 480;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#1c5278";
    context.fillRect(0, 0, 240, 240);
    context.fillStyle = "#ebb03a";
    context.fillRect(0, 240, 240, 240);
    const jpeg = Uint8Array.from(
      atob(canvas.toDataURL("image/jpeg", 0.9).split(",")[1]!),
      (char) => char.charCodeAt(0),
    );
    const png = fixturePng();
    const review = await resolveImages(
      parseMarkdown(markdown, "Page Foundry"),
      {
        resolve(path) {
          const bytes = path === "landscape.png" ? png : jpeg;
          return {
            path,
            size: bytes.length,
            async read() {
              return bytes;
            },
          };
        },
        decode: decodeImage,
      },
    );
    if (review.errors.length) throw new Error(review.errors.join("; "));
    const document = review.document;
    const renderer = new TypstPdfRenderer();
    const pdf: PublishedFile = {
      bytes: await renderer.render(document, "plain-document", "a4"),
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
    assertZipContains(epub.bytes, "EPUB/images/image-1.png");
    assertZipContains(epub.bytes, "EPUB/images/image-2.jpg");
    assertZipContains(docx.bytes, "word/document.xml");
    showDownloads(downloads, [pdf, epub, docx]);
    // A later image-free export must work without stale mapped assets.
    assertPdf(
      await renderer.render(
        parseMarkdown("No images in this export.", "Clean"),
        "plain-document",
        "a4",
      ),
    );
    status.textContent =
      "Generated valid PDF, EPUB, and DOCX with PNG/JPEG images; clean repeat passed";
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
