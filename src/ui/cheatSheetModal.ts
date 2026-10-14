/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import { Modal, Setting } from "obsidian";
import { disclosure } from "./disclosure";
export class CheatSheetModal extends Modal {
  onOpen(): void {
    this.modalEl.addClass("page-foundry-modal");
    this.contentEl.createEl("h2", { text: "Start here with Page Foundry" });
    let more: HTMLElement | undefined;
    for (const [index, [title, text]] of [
      [
        "Create new note",
        "Choose Letter, Manuscript, Book or one of your templates. More starters holds less-common choices. Create note saves a new editable Markdown file; it does not publish or change the open note. For letters, edit the greeting, sign-off and signature in the writing, and use Edit document details for saved addresses.",
      ],
      [
        "Publish",
        "Run Publish when your writing is ready. A suitable layout opens directly; Change layout and More layouts offer other designs. Select the format and destination, then Create PDF, EPUB or DOCX. A successful publication remembers the layout for this note. Publishing never edits your writing; export-form detail changes are temporary.",
      ],
      [
        "Find your file",
        "Save in vault normally uses the Page Foundry folder. The result shows the actual path. EPUB and DOCX may be hidden in Obsidian's sidebar: use Show in folder or Open in default app on desktop, or supported mobile sharing.",
      ],
      [
        "Books",
        "Create a Book note, then Edit document details to add and order existing chapters using exact note paths. New book plans use readable headings and links. Older YAML plans still work: Convert to readable book plan offers an explicit review before saving. Only listed notes and their images are included. Use Publish for the whole book.",
      ],
      [
        "Formats",
        "PDF has fixed pages. EPUB adapts to your reading app. DOCX stays editable in a word processor. Manuscript layouts are starting points: check your publisher’s requirements.",
      ],
      [
        "Older letters and recent choices",
        "Older greeting/closing properties still work. Move letter greeting and sign-off into writing lets you review the complete body before explicitly saving a simpler letter. Create recent lists note starters; Publish recent is an optional layout picker. Neither history stores writing or addresses.",
      ],
      [
        "Checks and paperback proofs",
        "Missing required publication information or broken resources prevent export, not draft-note creation. Details contains advice and reports. Paperback presets produce no-bleed black-ink proofs, not upload certification. Inspect every PDF page, use the retailer preview and order a physical proof.",
      ],
      [
        "Make your own note template",
        "Open a note and run Save as note template. Review its body as well as Clear personal properties, then save to an exact local Markdown path. Edit that file normally. Placeholders include {{title}}, {{author}}, {{language}}, {{date}} and {{sender-name}}; no code runs. Removing registration does not delete the file or redact names in its writing.",
      ],
      [
        "Your designs",
        "Note templates supply starting text and properties. Output presets supply page layouts. Manage output presets creates or edits your local pack through a form; select a starting layout, give it a name and adjust supported typography. Keep private designs in explicitly configured vault files, outside the project repository; vault sync/backups have their own privacy rules. Rendering is local: no Docker or rendering server. Typst is the internal PDF typesetting engine, not Markdown or LaTeX.",
      ],
    ].entries()) {
      const parent =
        index < 3
          ? this.contentEl
          : (more ??= disclosure(this.contentEl, "More help"));
      parent.createEl("h3", { text: title });
      parent.createEl("p", { text });
    }
    new Setting(this.contentEl).addButton((button) =>
      button.setButtonText("Done").onClick(() => this.close()),
    );
  }
  onClose(): void {
    this.contentEl.empty();
  }
}
