/*
 * Copyright 2026 Christian Grobmeier
 * Licensed under the Apache License, Version 2.0.
 */

import { App, PluginSettingTab, Setting } from "obsidian";
import type PageFoundryPlugin from "./main";
import type { PageProfileId, PresetId } from "./core/model";

export interface PageFoundrySettings {
  outputFolder: string;
  lastPreset: PresetId;
  lastProfile: PageProfileId;
}

export const DEFAULT_SETTINGS: PageFoundrySettings = {
  outputFolder: "Page Foundry",
  lastPreset: "plain-document",
  lastProfile: "a4",
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
  }
}
