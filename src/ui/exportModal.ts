/*
 * Copyright 2026 Christian Grobmeier
 * Licensed under the Apache License, Version 2.0.
 */

import { App, Modal, Setting } from "obsidian";
import type { PageProfileId, PresetId, PublishRequest } from "../core/model";

export type Destination = "vault" | "share";

export interface ExportChoice extends PublishRequest {
  destination: Destination;
}

export class ExportModal extends Modal {
  private choice: ExportChoice;

  constructor(
    app: App,
    initial: ExportChoice,
    private readonly onPublish: (choice: ExportChoice) => void,
  ) {
    super(app);
    this.choice = { ...initial };
  }

  onOpen(): void {
    this.modalEl.addClass("page-foundry-modal");
    this.contentEl.createEl("h2", { text: "Publish current note" });

    new Setting(this.contentEl).setName("Preset").addDropdown((dropdown) =>
      dropdown
        .addOption("plain-document", "Plain document")
        .addOption("letter", "Letter")
        .setValue(this.choice.preset)
        .onChange((value) => {
          this.choice.preset = value as PresetId;
        }),
    );

    new Setting(this.contentEl).setName("Page size").addDropdown((dropdown) =>
      dropdown
        .addOption("a4", "A4")
        .addOption("us-letter", "US Letter")
        .setValue(this.choice.profile)
        .onChange((value) => {
          this.choice.profile = value as PageProfileId;
        }),
    );

    new Setting(this.contentEl).setName("File name").addText((text) =>
      text.setValue(this.choice.outputName).onChange((value) => {
        this.choice.outputName = value;
      }),
    );

    new Setting(this.contentEl)
      .setName("Destination")
      .setDesc(
        "Use the system share sheet for Files, iCloud Drive, Dropbox, and other installed apps.",
      )
      .addDropdown((dropdown) =>
        dropdown
          .addOption("vault", "Save in vault")
          .addOption("share", "Share or save elsewhere")
          .setValue(this.choice.destination)
          .onChange((value) => {
            this.choice.destination = value as Destination;
          }),
      );

    new Setting(this.contentEl).addButton((button) =>
      button
        .setButtonText("Create PDF")
        .setCta()
        .onClick(() => {
          this.close();
          this.onPublish({ ...this.choice });
        }),
    );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
