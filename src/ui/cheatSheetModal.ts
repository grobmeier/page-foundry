/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import { Modal, Setting } from "obsidian";
export class CheatSheetModal extends Modal {
  onOpen(): void {
    this.modalEl.addClass("page-foundry-modal");
    this.contentEl.createEl("h2", { text: "Page Foundry: Cheat Sheet" });
    for (const [title, text] of [
      [
        "Create new note",
        "Choose Letter, Manuscript, Book or another note template. Enter a filename and details, then Create note. It saves and opens an editable Markdown file, including its properties. Nothing is exported and your previous note stays unchanged. You do not need an open note to start.",
      ],
      [
        "Recent templates",
        "Create recent lists your note templates. Publish recent lists output layouts. These are separate histories: neither stores addresses or manuscript text.",
      ],
      [
        "Details and publishing",
        "Edit document details saves title, author and letter names/addresses in your note. Draft fields can be blank. When ready, run Publish, choose an output preset and create PDF, EPUB or DOCX. Changes made only in the export form are temporary; publishing never edits your note.",
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
        "Find your file",
        "Save in vault uses the output folder in settings, normally Page Foundry. The result shows the actual saved path. EPUB and DOCX may be hidden in Obsidian: use Show in folder or Open in default app on desktop, or Share or save elsewhere where supported.",
      ],
      [
        "Checks and paperback proofs",
        "Missing required publication information or broken resources prevent export, not draft-note creation. Details contains advice and reports. Paperback presets produce no-bleed black-ink proofs, not upload certification. Inspect every PDF page, use the retailer preview and order a physical proof.",
      ],
      [
        "Make your own note template",
        "Open a note and run Save as note template. Review the copied text and the Clear personal properties option, then save to an exact local Markdown path. It appears in Create new note. Edit that template file normally to change it. Optional placeholders are {{title}}, {{author}}, {{language}} and {{date}}; no code runs. Settings lists registered paths; removing one does not delete its file.",
      ],
      [
        "Your designs",
        "Note templates supply starting text and properties. Output presets supply page layouts. Manage output presets creates or edits your local pack through a form; select a starting layout, give it a name and adjust supported typography. Keep private designs in explicitly configured vault files, outside the project repository; vault sync/backups have their own privacy rules. Rendering is local: no Docker or rendering server. Typst is the internal PDF typesetting engine, not Markdown or LaTeX.",
      ],
    ]) {
      this.contentEl.createEl("h3", { text: title });
      this.contentEl.createEl("p", { text });
    }
    new Setting(this.contentEl).addButton((button) =>
      button.setButtonText("Done").onClick(() => this.close()),
    );
  }
  onClose(): void {
    this.contentEl.empty();
  }
}
