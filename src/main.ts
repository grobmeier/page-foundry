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
import type {
  DocxPresetId,
  FoundryDocument,
  PdfPresetId,
  PresetId,
  PublishedFile,
} from "./core/model";
import { presetSupportsFormat } from "./core/model";
import { safeOutputName } from "./core/naming";
import { TypstPdfRenderer } from "./pdf/renderer";
import {
  DEFAULT_SETTINGS,
  PageFoundrySettingTab,
  type PageFoundrySettings,
} from "./settings";
import { ExportModal, type ExportChoice } from "./ui/exportModal";
import { ResultModal } from "./ui/resultModal";
import { saveOutput } from "./vault/output";
import { reviewVaultImages } from "./vault/images";
import type { ImageReview } from "./core/images";

export default class PageFoundryPlugin extends Plugin {
  settings: PageFoundrySettings = { ...DEFAULT_SETTINGS };
  private readonly pdfRenderer = new TypstPdfRenderer();

  async onload(): Promise<void> {
    await this.loadSettings();
    this.addSettingTab(new PageFoundrySettingTab(this.app, this));

    this.addCommand({
      id: "publish-current-note",
      name: "Publish current note",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        const available = Boolean(file?.extension === "md");
        if (available && !checking && file) {
          void this.openExport(file).catch(() => {
            console.error("Page Foundry could not read the active note");
            new Notice("Page Foundry could not read the active note.");
          });
        }
        return available;
      },
    });
  }

  async loadSettings(): Promise<void> {
    const stored = (await this.loadData()) as
      | (Partial<PageFoundrySettings> & { lastPreset?: PdfPresetId })
      | null;
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...stored,
      lastPdfPreset:
        stored?.lastPdfPreset ??
        stored?.lastPreset ??
        DEFAULT_SETTINGS.lastPdfPreset,
    };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  private async openExport(
    file: TFile,
    previousChoice?: ExportChoice,
  ): Promise<void> {
    const format = this.settings.lastFormat;
    const preset: PresetId =
      format === "pdf"
        ? this.settings.lastPdfPreset
        : format === "docx"
          ? this.settings.lastDocxPreset
          : "reflowable-ebook";
    const markdown = await this.app.vault.cachedRead(file);
    const document = parseMarkdown(markdown, file.basename);
    const review = await reviewVaultImages(this.app, file, document);
    const initial: ExportChoice = {
      format,
      preset,
      profile: this.settings.lastProfile,
      outputName: file.basename,
      language:
        document.metadata.language ??
        document.metadata.lang ??
        this.settings.defaultLanguage,
      destination: "vault",
    };
    new ExportModal(
      this.app,
      previousChoice ?? initial,
      (choice) => void this.publish(file, choice, review, markdown),
      review,
      (choice) => {
        void this.openExport(file, choice).catch(
          () => new Notice("Could not refresh the image review."),
        );
      },
    ).open();
  }

  private async publish(
    file: TFile,
    choice: ExportChoice,
    reviewed: ImageReview,
    reviewedMarkdown: string,
  ): Promise<void> {
    const label = choice.format.toUpperCase();
    const progress = new Notice(`Creating ${label} on this device…`, 0);
    try {
      if (!presetSupportsFormat(choice.preset, choice.format)) {
        throw new Error(
          "The selected preset does not support this output format.",
        );
      }
      const markdown = await this.app.vault.cachedRead(file);
      const document = parseMarkdown(markdown, file.basename);
      const fresh = await reviewVaultImages(this.app, file, document);
      if (
        markdown !== reviewedMarkdown ||
        fresh.signature !== reviewed.signature ||
        fresh.errors.length
      ) {
        new Notice(
          "The note or its images changed. Review the updated files before publishing.",
        );
        await this.openExport(file, choice);
        return;
      }
      const output = await this.render(fresh.document, choice);
      const filename = safeOutputName(choice.outputName, output.extension);

      this.rememberChoice(choice);
      await this.saveSettings();

      if (choice.destination === "vault") {
        const path = await this.saveToVault(filename, output);
        new ResultModal(
          this.app,
          filename,
          output,
          () => this.saveToVault(filename, output),
          path,
        ).open();
      } else {
        new ResultModal(this.app, filename, output, () =>
          this.saveToVault(filename, output),
        ).open();
      }
    } catch (error) {
      console.error(`Page Foundry could not create the ${label}`);
      new Notice(
        error instanceof Error
          ? error.message
          : `Page Foundry could not create the ${label}.`,
      );
    } finally {
      progress.hide();
    }
  }

  private rememberChoice(choice: ExportChoice): void {
    this.settings.lastFormat = choice.format;
    this.settings.lastProfile = choice.profile;
    if (choice.format === "pdf") {
      this.settings.lastPdfPreset = choice.preset as PdfPresetId;
    } else if (choice.format === "docx") {
      this.settings.lastDocxPreset = choice.preset as DocxPresetId;
    } else {
      this.settings.defaultLanguage = choice.language;
    }
  }

  private async render(
    document: FoundryDocument,
    choice: ExportChoice,
  ): Promise<PublishedFile> {
    switch (choice.format) {
      case "pdf":
        return {
          bytes: await this.pdfRenderer.render(
            document,
            choice.preset as PdfPresetId,
            choice.profile,
          ),
          extension: "pdf",
          mediaType: "application/pdf",
        };
      case "epub": {
        const { EpubRenderer } = await import("./epub/renderer");
        return new EpubRenderer().render(document, {
          language: choice.language,
        });
      }
      case "docx": {
        const { DocxRenderer } = await import("./docx/renderer");
        return new DocxRenderer().render(
          document,
          choice.preset as DocxPresetId,
          choice.profile,
        );
      }
    }
  }

  private saveToVault(
    filename: string,
    output: PublishedFile,
  ): Promise<string> {
    return saveOutput(
      this.app.vault,
      this.settings.outputFolder,
      filename,
      output.extension,
      output.bytes,
    );
  }
}
