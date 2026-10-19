/*
 * Copyright 2026 Christian Grobmeier
 * Licensed under the Apache License, Version 2.0.
 */

import { App, PluginSettingTab, Setting } from "obsidian";
import type PageFoundryPlugin from "./main";
import type { OutputFormat, PageProfileId } from "./core/model";
import type { TemplateUse } from "./templates/catalog";
import type { NoteLayout } from "./templates/preferred";

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
  noteTemplateHistory: TemplateUse[];
  noteFolder: string;
  noteTemplatePaths: string[];
  noteLayouts: NoteLayout[];
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
  noteTemplateHistory: [],
  noteFolder: "",
  noteTemplatePaths: [],
  noteLayouts: [],
};

export class PageFoundrySettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly plugin: PageFoundryPlugin,
  ) {
    super(app, plugin);
  }

  /** 1.13+ indexes/renders these rows; older hosts use display() below. */
  getSettingDefinitions(): {
    name: string;
    desc: string;
    render(setting: Setting): void;
  }[] {
    return [
      {
        name: "Manage designs",
        desc: "Create or edit your private local layouts using a form, without writing JSON.",
        render: (setting) => {
          setting.addButton((b) =>
            b
              .setButtonText("Open designs")
              .onClick(() => this.plugin.openDesigns()),
          );
        },
      },
      {
        name: "Your output preset pack (optional)",
        desc: "Exact path to your private output designs, for example Designs/my-pack.json. This controls layouts, not starting note text. No folders are scanned.",
        render: (setting) => {
          setting.addText((text) =>
            text
              .setValue(this.plugin.settings.packManifestPath)
              .onChange(async (value) => {
                this.plugin.settings.packManifestPath = value.trim();
                await this.plugin.saveSettings();
              }),
          );
        },
      },
      {
        name: "New-note folder",
        desc: "Default folder for Create new note. Empty means the vault’s top level; generated files use the separate output folder.",
        render: (setting) => {
          setting.addText((t) =>
            t
              .setValue(this.plugin.settings.noteFolder)
              .onChange(async (value) => {
                this.plugin.settings.noteFolder = value.trim();
                await this.plugin.saveSettings();
              }),
          );
        },
      },
      {
        name: "Private note templates",
        desc: "One exact Markdown path per line, at most 30. Only these files are read. Edit their Markdown to change starting text and properties, or use Save as note template. Removing a path does not delete the file.",
        render: (setting) => {
          setting.addTextArea((t) =>
            t
              .setValue(this.plugin.settings.noteTemplatePaths.join("\n"))
              .onChange(async (value) => {
                this.plugin.settings.noteTemplatePaths = value
                  .split(/\r?\n/)
                  .map((v) => v.trim())
                  .filter(Boolean);
                await this.plugin.saveSettings();
              }),
          );
        },
      },
      {
        name: "Output folder",
        desc: "Vault-relative folder used by Save in vault.",
        render: (setting) => {
          setting.addText((text) =>
            text
              .setValue(this.plugin.settings.outputFolder)
              .onChange(async (value) => {
                this.plugin.settings.outputFolder =
                  value.trim() || DEFAULT_SETTINGS.outputFolder;
                await this.plugin.saveSettings();
              }),
          );
        },
      },
      {
        name: "Default publication language",
        desc: "Used when the note or template has no language. Examples: en, en-GB, de.",
        render: (setting) => {
          setting.addText((text) =>
            text
              .setPlaceholder("en")
              .setValue(this.plugin.settings.defaultLanguage)
              .onChange(async (value) => {
                this.plugin.settings.defaultLanguage = value.trim() || "en";
                await this.plugin.saveSettings();
              }),
          );
        },
      },
      {
        name: "Recent and most-used templates",
        desc: "Clears recent starters/layouts and each note’s saved layout choice. No writing or address information is stored in these choices.",
        render: (setting) => {
          setting.addButton((button) =>
            button.setButtonText("Clear history").onClick(async () => {
              this.plugin.settings.templateHistory = [];
              this.plugin.settings.noteTemplateHistory = [];
              this.plugin.settings.noteLayouts = [];
              await this.plugin.saveSettings();
            }),
          );
        },
      },
    ];
  }

  display(): void {
    this.containerEl.empty();
    for (const definition of this.getSettingDefinitions()) {
      const setting = new Setting(this.containerEl)
        .setName(definition.name)
        .setDesc(definition.desc);
      definition.render(setting);
    }
  }
}
