/*
 * Copyright 2026 Christian Grobmeier
 * Licensed under the Apache License, Version 2.0.
 */

import { App, Modal, Notice, Setting } from "obsidian";
import {
  type OutputFormat,
  type PageProfileId,
  type PublishRequest,
} from "../core/model";
import type { ImageReview } from "../core/images";
import { CORE_CATALOG } from "../packs/core";
import {
  choosePreset,
  initialMetadata,
  type PresetCatalog,
} from "../packs/model";
import { preflight, reportText, type PreflightReport } from "../core/preflight";

export type Destination = "vault" | "share";

export interface ExportChoice extends PublishRequest {
  destination: Destination;
  metadata?: Record<string, string>;
}

export class ExportModal extends Modal {
  private choice: ExportChoice;

  constructor(
    app: App,
    initial: ExportChoice,
    private readonly onPublish: (choice: ExportChoice) => void,
    private readonly review: ImageReview,
    private readonly onRefresh: (choice: ExportChoice) => void,
    private readonly catalog: PresetCatalog = CORE_CATALOG,
  ) {
    super(app);
    this.choice = {
      ...initial,
      metadata: initial.metadata ? { ...initial.metadata } : undefined,
    };
    this.selectPreset(false);
  }

  private selectPreset(reset: boolean): void {
    const compatible = this.catalog.presets.filter(
      (p) =>
        p.outputs[this.choice.format] &&
        (!this.review.document.book ||
          p.outputs[this.choice.format]?.recipe !== "letter"),
    );
    if (!compatible.some((p) => p.selectionId === this.choice.preset)) {
      this.choice.preset = compatible[0]!.selectionId;
      reset = true;
    }
    const preset = choosePreset(
      this.catalog,
      this.choice.preset,
      this.choice.format,
    );
    if (reset || !this.choice.metadata)
      this.choice.metadata = initialMetadata(this.review.document, preset);
    if (!this.choice.metadata.language)
      this.choice.metadata.language =
        this.review.document.metadata.language ??
        this.review.document.metadata.lang ??
        this.choice.language;
  }

  private errors(): string[] {
    return this.report()
      .findings.filter((finding) => finding.severity === "blocker")
      .map((finding) => finding.message);
  }

  private report(): PreflightReport {
    return preflight(this.review.document, {
      format: this.choice.format,
      profile: this.choice.profile,
      preset: choosePreset(
        this.catalog,
        this.choice.preset,
        this.choice.format,
      ),
      metadata: this.choice.metadata!,
      resourceErrors: this.review.errors,
      resourceWarnings: this.review.warnings,
      packError: this.catalog.error,
    });
  }

  onOpen(): void {
    this.modalEl.addClass("page-foundry-modal");
    this.render();
  }

  private render(): void {
    this.contentEl.empty();
    this.contentEl.createEl("h2", {
      text: this.review.document.book
        ? "Publish current book"
        : "Publish current note",
    });
    if (this.review.document.book) {
      this.contentEl.createEl("h3", { text: "Inclusion and order" });
      this.review.document.book.entries.forEach((entry, index) =>
        this.contentEl.createEl("p", {
          text: `${index + 1}. ${entry.role} — ${entry.title} — ${entry.path ?? "heading only"}`,
        }),
      );
      new Setting(this.contentEl).addButton((button) =>
        button.setButtonText("Refresh book review").onClick(() => {
          this.close();
          this.onRefresh({ ...this.choice });
        }),
      );
    }
    const images = Object.values(this.review.document.images ?? {});
    if (
      images.length ||
      this.review.errors.length ||
      this.review.warnings.length
    ) {
      this.contentEl.createEl("h3", { text: "Images included in this export" });
      for (const image of images)
        this.contentEl.createEl("p", {
          text: `${image.path} — ${image.extension.toUpperCase()}, ${Math.ceil(image.bytes.length / 1024)} KiB, ${image.width} × ${image.height}`,
          cls: "page-foundry-result-path",
        });
      new Setting(this.contentEl).addButton((button) =>
        button.setButtonText("Refresh image review").onClick(() => {
          this.close();
          this.onRefresh({ ...this.choice });
        }),
      );
    }

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
            this.selectPreset(true);
            this.render();
          }),
      );

    new Setting(this.contentEl).setName("Preset").addDropdown((dropdown) => {
      for (const preset of this.catalog.presets.filter(
        (p) =>
          p.outputs[this.choice.format] &&
          (!this.review.document.book ||
            p.outputs[this.choice.format]?.recipe !== "letter"),
      )) {
        dropdown.addOption(
          preset.selectionId,
          preset.packId === "core"
            ? preset.name
            : `${preset.name} — ${preset.packName}`,
        );
      }
      return dropdown.setValue(this.choice.preset).onChange((value) => {
        this.choice.preset = value;
        this.selectPreset(true);
        this.render();
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
            this.render();
          }),
      );
    }

    const preset = choosePreset(
      this.catalog,
      this.choice.preset,
      this.choice.format,
    );
    const output = preset.outputs[this.choice.format]!;
    const style = output.style ?? {};
    this.contentEl.createEl("h3", { text: "Layout review" });
    this.contentEl.createEl("p", {
      text: `${preset.description} Pack: ${preset.packName} ${preset.packVersion}. Recipe: ${output.recipe}.`,
    });
    this.contentEl.createEl("p", {
      text:
        this.choice.format === "epub"
          ? `Reflowable; reader settings may override ${style.font ?? "serif"} type and ${style.lineSpacing ?? 1.5} line spacing.`
          : `${this.choice.profile === "a4" ? "A4" : "US Letter"}; ${style.font ?? (this.choice.format === "pdf" ? "Libertinus Serif" : output.recipe === "general-manuscript" ? "Times New Roman" : "editor default")}; ${style.bodySizePt ?? (output.recipe.includes("manuscript") ? 12 : this.choice.format === "pdf" ? 11 : "default")} pt; margins ${style.marginXmm ?? (this.choice.format === "pdf" && output.recipe !== "manuscript" ? 25 : 25.4)} × ${style.marginYmm ?? (this.choice.format === "pdf" && output.recipe !== "manuscript" ? 24 : 25.4)} mm; line spacing ${style.lineSpacing ?? (output.recipe.includes("manuscript") ? 2 : "recipe default")}.`,
    });
    this.contentEl.createEl("p", {
      text: `Body colour: ${style.color ?? "recipe default"}. PDF line spacing is font-relative; this is a summary, not a rendered preview.`,
    });
    this.contentEl.createEl("h3", { text: "Publication checks" });
    const validation = this.contentEl.createEl("pre", {
      text: reportText(this.report()),
      cls: "page-foundry-preflight",
    });
    if (typeof globalThis.navigator?.clipboard?.writeText === "function")
      new Setting(this.contentEl).addButton((button) =>
        button.setButtonText("Copy preflight report").onClick(async () => {
          button.setDisabled(true);
          try {
            await globalThis.navigator.clipboard.writeText(
              reportText(this.report()),
            );
            new Notice(
              "Preflight report copied. Share it only with people you choose.",
            );
          } catch {
            new Notice(
              "Could not copy the preflight report. Publishing is still available.",
            );
          } finally {
            button.setDisabled(false);
          }
        }),
      );
    let createButton: { setDisabled(value: boolean): unknown } | undefined;
    const fields = [...preset.metadata];
    if (
      this.choice.format === "epub" &&
      !fields.some((field) => field.key === "language")
    )
      fields.push({
        key: "language",
        label: "Publication language",
        required: true,
      });
    for (const field of fields) {
      const setting = new Setting(this.contentEl)
        .setName(field.label)
        .setDesc(
          field.required
            ? "Required for this preset. Export-only; the note is not changed."
            : "Export-only; the note is not changed.",
        );
      const changed = (value: string): void => {
        this.choice.metadata![field.key] = value;
        const errors = this.errors();
        validation.textContent = reportText(this.report());
        createButton?.setDisabled(errors.length > 0);
      };
      if (field.key === "from" || field.key === "to")
        setting.addTextArea((text) =>
          text
            .setValue(this.choice.metadata![field.key] ?? "")
            .onChange(changed),
        );
      else
        setting.addText((text) =>
          text
            .setValue(this.choice.metadata![field.key] ?? "")
            .onChange(changed),
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

    new Setting(this.contentEl).addButton((button) => {
      createButton = button;
      return button
        .setButtonText(`Create ${this.choice.format.toUpperCase()}`)
        .setCta()
        .setDisabled(this.errors().length > 0)
        .onClick(() => {
          if (this.errors().length) return;
          this.close();
          this.onPublish({
            ...this.choice,
            metadata: { ...this.choice.metadata },
          });
        });
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
