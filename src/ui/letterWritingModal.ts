/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import { App, Modal, Setting, Notice } from "obsidian";
export class LetterWritingModal extends Modal {
  private busy = false;
  constructor(
    app: App,
    private writing: string,
    private save: (writing: string) => Promise<void>,
  ) {
    super(app);
  }
  onOpen() {
    this.contentEl.createEl("h2", {
      text: "Move greeting and sign-off into the writing",
    });
    this.contentEl.createEl("p", {
      text: "Review the complete letter below. Remove any repeated greeting or signature. Save removes the old greeting, closing and author properties; addresses and other properties are preserved. Cancel changes nothing.",
    });
    const field = new Setting(this.contentEl)
      .setName("Letter writing")
      .addTextArea((t) =>
        t.setValue(this.writing).onChange((v) => (this.writing = v)),
      );
    field.settingEl.addClass("page-foundry-writing-field");
    const input = field.controlEl.querySelector("textarea")!;
    input.setAttribute("aria-label", "Letter writing");
    new Setting(this.contentEl)
      .addButton((b) =>
        b.setButtonText("Cancel").onClick(() => {
          if (!this.busy) this.close();
        }),
      )
      .addButton((b) =>
        b
          .setButtonText("Save reviewed letter")
          .setCta()
          .onClick(async () => {
            if (this.busy) return;
            this.busy = true;
            b.setDisabled(true);
            input.disabled = true;
            try {
              await this.save(this.writing);
              this.close();
            } catch (e) {
              new Notice(
                e instanceof Error ? e.message : "Could not save the letter.",
              );
            } finally {
              this.busy = false;
              b.setDisabled(false);
              input.disabled = false;
            }
          }),
      );
  }
  onClose() {
    this.contentEl.empty();
  }
}
