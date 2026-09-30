/*
 * Copyright 2026 Christian Grobmeier
 * Licensed under the Apache License, Version 2.0.
 */

import { App, ButtonComponent, Modal, Notice } from "obsidian";

export class ResultModal extends Modal {
  constructor(
    app: App,
    private readonly filename: string,
    private readonly pdf: Uint8Array,
    private readonly saveInVault: () => Promise<string>,
  ) {
    super(app);
  }

  onOpen(): void {
    this.modalEl.addClass("page-foundry-modal");
    this.contentEl.createEl("h2", { text: "PDF ready" });
    this.contentEl.createEl("p", {
      text: "Choose where the finished file should go.",
    });
    const actions = this.contentEl.createDiv({
      cls: "page-foundry-result-actions",
    });

    new ButtonComponent(actions)
      .setButtonText("Share or save elsewhere")
      .setCta()
      .onClick(async () => {
        try {
          await sharePdf(this.filename, this.pdf);
        } catch (error) {
          new Notice(readableError(error));
        }
      });

    new ButtonComponent(actions)
      .setButtonText("Save in vault")
      .onClick(async () => {
        try {
          const path = await this.saveInVault();
          new Notice(`Saved ${path}`);
          this.close();
        } catch (error) {
          new Notice(readableError(error));
        }
      });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

async function sharePdf(filename: string, bytes: Uint8Array): Promise<void> {
  const file = new File([bytes.slice().buffer], filename, {
    type: "application/pdf",
  });
  if (
    !navigator.share ||
    (navigator.canShare && !navigator.canShare({ files: [file] }))
  ) {
    throw new Error(
      "This device does not expose file sharing here. Use Save in vault instead.",
    );
  }
  await navigator.share({ files: [file], title: filename });
}

function readableError(error: unknown): string {
  if (error instanceof DOMException && error.name === "AbortError")
    return "Sharing cancelled.";
  return error instanceof Error
    ? error.message
    : "The PDF could not be shared.";
}
