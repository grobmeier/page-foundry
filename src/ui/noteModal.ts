/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import { App, Modal, Notice, Setting, SuggestModal } from "obsidian";
import { newNotePath, noteFields, type NoteTemplate } from "../notes/model";
export class NoteTemplateModal extends SuggestModal<NoteTemplate> {
  constructor(
    app: App,
    private templates: NoteTemplate[],
    private choose: (template: NoteTemplate) => void,
  ) {
    super(app);
    this.setPlaceholder("Create new note — choose a note template");
  }
  getSuggestions(query: string): NoteTemplate[] {
    return this.templates.filter((t) =>
      t.name.toLowerCase().includes(query.toLowerCase()),
    );
  }
  renderSuggestion(template: NoteTemplate, el: HTMLElement): void {
    el.createEl("div", { text: template.name });
  }
  onChooseSuggestion(template: NoteTemplate): void {
    this.choose(template);
  }
}
export class NoteModal extends Modal {
  private busy = false;
  constructor(
    app: App,
    private template: NoteTemplate,
    private values: Record<string, string>,
    private folder: string,
    private filename: string,
    private editing: boolean,
    private save: (
      path: string,
      values: Record<string, string>,
      createFolders: boolean,
    ) => Promise<void>,
    private readonly legacyLetter = false,
  ) {
    super(app);
  }
  onOpen(): void {
    this.modalEl.addClass("page-foundry-modal");
    this.contentEl.createEl("h2", {
      text: this.editing
        ? "Edit document details"
        : `New ${this.template.name.toLowerCase()}`,
    });
    this.contentEl.createEl("p", {
      text: this.editing
        ? "Save these details in your note. Publishing is a separate action. Unrelated properties and writing are preserved."
        : "Prepare an editable Markdown note. Nothing is published, and your open note stays unchanged.",
    });
    if (this.legacyLetter)
      this.contentEl.createEl("p", {
        text: "This letter uses older sender/recipient blocks. Review the split names and addresses below. Save details replaces those blocks with these readable properties; Cancel leaves the note unchanged.",
      });
    let createFolders = false;
    const status = this.contentEl.createEl("p");
    status.setAttribute("aria-live", "polite");
    const updatePath = () => {
      try {
        status.textContent = this.editing
          ? ""
          : `New note: ${newNotePath(this.folder, this.filename)}`;
      } catch (e) {
        status.textContent = (e as Error).message;
      }
    };
    if (!this.editing) {
      new Setting(this.contentEl).setName("Filename").addText((t) =>
        t.setValue(this.filename).onChange((v) => {
          this.filename = v;
          updatePath();
        }),
      );
      new Setting(this.contentEl)
        .setName("Folder")
        .setDesc(
          "Inside your vault. Empty means the top level; this is separate from the output folder.",
        )
        .addText((t) =>
          t.setValue(this.folder).onChange((v) => {
            this.folder = v;
            updatePath();
          }),
        );
      new Setting(this.contentEl)
        .setName("Create missing folders")
        .addToggle((t) =>
          t.setValue(false).onChange((v) => {
            createFolders = v;
          }),
        );
    }
    for (const field of noteFields(this.template.kind)) {
      const setting = new Setting(this.contentEl).setName(field.label);
      const change = (v: string) => {
        this.values[field.key] = v;
      };
      if (field.multiline)
        setting.addTextArea((t) =>
          t.setValue(this.values[field.key] ?? "").onChange(change),
        );
      else
        setting.addText((t) =>
          t.setValue(this.values[field.key] ?? "").onChange(change),
        );
    }
    new Setting(this.contentEl)
      .addButton((b) =>
        b.setButtonText("Cancel").onClick(() => {
          if (!this.busy) this.close();
        }),
      )
      .addButton((b) =>
        b
          .setButtonText(this.editing ? "Save details" : "Create note")
          .setCta()
          .onClick(async () => {
            if (this.busy) return;
            this.busy = true;
            for (const el of this.contentEl.querySelectorAll<HTMLInputElement>(
              "input, textarea, button",
            ))
              el.disabled = true;
            try {
              await this.save(
                this.editing
                  ? this.filename
                  : newNotePath(this.folder, this.filename),
                { ...this.values },
                createFolders,
              );
              this.close();
            } catch (e) {
              const message =
                e instanceof Error ? e.message : "Could not save the note.";
              status.textContent = message;
              new Notice(message);
            } finally {
              this.busy = false;
              for (const el of this.contentEl.querySelectorAll<HTMLInputElement>(
                "input, textarea, button",
              ))
                el.disabled = false;
            }
          }),
      );
    updatePath();
  }
  onClose(): void {
    this.contentEl.empty();
  }
}
