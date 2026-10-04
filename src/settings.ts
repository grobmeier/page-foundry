/*
 * Copyright 2026 Christian Grobmeier
 * Licensed under the Apache License, Version 2.0.
 */

import { App, PluginSettingTab, Setting } from "obsidian";
import type PageFoundryPlugin from "./main";
import type { OutputFormat, PageProfileId } from "./core/model";
import type { TemplateUse } from "./templates/catalog";

export interface PageFoundrySettings {
  outputFolder: string;
  lastFormat: OutputFormat;
  lastPdfPreset: string;
  lastDocxPreset: string;
  lastEpubPreset: string;
  packManifestPath: string;
  lastProfile: PageProfileId;
  defaultLanguage: string;
  templateHistory: TemplateUse[];
}

export const DEFAULT_SETTINGS: PageFoundrySettings = {
  outputFolder: "Page Foundry",
  lastFormat: "pdf",
  lastPdfPreset: "plain-document",
  lastDocxPreset: "plain-editable",
  lastEpubPreset: "reflowable-ebook",
  lastProfile: "a4",
  defaultLanguage: "en",
  packManifestPath: "",
  templateHistory: [],
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
      .setName("Your template pack (optional)")
      .setDesc(
        "Path to your private design pack inside this vault, for example Designs/my-pack.json. Leave empty for built-in templates. No folders are scanned.",
      )
      .addText((text) =>
        text
          .setValue(this.plugin.settings.packManifestPath)
          .onChange(async (value) => {
            this.plugin.settings.packManifestPath = value.trim();
            await this.plugin.saveSettings();
          }),
      );

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
        "Used when the note or template has no language. Examples: en, en-GB, de.",
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
    new Setting(this.containerEl)
      .setName("Recent and most-used templates")
      .setDesc(
        "Only layout choices are remembered, never publication details or manuscript text.",
      )
      .addButton((button) =>
        button.setButtonText("Clear history").onClick(async () => {
          this.plugin.settings.templateHistory = [];
          await this.plugin.saveSettings();
        }),
      );
  }
}
