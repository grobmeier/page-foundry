/*
 * Copyright 2026 Christian Grobmeier
 * Licensed under the Apache License, Version 2.0.
 */

import { App, ButtonComponent, Modal, Notice } from "obsidian";
import type { PublishedFile } from "../core/model";
import { savedFileActions } from "./fileActions";

export class ResultModal extends Modal {
  private saving = false;
  constructor(
    app: App,
    private readonly filename: string,
    private readonly output: PublishedFile,
    private readonly saveInVault: () => Promise<string>,
    private savedPath?: string,
  ) {
    super(app);
  }

  onOpen(): void {
    this.modalEl.addClass("page-foundry-modal");
    this.render();
  }

  private render(): void {
    this.contentEl.empty();
    const label = this.output.extension.toUpperCase();
    this.contentEl.createEl("h2", { text: `${label} ready` });
    this.contentEl.createEl("p", {
      text: this.savedPath
        ? "Saved in your vault:"
        : "Choose where the finished file should go.",
    });
    this.contentEl.createEl("p", {
      text: this.savedPath ?? this.filename,
      cls: "page-foundry-result-path",
    });
    if (this.savedPath && this.output.extension !== "pdf") {
      this.contentEl.createEl("p", {
        text: "Obsidian may hide this file type in its sidebar. The file is saved; use the actions below to access it.",
      });
    }
    const actions = this.contentEl.createDiv({
      cls: "page-foundry-result-actions",
    });

    const shareFile = new File(
      [this.output.bytes.slice().buffer],
      this.savedPath?.split("/").at(-1) ?? this.filename,
      { type: this.output.mediaType },
    );
    if (canShareFile(shareFile))
      new ButtonComponent(actions)
        .setButtonText("Share or save elsewhere")
        .setCta()
        .onClick(async () => {
          try {
            await navigator.share({
              files: [shareFile],
              title: shareFile.name,
            });
          } catch (error) {
            new Notice(readableError(error, label));
          }
        });

    if (!this.savedPath)
      new ButtonComponent(actions)
        .setButtonText("Save in vault")
        .onClick(async () => {
          if (this.savedPath || this.saving) return;
          this.saving = true;
          try {
            // Disable before awaiting so a second click cannot save another copy.
            actions.querySelectorAll("button").forEach((button) => {
              button.disabled = true;
            });
            const path = await this.saveInVault();
            this.savedPath = path;
            this.render();
          } catch (error) {
            this.render();
            new Notice(readableError(error, label));
          } finally {
            this.saving = false;
          }
        });

    const hostActions = this.savedPath
      ? savedFileActions(this.app, this.savedPath)
      : undefined;
    if (hostActions) {
      new ButtonComponent(actions)
        .setButtonText("Open in default app")
        .onClick(async () => {
          try {
            await hostActions.open();
          } catch (error) {
            new Notice(readableError(error, label));
          }
        });
      new ButtonComponent(actions)
        .setButtonText("Show in folder")
        .onClick(() => {
          try {
            hostActions.reveal();
          } catch (error) {
            new Notice(readableError(error, label));
          }
        });
    }
    new ButtonComponent(actions)
      .setButtonText("Done")
      .onClick(() => this.close());
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

function canShareFile(file: File): boolean {
  try {
    return (
      typeof navigator.share === "function" &&
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [file] })
    );
  } catch {
    return false;
  }
}

function readableError(error: unknown, label: string): string {
  if (error instanceof DOMException && error.name === "AbortError")
    return "Sharing cancelled.";
  return error instanceof Error
    ? error.message
    : `The ${label} could not be shared.`;
}
