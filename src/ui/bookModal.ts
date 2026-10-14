/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import { App, Modal, Notice, Setting } from "obsidian";
import {
  moveBookEntry,
  bookPlanPath,
  newBookEntry,
  serializeBookPlan,
} from "../books/editor";
import { BOOK_ROLES } from "../books/labels";
import type { BookEntry, BookManifest } from "../books/manifest";
import { disclosure } from "./disclosure";

export class BookModal extends Modal {
  private busy = false;
  constructor(
    app: App,
    private readonly book: BookManifest,
    private path: string,
    private readonly editing: boolean,
    private readonly save: (path: string, book: BookManifest) => Promise<void>,
    private readonly converting = false,
  ) {
    super(app);
  }
  onOpen(): void {
    this.modalEl.addClass("page-foundry-modal");
    this.render();
  }
  private render(openId?: string): void {
    let focusTarget: HTMLElement | null = null;
    this.contentEl.empty();
    this.contentEl.createEl("h2", {
      text: this.editing ? "Edit book plan" : "Set up a book",
    });
    this.contentEl.createEl("p", {
      text: "Choose the notes to include and put them in reading order. Saving changes only the book plan, never your chapter notes.",
    });
    if (this.converting)
      this.contentEl.createEl("p", {
        text: `Convert ${this.path}: replace its YAML entries with readable Markdown headings and note links. All ${this.book.entries.length} sections, their order, stable links and existing prose are retained. Review below, then Convert and save; Cancel leaves it unchanged.`,
      });
    const status = this.contentEl.createEl("p", {
      text: "",
      cls: "page-foundry-check-summary",
    });
    status.setAttribute("aria-live", "polite");
    let saveButton: { setDisabled(disabled: boolean): unknown } | undefined;
    const validate = () => {
      try {
        bookPlanPath(this.path);
        serializeBookPlan(this.book);
        status.textContent = "";
        saveButton?.setDisabled(this.busy);
      } catch (error) {
        status.textContent =
          error instanceof Error
            ? error.message
            : "Check the book information.";
        saveButton?.setDisabled(true);
      }
    };
    for (const [key, label] of [
      ["title", "Book title"],
      ["author", "Author (optional)"],
      ["language", "Language"],
    ])
      new Setting(this.contentEl)
        .setName(label!)
        .setDesc(key === "language" ? "Examples: en, en-GB, de." : "")
        .addText((text) =>
          text.setValue(this.book.metadata[key!] ?? "").onChange((value) => {
            this.book.metadata[key!] = value;
            validate();
          }),
        );
    const publishingDetails = disclosure(
      this.contentEl,
      "Opening page details (optional)",
    );
    new Setting(publishingDetails).setName("Subtitle").addText((t) =>
      t.setValue(this.book.metadata.subtitle ?? "").onChange((value) => {
        this.book.metadata.subtitle = value;
        validate();
      }),
    );
    new Setting(publishingDetails)
      .setName("Imprint")
      .setDesc(
        "Optional publication text. Printed only by a design with an imprint page.",
      )
      .addTextArea((t) =>
        t.setValue(this.book.metadata.imprint ?? "").onChange((value) => {
          this.book.metadata.imprint = value;
          validate();
        }),
      );
    new Setting(this.contentEl)
      .setName("Book plan file")
      .setDesc(
        this.editing
          ? "Editing this plan in place. Its existing section links are preserved."
          : "Use an existing folder, or save in the vault’s top level. Example: My Book.book.md.",
      )
      .addText((text) =>
        text
          .setValue(this.path)
          .setDisabled(this.editing)
          .onChange((value) => {
            this.path = value;
            validate();
          }),
      );
    this.book.entries.forEach((entry, index) => {
      const group = this.contentEl.createDiv({ cls: "page-foundry-book-row" });
      const title = () =>
        entry.title?.trim() ||
        entry.path?.split("/").at(-1)?.replace(/\.md$/, "") ||
        "New section";
      const header = new Setting(group)
        .setName(`${index + 1}. ${title()}`)
        .setDesc(BOOK_ROLES[entry.role]);
      header.addButton((button) =>
        button
          .setButtonText("Move up")
          .setDisabled(index === 0)
          .onClick(() => {
            if (this.busy) return;
            moveBookEntry(this.book, index, -1);
            this.render(entry.id);
          }),
      );
      header.addButton((button) =>
        button
          .setButtonText("Move down")
          .setDisabled(index === this.book.entries.length - 1)
          .onClick(() => {
            if (this.busy) return;
            moveBookEntry(this.book, index, 1);
            this.render(entry.id);
          }),
      );
      header.addButton((button) =>
        button.setButtonText("Remove").onClick(() => {
          if (this.busy) return;
          this.book.entries.splice(index, 1);
          this.render();
        }),
      );
      const fields = disclosure(group, "Edit section");
      if (entry.id === openId) {
        fields.setAttribute("open", "");
        focusTarget = fields.querySelector<HTMLElement>("summary");
      }
      new Setting(fields).setName("Section type").addDropdown((dropdown) => {
        for (const [role, label] of Object.entries(BOOK_ROLES))
          dropdown.addOption(role, label);
        return dropdown.setValue(entry.role).onChange((value) => {
          entry.role = value as BookEntry["role"];
          header.setDesc(BOOK_ROLES[entry.role]);
          validate();
        });
      });
      new Setting(fields)
        .setName("Note path")
        .setDesc(
          "Exact path, for example Book/Chapter One.md. For a Part heading only, leave empty and enter a title.",
        )
        .addText((text) =>
          text.setValue(entry.path ?? "").onChange((value) => {
            entry.path = value;
            header.setName(`${index + 1}. ${title()}`);
            validate();
          }),
        );
      new Setting(fields)
        .setName("Section title (optional)")
        .setDesc(
          "Leave empty to use the note’s title. Required for a Part without a note.",
        )
        .addText((text) =>
          text.setValue(entry.title ?? "").onChange((value) => {
            entry.title = value;
            header.setName(`${index + 1}. ${title()}`);
            validate();
          }),
        );
    });
    new Setting(this.contentEl).addButton((button) =>
      button
        .setButtonText("Add section")
        .setDisabled(this.book.entries.length >= 50)
        .onClick(() => {
          if (this.busy || this.book.entries.length >= 50) return;
          const entry = newBookEntry();
          this.book.entries.push(entry);
          this.render(entry.id);
        }),
    );
    new Setting(this.contentEl)
      .addButton((button) =>
        button.setButtonText("Cancel").onClick(() => this.close()),
      )
      .addButton((button) => {
        saveButton = button;
        return button
          .setButtonText(
            this.converting ? "Convert and save" : "Save book plan",
          )
          .setCta()
          .onClick(async () => {
            if (this.busy) return;
            try {
              serializeBookPlan(this.book);
              this.busy = true;
              this.contentEl
                .querySelectorAll("input, select, button")
                .forEach(
                  (element) => ((element as HTMLInputElement).disabled = true),
                );
              await this.save(this.path, {
                metadata: { ...this.book.metadata },
                entries: this.book.entries.map((entry) => ({ ...entry })),
              });
              this.close();
            } catch (error) {
              this.busy = false;
              this.render();
              // Use a notice as well: a rerender must not conceal a stale-save failure.
              new Notice(
                error instanceof Error
                  ? error.message
                  : "Could not save the book plan.",
              );
            }
          });
      });
    validate();
    (focusTarget as HTMLElement | null)?.focus();
  }
  onClose(): void {
    this.contentEl.empty();
  }
}
