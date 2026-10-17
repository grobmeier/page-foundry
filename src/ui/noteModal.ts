/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import { App, Modal, Notice, Setting, SuggestModal } from "obsidian";
import {
  newNotePath,
  noteFields,
  advancedNoteFields,
  DOCUMENT_TYPES,
  type NoteTemplate,
} from "../notes/model";
import { disclosure } from "./disclosure";
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
  private readonly changed: Record<string, string> = {};
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
      kind?: string,
    ) => Promise<void>,
    private kind = template.kind,
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
    if (this.editing) {
      new Setting(this.contentEl)
        .setName("Document type")
        .setDesc(
          "Changes saved details and suggested output, not your writing. Books have a separate reading-order plan: use Create new note → Book.",
        )
        .addDropdown((dropdown) => {
          if (!DOCUMENT_TYPES.some((type) => type.id === this.kind))
            dropdown.addOption(this.kind, "Choose a type…");
          for (const type of DOCUMENT_TYPES)
            dropdown.addOption(type.id, type.name);
          dropdown.setValue(this.kind).onChange((kind) => {
            this.kind = kind;
            renderFields();
            status.textContent =
              "Unsaved details. Save details applies your changes; your writing is kept.";
          });
        });
    }
    const fields = this.contentEl.createDiv();
    const renderFields = () => {
      fields.empty();
      const advanced = advancedNoteFields(this.kind, this.values);
      let more: HTMLElement | undefined;
      if (
        this.editing &&
        !DOCUMENT_TYPES.some((type) => type.id === this.kind)
      ) {
        fields.createEl("p", {
          text: "This note has an unrecognised document type. Choose a type above to correct it; nothing changes until you save.",
        });
        return;
      }
      for (const field of [...noteFields(this.kind), ...advanced]) {
        const setting = new Setting(
          advanced.includes(field)
            ? (more ??= disclosure(fields, "More details"))
            : fields,
        ).setName(field.label);
        const change = (v: string) => {
          this.values[field.key] = v;
          this.changed[field.key] = v;
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
    };
    renderFields();
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
              "input, textarea, select, button",
            ))
              el.disabled = true;
            try {
              await this.save(
                this.editing
                  ? this.filename
                  : newNotePath(this.folder, this.filename),
                { ...(this.editing ? this.changed : this.values) },
                createFolders,
                this.kind,
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
                "input, textarea, select, button",
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
