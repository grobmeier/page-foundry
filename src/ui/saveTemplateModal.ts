/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import { App, Modal, Notice, Setting } from "obsidian";
import { privateTemplateSource } from "../notes/templates";
export class SaveTemplateModal extends Modal {
  constructor(
    app: App,
    private source: string,
    private path: string,
    private save: (path: string, source: string) => Promise<void>,
  ) {
    super(app);
  }
  onOpen(): void {
    this.modalEl.addClass("page-foundry-modal");
    this.contentEl.createEl("h2", { text: "Save as note template" });
    this.contentEl.createEl("p", {
      text: "This copies the selected note into a private, local template. Its filename becomes the template name. No upload or Git commit occurs. Your vault sync and backups may still share it. Review the full preview: clearing personal properties does not remove names or private text from the body.",
    });
    let clear = true,
      busy = false;
    new Setting(this.contentEl)
      .setName("Template file")
      .setDesc(
        "Exact Markdown path in an existing vault folder. Existing files are never overwritten.",
      )
      .addText((t) =>
        t.setValue(this.path).onChange((v) => {
          this.path = v;
        }),
      );
    const preview = this.contentEl.createEl("pre");
    const refresh = () => {
      try {
        preview.textContent = privateTemplateSource(this.source, clear);
      } catch (e) {
        preview.textContent = (e as Error).message;
      }
    };
    new Setting(this.contentEl)
      .setName("Clear personal properties")
      .setDesc(
        "Clear author, names, addresses, salutation, surname, subject, date and publication identifier. Review the body yourself.",
      )
      .addToggle((t) =>
        t.setValue(true).onChange((v) => {
          clear = v;
          refresh();
        }),
      );
    new Setting(this.contentEl)
      .addButton((b) =>
        b.setButtonText("Cancel").onClick(() => {
          if (!busy) this.close();
        }),
      )
      .addButton((b) =>
        b
          .setButtonText("Save private template")
          .setCta()
          .onClick(async () => {
            if (busy) return;
            busy = true;
            b.setDisabled(true);
            try {
              await this.save(
                this.path,
                privateTemplateSource(this.source, clear),
              );
              this.close();
            } catch (e) {
              new Notice(
                e instanceof Error
                  ? e.message
                  : "Could not save this template.",
              );
            } finally {
              busy = false;
              b.setDisabled(false);
            }
          }),
      );
    refresh();
  }
  onClose(): void {
    this.contentEl.empty();
  }
}
