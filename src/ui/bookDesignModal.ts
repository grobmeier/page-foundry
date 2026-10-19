/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import { App, Modal, Notice, Setting } from "obsidian";
import type { PackPreset, PresetPack } from "../packs/model";
import { updatedPack } from "../packs/editor";
import { parseBookDesign, BOOK_DESIGN_RANGES } from "../books/design";
import {
  bookDesignCopyPath,
  editBookDesign,
  newBookDesign,
} from "../books/designEditor";
import { DEFAULT_PRINT_OPTIONS, PRINT_TRIMS } from "../print/model";
import { disclosure } from "./disclosure";

export class BookDesignModal extends Modal {
  private target = "new";
  private draft = newBookDesign(`book-${crypto.randomUUID()}`);
  private busy = false;
  private copy: boolean;
  private path: string;
  constructor(
    app: App,
    private readonly pack: PresetPack | undefined,
    private readonly originalPath: string,
    private readonly save: (path: string, source: string) => Promise<void>,
    private readonly proof?: (preset: PackPreset) => Promise<void>,
  ) {
    super(app);
    this.copy = pack?.schemaVersion === 1;
    this.path = this.copy ? bookDesignCopyPath(originalPath) : originalPath;
  }
  onOpen(): void {
    this.modalEl.addClass("page-foundry-modal");
    this.render();
  }
  private render(): void {
    this.contentEl.empty();
    this.contentEl.createEl("h2", { text: "Manage book designs" });
    this.contentEl.createEl("p", {
      text: "Save your PDF book appearance locally. Starting text stays in Markdown note templates. No upload occurs; vault sync and backups may copy this pack.",
    });
    new Setting(this.contentEl).setName("Design").addDropdown((d) => {
      d.addOption("new", "New design");
      for (const preset of this.pack?.presets ?? [])
        if (preset.outputs.pdf?.book) d.addOption(preset.id, preset.name);
      d.setValue(this.target).onChange((value) => {
        if (this.busy) return;
        this.target = value;
        this.draft =
          value === "new"
            ? newBookDesign(`book-${crypto.randomUUID()}`)
            : structuredClone(this.pack!.presets.find((p) => p.id === value)!);
        this.render();
      });
    });
    if (this.target !== "new")
      new Setting(this.contentEl).addButton((b) =>
        b.setButtonText("Duplicate design").onClick(() => {
          if (this.busy) return;
          this.draft.id = `book-${crypto.randomUUID()}`;
          this.draft.name += " copy";
          this.target = "new";
          this.render();
        }),
      );
    new Setting(this.contentEl).setName("Design name").addText((t) =>
      t.setValue(this.draft.name).onChange((value) => {
        if (!this.busy) this.draft.name = value;
      }),
    );
    const pdf = this.draft.outputs.pdf!;
    const book = pdf.book!;
    const style = (pdf.style ??= {});
    new Setting(this.contentEl).setName("PDF type").addDropdown((d) =>
      d
        .addOption("plain-document", "Book PDF (A4 or US Letter)")
        .addOption("paperback-interior", "Paperback proof")
        .setValue(pdf.recipe)
        .onChange((value) => {
          if (this.busy) return;
          pdf.recipe = value as "plain-document" | "paperback-interior";
          if (value === "paperback-interior")
            book.printDefaults ??= { ...DEFAULT_PRINT_OPTIONS };
          else delete book.printDefaults;
          this.render();
        }),
    );
    const opening = disclosure(this.contentEl, "Opening pages");
    const chapter = disclosure(this.contentEl, "Chapter openings");
    const body = disclosure(this.contentEl, "Body and running headers");
    const more = disclosure(this.contentEl, "More layout controls");
    const invalid = new Set<string>();
    const status = this.contentEl.createEl("p");
    status.setAttribute("aria-live", "polite");
    const bool = (
      parent: HTMLElement,
      key: "titlePage" | "imprintPage" | "contents" | "chapterRule",
      label: string,
    ) =>
      new Setting(parent).setName(label).addToggle((t) =>
        t.setValue(book[key]).onChange((value) => {
          if (!this.busy) book[key] = value;
        }),
      );
    const select = (
      parent: HTMLElement,
      key: "titleAlign" | "chapterAlign" | "header" | "pageNumbers",
      label: string,
      choices: Record<string, string>,
    ) =>
      new Setting(parent).setName(label).addDropdown((d) => {
        for (const [value, text] of Object.entries(choices))
          d.addOption(value, text);
        d.setValue(book[key]).onChange((value) => {
          if (!this.busy) Object.assign(book, { [key]: value });
        });
      });
    const number = (
      parent: HTMLElement,
      key: string,
      label: string,
      value: number,
      min: number,
      max: number,
      update: (value: number) => void,
    ) =>
      new Setting(parent)
        .setName(label)
        .setDesc(`${min}–${max}.`)
        .addText((t) =>
          t.setValue(String(value)).onChange((raw) => {
            if (this.busy) return;
            const n = raw.trim() ? Number(raw) : NaN;
            if (!Number.isFinite(n) || n < min || n > max) invalid.add(key);
            else {
              invalid.delete(key);
              update(n);
            }
            status.textContent = invalid.size
              ? "Check the numeric values before saving or creating a proof."
              : "";
          }),
        );
    bool(opening, "titlePage", "Title page");
    bool(opening, "imprintPage", "Imprint page when text is present");
    bool(opening, "contents", "Contents page");
    opening.createEl("p", {
      text: "Title, author, subtitle and imprint come from Edit document details on the book.",
    });
    select(opening, "titleAlign", "Title alignment", {
      left: "Left",
      center: "Centred",
    });
    select(chapter, "chapterAlign", "Chapter alignment", {
      left: "Left",
      center: "Centred",
    });
    bool(chapter, "chapterRule", "Rule below chapter title");
    for (const [key, label, parent] of [
      ["chapterSizePt", "Chapter heading size (pt)", chapter],
      ["chapterTopMm", "Chapter top spacing (mm)", chapter],
      ["indentMm", "First-line indent (mm)", body],
      ["paragraphSpaceMm", "Extra paragraph spacing (mm)", body],
      ["titleSizePt", "Title size (pt)", more],
      ["titleTopMm", "Title top spacing (mm)", more],
      ["ruleWidthPercent", "Rule width (%)", more],
      ["ruleWeightPt", "Rule weight (pt)", more],
    ] as const)
      number(
        parent,
        key,
        label,
        book[key],
        BOOK_DESIGN_RANGES[key][0],
        BOOK_DESIGN_RANGES[key][1],
        (value) => {
          book[key] = value;
        },
      );
    number(
      body,
      "bodySizePt",
      "Body size (pt)",
      style.bodySizePt ?? 11,
      8,
      24,
      (value) => {
        style.bodySizePt = value;
      },
    );
    number(
      body,
      "lineSpacing",
      "Line spacing",
      style.lineSpacing ?? 1.35,
      1,
      3,
      (value) => {
        style.lineSpacing = value;
      },
    );
    body.createEl("p", {
      text: "PDF font: bundled Libertinus Serif. Imported fonts and ornaments are not supported yet. These print controls do not change EPUB or DOCX.",
    });
    select(body, "header", "Running header", {
      none: "None",
      "book-title": "Book title",
      "chapter-title": "Chapter title",
    });
    select(body, "pageNumbers", "Page numbers", {
      center: "Centred",
      outside: "Outside edge",
    });
    if (pdf.recipe === "paperback-interior") {
      const print = (book.printDefaults ??= { ...DEFAULT_PRINT_OPTIONS });
      const page = disclosure(this.contentEl, "Paperback defaults");
      page.createEl("p", {
        text: "No bleed, black ink and measured mirrored margins. Publish can override these defaults; retailer and physical print proof are still required.",
      });
      new Setting(page).setName("Trim").addDropdown((d) => {
        for (const [key, trim] of Object.entries(PRINT_TRIMS))
          d.addOption(key, trim.label);
        d.setValue(print.trim).onChange((v) => {
          if (!this.busy) print.trim = v as typeof print.trim;
        });
      });
      new Setting(page).setName("Paper").addDropdown((d) =>
        d
          .addOption("white", "White")
          .addOption("cream", "Cream")
          .setValue(print.paper)
          .onChange((v) => {
            if (!this.busy) print.paper = v as typeof print.paper;
          }),
      );
      new Setting(page).setName("Right-hand chapter starts").addToggle((t) =>
        t.setValue(print.recto).onChange((v) => {
          if (!this.busy) print.recto = v;
        }),
      );
    } else {
      number(
        more,
        "marginXmm",
        "Horizontal margins (mm)",
        style.marginXmm ?? 25,
        12,
        40,
        (value) => {
          style.marginXmm = value;
        },
      );
      number(
        more,
        "marginYmm",
        "Vertical margins (mm)",
        style.marginYmm ?? 24,
        12,
        40,
        (value) => {
          style.marginYmm = value;
        },
      );
    }
    if (this.pack?.schemaVersion === 1)
      this.contentEl.createEl("p", {
        text: "Book controls require pack version 2. Older plugin versions cannot read it. Save a copy by default to keep the original pack.",
      });
    if (this.pack)
      new Setting(this.contentEl).setName("Save a copy").addToggle((t) =>
        t.setValue(this.copy).onChange((value) => {
          if (this.busy) return;
          this.copy = value;
          this.path = value
            ? bookDesignCopyPath(this.originalPath)
            : this.originalPath;
          this.render();
        }),
      );
    new Setting(this.contentEl)
      .setName("Local pack file")
      .setDesc(
        "Exact path in an existing vault folder. Nothing is uploaded. Keep real private packs outside the public development checkout.",
      )
      .addText((t) =>
        t
          .setValue(this.path)
          .setDisabled(Boolean(this.pack) && !this.copy)
          .onChange((value) => {
            if (!this.busy) this.path = value;
          }),
      );
    const validated = () => {
      if (invalid.size)
        throw new Error(
          "Check the numeric values before saving or creating a proof.",
        );
      const draft = editBookDesign(
        this.draft,
        this.draft.name,
        parseBookDesign(book),
      );
      updatedPack(this.pack, draft);
      return draft;
    };
    const perform = async (action: () => Promise<void>, close: boolean) => {
      if (this.busy) return;
      this.busy = true;
      const fields = Array.from(
        this.contentEl.querySelectorAll<HTMLInputElement>(
          "input, select, button, textarea",
        ),
      );
      const disabled = fields.map((field) => field.disabled);
      fields.forEach((field) => {
        field.disabled = true;
      });
      try {
        await action();
        if (close) this.close();
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Could not complete this design action.";
        status.textContent = message;
        new Notice(message);
      } finally {
        this.busy = false;
        fields.forEach((field, i) => {
          field.disabled = disabled[i]!;
        });
      }
    };
    if (this.proof)
      new Setting(this.contentEl)
        .setName("Unsaved design proof")
        .setDesc(
          "Creates a PDF of the active book. Does not save the pack or change this book's selected design.",
        )
        .addButton((b) =>
          b
            .setButtonText("Create proof")
            .onClick(() =>
              perform(async () => this.proof!(validated()), false),
            ),
        );
    else
      this.contentEl.createEl("p", {
        text: "Open an ordered book before opening this editor to enable Create proof.",
      });
    new Setting(this.contentEl)
      .addButton((b) =>
        b.setButtonText("Cancel").onClick(() => {
          if (!this.busy) this.close();
        }),
      )
      .addButton((b) =>
        b
          .setButtonText("Save book design")
          .setCta()
          .onClick(() =>
            perform(async () => {
              if (this.copy && this.path.trim() === this.originalPath)
                throw new Error("Choose a different path for the copy.");
              await this.save(this.path, updatedPack(this.pack, validated()));
            }, true),
          ),
      );
  }
  onClose(): void {
    this.contentEl.empty();
  }
}
