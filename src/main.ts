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
import {
  applyPreset,
  choosePreset,
  initialMetadata,
  type PresetCatalog,
} from "./packs/model";
import { loadVaultPacks } from "./vault/packs";
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
import { preflight } from "./core/preflight";
import { reviewVaultBook } from "./vault/books";

export default class PageFoundryPlugin extends Plugin {
  settings: PageFoundrySettings = { ...DEFAULT_SETTINGS };
  private readonly pdfRenderer = new TypstPdfRenderer();

  async onload(): Promise<void> {
    await this.loadSettings();
    this.addSettingTab(new PageFoundrySettingTab(this.app, this));
    this.addCommand({
      id: "publish-current-book",
      name: "Publish current book",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (file?.extension !== "md") return false;
        if (!checking)
          void this.openExport(file, undefined, true).catch(
            (error) =>
              new Notice(
                error instanceof Error
                  ? error.message
                  : "Could not review the book.",
              ),
          );
        return true;
      },
    });

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
    book = false,
  ): Promise<void> {
    const format = this.settings.lastFormat;
    const preset: PresetId =
      format === "pdf"
        ? this.settings.lastPdfPreset
        : format === "docx"
          ? this.settings.lastDocxPreset
          : this.settings.lastEpubPreset;
    const markdown = book ? "" : await this.app.vault.cachedRead(file);
    const review = book
      ? await reviewVaultBook(this.app, file)
      : await reviewVaultImages(
          this.app,
          file,
          parseMarkdown(markdown, file.basename),
        );
    const document = review.document;
    const catalog = await loadVaultPacks(
      this.app,
      this.settings.packManifestPath,
    );
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
      (choice) =>
        void this.publish(file, choice, review, markdown, catalog, book),
      review,
      (choice) => {
        void this.openExport(file, choice, book).catch(
          () => new Notice("Could not refresh the image review."),
        );
      },
      catalog,
    ).open();
  }

  private async publish(
    file: TFile,
    choice: ExportChoice,
    reviewed: ImageReview,
    reviewedMarkdown: string,
    reviewedCatalog?: PresetCatalog,
    book = false,
  ): Promise<void> {
    const label = choice.format.toUpperCase();
    const progress = new Notice(`Creating ${label} on this device…`, 0);
    try {
      const catalog = await loadVaultPacks(
        this.app,
        this.settings.packManifestPath,
      );
      if (catalog.error) throw new Error(catalog.error);
      if (reviewedCatalog && catalog.signature !== reviewedCatalog.signature) {
        new Notice(
          "The preset pack changed. Review the updated layout before publishing.",
        );
        await this.openExport(file, choice, book);
        return;
      }
      const preset = choosePreset(catalog, choice.preset, choice.format);
      if (book && preset.outputs[choice.format]?.recipe === "letter")
        throw new Error("Letter layouts are not book presets.");
      const markdown = book ? "" : await this.app.vault.cachedRead(file);
      const fresh = book
        ? await reviewVaultBook(this.app, file)
        : await reviewVaultImages(
            this.app,
            file,
            parseMarkdown(markdown, file.basename),
          );
      if (
        markdown !== reviewedMarkdown ||
        fresh.signature !== reviewed.signature ||
        fresh.errors.length
      ) {
        new Notice(
          book
            ? "The book or its included files changed. Review them before publishing."
            : "The note or its images changed. Review the updated files before publishing.",
        );
        await this.openExport(file, choice, book);
        return;
      }
      const values = choice.metadata ?? {
        ...initialMetadata(fresh.document, preset),
        language: choice.language,
      };
      const report = preflight(fresh.document, {
        format: choice.format,
        profile: choice.profile,
        preset,
        metadata: values,
        resourceErrors: fresh.errors,
        resourceWarnings: fresh.warnings,
      });
      const blockers = report.findings.filter(
        (finding) => finding.severity === "blocker",
      );
      if (blockers.length)
        throw new Error(blockers.map((finding) => finding.message).join(" "));
      const outputDocument = applyPreset(
        fresh.document,
        preset,
        choice.format,
        values,
      );
      const output = await this.render(outputDocument, {
        ...choice,
        preset: preset.outputs[choice.format]!.recipe,
        language: outputDocument.metadata.language ?? choice.language,
      });
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
      this.settings.lastPdfPreset = choice.preset;
    } else if (choice.format === "docx") {
      this.settings.lastDocxPreset = choice.preset;
    } else {
      this.settings.lastEpubPreset = choice.preset;
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
