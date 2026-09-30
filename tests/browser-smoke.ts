/*
 * Copyright 2026 Christian Grobmeier
 * Licensed under the Apache License, Version 2.0.
 */

import { parseMarkdown } from "../src/core/markdown";
import { TypstPdfRenderer } from "../src/pdf/renderer";

const button = document.querySelector<HTMLButtonElement>("#generate");
const status = document.querySelector<HTMLParagraphElement>("#status");
const download = document.querySelector<HTMLAnchorElement>("#download");
if (!button || !status || !download)
  throw new Error("Browser smoke controls are missing.");

button.addEventListener("click", async () => {
  button.disabled = true;
  status.textContent = "Generating";
  try {
    const markdown = `---
title: Page Foundry
author: Alex Example
---

# Portable publishing

This PDF was generated **on this device** with an embedded compiler and font.
`;
    const bytes = await new TypstPdfRenderer().render(
      parseMarkdown(markdown, "Page Foundry"),
      "plain-document",
      "a4",
    );
    const signature = new TextDecoder().decode(bytes.slice(0, 5));
    if (signature !== "%PDF-")
      throw new Error("The renderer did not return a PDF.");
    download.href = URL.createObjectURL(
      new Blob([bytes.slice().buffer], { type: "application/pdf" }),
    );
    download.textContent = `Download PDF (${bytes.length} bytes)`;
    download.hidden = false;
    status.textContent = "Generated valid PDF";
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : String(error);
  } finally {
    button.disabled = false;
  }
});
