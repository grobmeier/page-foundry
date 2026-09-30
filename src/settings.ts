/*
 * Copyright 2026 Christian Grobmeier
 * Licensed under the Apache License, Version 2.0.
 */

import { App, PluginSettingTab, Setting } from "obsidian";
import type PageFoundryPlugin from "./main";
import type {
  DocxPresetId,
  OutputFormat,
  PageProfileId,
  PdfPresetId,
} from "./core/model";

export interface PageFoundrySettings {
  outputFolder: string;
  lastFormat: OutputFormat;
  lastPdfPreset: PdfPresetId;
  lastDocxPreset: DocxPresetId;
  lastProfile: PageProfileId;
  defaultLanguage: string;
}

export const DEFAULT_SETTINGS: PageFoundrySettings = {
  outputFolder: "Page Foundry",
  lastFormat: "pdf",
  lastPdfPreset: "plain-document",
  lastDocxPreset: "plain-editable",
  lastProfile: "a4",
  defaultLanguage: "en",
};

export class PageFoundrySettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly plugin: PageFoundryPlugin,
  ) {
    super(app, plugin);
  }

  display(): void {
    this.containerEl.empty();

    new Setting(this.containerEl)
      .setName("Output folder")
      .setDesc("Vault-relative folder used by Save in vault.")
      .addText((text) =>
        text
          .setValue(this.plugin.settings.outputFolder)
          .onChange(async (value) => {
            this.plugin.settings.outputFolder =
              value.trim() || DEFAULT_SETTINGS.outputFolder;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(this.containerEl)
      .setName("Default publication language")
      .setDesc(
        "BCP 47 language tag used for EPUB when a note has no language or lang property.",
      )
      .addText((text) =>
        text
          .setPlaceholder("en")
          .setValue(this.plugin.settings.defaultLanguage)
          .onChange(async (value) => {
            this.plugin.settings.defaultLanguage = value.trim() || "en";
            await this.plugin.saveSettings();
          }),
      );
  }
}
