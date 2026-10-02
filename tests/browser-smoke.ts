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
import neutralPack from "../examples/neutral-pack/page-foundry-pack.json";
import { CORE_PACK } from "../src/packs/core";
import { preflight, reportText } from "../src/core/preflight";
import { assembleBook } from "../src/books/assemble";
import { parseBookManifest } from "../src/books/manifest";
import { bookManifest, bookNotes } from "./fixtures/book";
import {
  applyPreset,
  catalogue,
  choosePreset,
  initialMetadata,
  parsePack,
} from "../src/packs/model";

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

Return to [portable publishing](#portable-publishing).
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
    const book = assembleBook(
      parseBookManifest(bookManifest),
      new Map(
        Object.entries(bookNotes).map(([path, raw]) => [
          path,
          parseMarkdown(raw, path),
        ]),
      ),
    );
    const bookPdf: PublishedFile = {
      bytes: await renderer.render(book, "manuscript", "a4"),
      extension: "pdf",
      mediaType: "application/pdf",
    };
    const bookEpub = new EpubRenderer().render(book, { language: "en-GB" });
    const bookDocx = await new DocxRenderer().render(
      book,
      "general-manuscript",
      "a4",
    );
    assertPdf(bookPdf.bytes);
    showDownloads(
      downloads,
      [bookPdf, bookEpub, bookDocx],
      "ordered-book",
      false,
    );
    const catalog = catalogue(
      [CORE_PACK, parsePack(JSON.stringify(neutralPack))],
      "browser",
    );
    const ebookPreset = choosePreset(catalog, "reflowable-ebook", "epub");
    const report = preflight(document, {
      format: "epub",
      profile: "a4",
      preset: ebookPreset,
      metadata: initialMetadata(document, ebookPreset),
      resourceErrors: review.errors,
      resourceWarnings: review.warnings,
    });
    if (report.findings.some((finding) => finding.severity === "blocker"))
      throw new Error(reportText(report));
    const reportElement = window.document.querySelector("#preflight");
    if (reportElement) reportElement.textContent = reportText(report);
    const broken = parseMarkdown("# Chapter\n\n[Broken](#missing)", "Broken");
    if (
      !preflight(broken, {
        format: "epub",
        profile: "a4",
        preset: ebookPreset,
        metadata: { ...initialMetadata(broken, ebookPreset), language: "en" },
      }).findings.some(
        (finding) =>
          finding.code === "heading-link" && finding.severity === "blocker",
      )
    )
      throw new Error("Broken-link preflight did not block.");
    const manuscript = choosePreset(catalog, "general-manuscript", "pdf");
    const manuscriptDocument = applyPreset(
      document,
      manuscript,
      "pdf",
      initialMetadata(document, manuscript),
    );
    const manuscriptPdf: PublishedFile = {
      bytes: await renderer.render(manuscriptDocument, "manuscript", "a4"),
      extension: "pdf",
      mediaType: "application/pdf",
    };
    assertPdf(manuscriptPdf.bytes);
    showDownloads(downloads, [manuscriptPdf], "manuscript", false);
    const letterPreset = choosePreset(catalog, "submission-letter", "pdf");
    const letterDocument = applyPreset(document, letterPreset, "pdf", {
      ...initialMetadata(document, letterPreset),
      to: "Jamie Example",
      subject: "A portable submission",
    });
    const letterPdf: PublishedFile = {
      bytes: await renderer.render(letterDocument, "letter", "a4"),
      extension: "pdf",
      mediaType: "application/pdf",
    };
    assertPdf(letterPdf.bytes);
    showDownloads(downloads, [letterPdf], "submission-letter", false);
    const custom = choosePreset(catalog, "neutral-example:studio-proof", "pdf");
    const values = initialMetadata(document, custom);
    const customPdf: PublishedFile = {
      bytes: await renderer.render(
        applyPreset(document, custom, "pdf", values),
        "plain-document",
        "us-letter",
      ),
      extension: "pdf",
      mediaType: "application/pdf",
    };
    const customDocx = await new DocxRenderer().render(
      applyPreset(document, custom, "docx", values),
      "plain-editable",
      "us-letter",
    );
    const customEpub = new EpubRenderer().render(
      applyPreset(document, custom, "epub", values),
      { language: "en" },
    );
    assertPdf(customPdf.bytes);
    showDownloads(
      downloads,
      [customPdf, customDocx, customEpub],
      "custom-pack",
      false,
    );
    // A later image-free export must work without stale mapped assets.
    assertPdf(
      await renderer.render(
        parseMarkdown("No images in this export.", "Clean"),
        "plain-document",
        "a4",
      ),
    );
    status.textContent =
      "Generated PDF, EPUB, DOCX, manuscript and custom pack outputs; valid heading link, blocked broken link and clean repeat passed";
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
  name = "browser-smoke",
  clear = true,
): void {
  if (clear) container.replaceChildren();
  for (const output of outputs) {
    const filename = `page-foundry-${name}.${output.extension}`;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(
      new Blob([output.bytes.slice().buffer], { type: output.mediaType }),
    );
    link.download = filename;
    link.textContent = `${name} ${output.extension.toUpperCase()} (${output.bytes.length} bytes)`;
    const item = document.createElement("li");
    item.append(link);
    container.append(item);
  }
  container.hidden = false;
}
