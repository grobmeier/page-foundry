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
import { DEFAULT_PRINT_OPTIONS, PRINT_TRIMS } from "../print/model";
import { disclosure } from "./disclosure";
import { bookRoleLabel } from "../books/labels";
import { documentTypeLabel } from "../notes/model";

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
    private readonly onTemplates?: (
      choice: ExportChoice,
      replace: () => void,
    ) => void,
    private readonly onDetails?: () => void,
  ) {
    super(app);
    this.choice = {
      ...initial,
      printOptions: {
        ...(initial.printOptions ??
          choosePreset(this.catalog, initial.preset, initial.format).outputs.pdf
            ?.book?.printDefaults ??
          DEFAULT_PRINT_OPTIONS),
      },
      metadata: initial.metadata ? { ...initial.metadata } : undefined,
    };
    this.selectPreset(false);
  }

  private selectPreset(reset: boolean): void {
    const compatible = this.catalog.presets.filter(
      (p) =>
        p.outputs[this.choice.format] &&
        (this.review.document.book ||
          (p.outputs[this.choice.format]?.recipe !== "paperback-interior" &&
            !p.outputs[this.choice.format]?.book)) &&
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
    if (reset)
      this.choice.printOptions = {
        ...(preset.outputs.pdf?.book?.printDefaults ?? DEFAULT_PRINT_OPTIONS),
      };
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
      printOptions: this.choice.printOptions,
    });
  }

  onOpen(): void {
    this.modalEl.addClass("page-foundry-modal");
    this.render();
  }

  private render(): void {
    const opened = Array.from(
      this.contentEl.querySelectorAll?.("details[open]") ?? [],
    ).map((element) => element.querySelector("summary")?.textContent);
    this.contentEl.empty();
    this.contentEl.createEl("h2", {
      text: this.review.document.book
        ? "Publish this book"
        : "Publish this note",
    });
    this.contentEl.createEl("p", {
      text: this.review.document.book
        ? "Book · ordered chapter notes"
        : `Document type: ${documentTypeLabel(this.review.document.metadata.document ?? (this.review.document.metadata.from || this.review.document.metadata.to || this.review.document.metadata.subject || this.review.document.metadata["sender-name"] || this.review.document.metadata["recipient-name"] ? "letter" : "plain"))}`,
    });
    if (this.onTemplates)
      new Setting(this.contentEl).addButton((button) =>
        button.setButtonText("Change layout").onClick(() => {
          this.onTemplates!(
            {
              ...this.choice,
              metadata: { ...this.choice.metadata },
              printOptions: this.choice.printOptions
                ? { ...this.choice.printOptions }
                : undefined,
            },
            () => this.close(),
          );
        }),
      );
    if (this.review.document.book) {
      const order = disclosure(
        this.contentEl,
        `Book order · ${this.review.document.book.entries.length} sections`,
      );
      this.review.document.book.entries.forEach((entry, index) =>
        order.createEl("p", {
          text: `${index + 1}. ${entry.title} · ${bookRoleLabel(entry.role)}`,
        }),
      );
      new Setting(order).addButton((button) =>
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
      const resources = disclosure(
        this.contentEl,
        `Images · ${images.length} included`,
      );
      for (const image of images)
        resources.createEl("p", {
          text: `${image.path} — ${image.extension.toUpperCase()}, ${Math.ceil(image.bytes.length / 1024)} KiB, ${image.width} × ${image.height}`,
          cls: "page-foundry-result-path",
        });
      new Setting(resources).addButton((button) =>
        button.setButtonText("Refresh image review").onClick(() => {
          this.close();
          this.onRefresh({ ...this.choice });
        }),
      );
    }

    const layout = disclosure(this.contentEl, "Layout options");
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

    new Setting(layout).setName("Layout").addDropdown((dropdown) => {
      for (const preset of this.catalog.presets.filter(
        (p) =>
          p.outputs[this.choice.format] &&
          (this.review.document.book ||
            p.outputs[this.choice.format]?.recipe !== "paperback-interior") &&
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

    const print =
      this.choice.format === "pdf" &&
      choosePreset(this.catalog, this.choice.preset, "pdf").outputs.pdf
        ?.recipe === "paperback-interior";
    if (print) {
      new Setting(layout).setName("Paperback trim").addDropdown((dropdown) => {
        for (const [id, trim] of Object.entries(PRINT_TRIMS))
          dropdown.addOption(id, trim.label);
        return dropdown
          .setValue(this.choice.printOptions!.trim)
          .onChange((value) => {
            this.choice.printOptions!.trim = value as keyof typeof PRINT_TRIMS;
            this.render();
          });
      });
      new Setting(layout).setName("Paper (black ink)").addDropdown((dropdown) =>
        dropdown
          .addOption("white", "White")
          .addOption("cream", "Cream")
          .setValue(this.choice.printOptions!.paper)
          .onChange((value) => {
            this.choice.printOptions!.paper = value as "white" | "cream";
            this.render();
          }),
      );
      new Setting(layout)
        .setName("Part/chapter starts")
        .addDropdown((dropdown) =>
          dropdown
            .addOption("recto", "Right-hand page")
            .addOption("next", "Next page")
            .setValue(this.choice.printOptions!.recto ? "recto" : "next")
            .onChange((value) => {
              this.choice.printOptions!.recto = value === "recto";
              this.render();
            }),
        );
    }
    if (this.choice.format !== "epub" && !print) {
      new Setting(layout).setName("Page size").addDropdown((dropdown) =>
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
    this.contentEl.createEl("p", {
      text: `${preset.name} · ${this.choice.format.toUpperCase()}${print ? ` · ${PRINT_TRIMS[this.choice.printOptions!.trim].label} · ${this.choice.printOptions!.paper}` : this.choice.format === "epub" ? "" : ` · ${this.choice.profile === "a4" ? "A4" : "US Letter"}`}`,
    });
    if (print)
      this.contentEl.createEl("p", {
        text: "Paperback proof only: no bleed, black ink. Inspect the PDF before publication; retailer acceptance is not guaranteed.",
      });
    const checks = this.contentEl.createEl("p", {
      text: "",
      cls: "page-foundry-check-summary",
    });
    checks.setAttribute("aria-live", "polite");
    const details = disclosure(this.contentEl, "Details and checks");
    details.createEl("p", {
      text: `${preset.description} Pack: ${preset.packName} ${preset.packVersion}. Recipe: ${output.recipe}.`,
    });
    details.createEl("p", {
      text: print
        ? `${PRINT_TRIMS[this.choice.printOptions!.trim].label}; no bleed; mirrored margins; inside gutter measured after pagination, at least 0.5 in; outside 0.5 in; top/bottom 0.75 in. Style margin overrides do not apply to this recipe.`
        : this.choice.format === "epub"
          ? `Reflowable; reader settings may override ${style.font ?? "serif"} type and ${style.lineSpacing ?? 1.5} line spacing.`
          : `${this.choice.profile === "a4" ? "A4" : "US Letter"}; ${style.font ?? (this.choice.format === "pdf" ? "Libertinus Serif" : output.recipe === "general-manuscript" ? "Times New Roman" : "editor default")}; ${style.bodySizePt ?? (output.recipe.includes("manuscript") ? 12 : this.choice.format === "pdf" ? 11 : "default")} pt; margins ${style.marginXmm ?? (this.choice.format === "pdf" && output.recipe !== "manuscript" ? 25 : 25.4)} × ${style.marginYmm ?? (this.choice.format === "pdf" && output.recipe !== "manuscript" ? 24 : 25.4)} mm; line spacing ${style.lineSpacing ?? (output.recipe.includes("manuscript") ? 2 : "recipe default")}.`,
    });
    details.createEl("p", {
      text: `Body colour: ${style.color ?? "recipe default"}. PDF line spacing is font-relative; this is a summary, not a rendered preview.`,
    });
    if (this.review.document.book)
      for (const entry of this.review.document.book.entries)
        details.createEl("p", {
          text: `${entry.title}: ${entry.path ?? "Part heading"}`,
        });
    const validation = details.createEl("pre", {
      text: reportText(this.report()),
      cls: "page-foundry-preflight",
    });
    const clipboard =
      this.contentEl.ownerDocument.defaultView?.navigator.clipboard;
    if (typeof clipboard?.writeText === "function")
      new Setting(details).addButton((button) =>
        button.setButtonText("Copy preflight report").onClick(async () => {
          button.setDisabled(true);
          try {
            await clipboard.writeText(reportText(this.report()));
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
    const updateChecks = (): void => {
      const report = this.report();
      const blockers = report.findings.filter(
        (finding) => finding.severity === "blocker",
      );
      const advice = report.findings.filter(
        (finding) => finding.severity === "advice",
      ).length;
      checks.textContent = blockers.length
        ? blockers.map((finding) => finding.message).join("\n")
        : `Ready to create.${advice ? ` ${advice} suggestion${advice === 1 ? "" : "s"} in Details.` : ""}`;
      validation.textContent = reportText(report);
      createButton?.setDisabled(blockers.length > 0);
    };
    updateChecks();
    const fields = [...preset.metadata].filter(
      (field) =>
        output.recipe !== "letter" ||
        !["author", "salutation", "closing"].includes(field.key),
    );
    const metadataDetails = disclosure(
      this.contentEl,
      "Document details (export only)",
    );
    metadataDetails.createEl("p", {
      text: "Changes here apply only to this export. To save details or change document type, edit the note's saved details instead. Unsaved export choices will be discarded.",
    });
    if (this.onDetails)
      new Setting(metadataDetails).addButton((button) =>
        button.setButtonText("Edit saved document details").onClick(() => {
          this.close();
          this.onDetails!();
        }),
      );
    if (this.errors().length) metadataDetails.setAttribute("open", "");
    if (
      ["letter", "submission-letter"].includes(
        this.review.document.metadata.document ?? "",
      ) &&
      this.choice.format !== "pdf"
    )
      this.contentEl.createEl("p", {
        text: "Letter address formatting is PDF-only. This format exports your writing using the selected layout.",
      });
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
      const setting = new Setting(metadataDetails)
        .setName(field.label)
        .setDesc(
          field.required
            ? "Required for this preset. Export-only; the note is not changed."
            : "Export-only; the note is not changed.",
        );
      const changed = (value: string): void => {
        this.choice.metadata![field.key] = value;
        updateChecks();
      };
      if (
        field.key === "from" ||
        field.key === "to" ||
        field.key.endsWith("-address")
      )
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
    for (const element of this.contentEl.querySelectorAll?.("details") ?? [])
      if (opened.includes(element.querySelector("summary")?.textContent))
        element.setAttribute("open", "");
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
