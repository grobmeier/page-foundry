/*
 * Copyright 2026 Christian Grobmeier
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Notice, Plugin, type TFile } from "obsidian";
import { parseMarkdown } from "./core/markdown";
import { safePdfName } from "./core/naming";
import { TypstPdfRenderer } from "./pdf/renderer";
import {
  DEFAULT_SETTINGS,
  PageFoundrySettingTab,
  type PageFoundrySettings,
} from "./settings";
import { ExportModal, type ExportChoice } from "./ui/exportModal";
import { ResultModal } from "./ui/resultModal";
import { savePdf } from "./vault/output";

export default class PageFoundryPlugin extends Plugin {
  settings: PageFoundrySettings = { ...DEFAULT_SETTINGS };
  private readonly renderer = new TypstPdfRenderer();

  async onload(): Promise<void> {
    await this.loadSettings();
    this.addSettingTab(new PageFoundrySettingTab(this.app, this));

    this.addCommand({
      id: "publish-current-note",
      name: "Publish current note",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        const available = Boolean(file?.extension === "md");
        if (available && !checking && file) this.openExport(file);
        return available;
      },
    });
  }

  async loadSettings(): Promise<void> {
    this.settings = { ...DEFAULT_SETTINGS, ...(await this.loadData()) };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  private openExport(file: TFile): void {
    const initial: ExportChoice = {
      preset: this.settings.lastPreset,
      profile: this.settings.lastProfile,
      outputName: safePdfName(file.basename),
      destination: "vault",
    };
    new ExportModal(
      this.app,
      initial,
      (choice) => void this.publish(file, choice),
    ).open();
  }

  private async publish(file: TFile, choice: ExportChoice): Promise<void> {
    const progress = new Notice("Creating PDF on this device…", 0);
    try {
      this.settings.lastPreset = choice.preset;
      this.settings.lastProfile = choice.profile;
      await this.saveSettings();

      const markdown = await this.app.vault.cachedRead(file);
      const document = parseMarkdown(markdown, file.basename);
      const pdf = await this.renderer.render(
        document,
        choice.preset,
        choice.profile,
      );
      const filename = safePdfName(choice.outputName);

      if (choice.destination === "vault") {
        const path = await this.saveToVault(filename, pdf);
        new Notice(`Saved ${path}`);
      } else {
        new ResultModal(this.app, filename, pdf, () =>
          this.saveToVault(filename, pdf),
        ).open();
      }
    } catch (error) {
      console.error("Page Foundry could not create the PDF", error);
      new Notice(
        error instanceof Error
          ? error.message
          : "Page Foundry could not create the PDF.",
      );
    } finally {
      progress.hide();
    }
  }

  private saveToVault(filename: string, pdf: Uint8Array): Promise<string> {
    return savePdf(this.app.vault, this.settings.outputFolder, filename, pdf);
  }
}
