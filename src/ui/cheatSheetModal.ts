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
        "Choose Letter, Submission letter, Manuscript, Book, Plain document or one of your templates. Enter a title; the filename follows until you edit it under File location (optional). Create note saves a new editable Markdown file; it does not publish or change the open note. For letters, edit the greeting, sign-off and signature in the writing, and use Edit document details for saved addresses.",
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
        "Create a Book note, then Edit document details to add and order existing chapters using exact note paths. Book plans use readable headings and links. Only listed notes and their images are included. Use Publish for the whole book. Books have a separate reading-order editor, not a prose type switch.",
      ],
      [
        "Formats",
        "PDF has fixed pages. EPUB adapts to your reading app. DOCX stays editable in a word processor. Manuscript layouts are starting points: check your publisher’s requirements.",
      ],
      [
        "Change document type",
        "Open Edit document details and choose Plain document, Letter, Submission letter or Manuscript. Save details changes the type and resets the remembered output design, but preserves writing and other properties. Cancel changes nothing. Create recent lists your used note templates, not output designs.",
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
        "Note templates supply starting text; designs supply output appearance. Manage designs groups Book designs and Document designs. For books, adjust opening pages, chapters and running headers through a form. Open a book first to Create proof without saving the draft, then Save book design and choose it once with Publish → Change layout. Keep private designs outside the public checkout; vault sync/backups have separate privacy rules. No Docker or rendering server is needed.",
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
