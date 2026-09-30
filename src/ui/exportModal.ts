/*
 * Copyright 2026 Christian Grobmeier
 * Licensed under the Apache License, Version 2.0.
 */

import { App, Modal, Setting } from "obsidian";
import {
  defaultPreset,
  presetSupportsFormat,
  type OutputFormat,
  type PageProfileId,
  type PresetId,
  type PublishRequest,
} from "../core/model";

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
    this.render();
  }

  private render(): void {
    this.contentEl.empty();
    this.contentEl.createEl("h2", { text: "Publish current note" });

    new Setting(this.contentEl)
      .setName("Output format")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("pdf", "PDF")
          .addOption("epub", "EPUB")
          .addOption("docx", "DOCX")
          .setValue(this.choice.format)
          .onChange((value) => {
            this.choice.format = value as OutputFormat;
            if (!presetSupportsFormat(this.choice.preset, this.choice.format)) {
              this.choice.preset = defaultPreset(this.choice.format);
            }
            this.render();
          }),
      );

    new Setting(this.contentEl).setName("Preset").addDropdown((dropdown) => {
      for (const [id, label] of presetOptions(this.choice.format)) {
        dropdown.addOption(id, label);
      }
      return dropdown.setValue(this.choice.preset).onChange((value) => {
        this.choice.preset = value as PresetId;
      });
    });

    if (this.choice.format !== "epub") {
      new Setting(this.contentEl).setName("Page size").addDropdown((dropdown) =>
        dropdown
          .addOption("a4", "A4")
          .addOption("us-letter", "US Letter")
          .setValue(this.choice.profile)
          .onChange((value) => {
            this.choice.profile = value as PageProfileId;
          }),
      );
    } else {
      new Setting(this.contentEl)
        .setName("Publication language")
        .setDesc("BCP 47 language tag, for example en, en-GB, or de.")
        .addText((text) =>
          text.setValue(this.choice.language).onChange((value) => {
            this.choice.language = value.trim();
          }),
        );
    }

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
        .setButtonText(`Create ${this.choice.format.toUpperCase()}`)
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

function presetOptions(format: OutputFormat): Array<[PresetId, string]> {
  switch (format) {
    case "pdf":
      return [
        ["plain-document", "Plain document"],
        ["letter", "Letter"],
      ];
    case "epub":
      return [["reflowable-ebook", "Reflowable ebook"]];
    case "docx":
      return [
        ["plain-editable", "Plain editable document"],
        ["general-manuscript", "General manuscript"],
      ];
  }
}
