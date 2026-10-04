/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import { Modal, Setting } from "obsidian";
export class CheatSheetModal extends Modal {
  onOpen(): void {
    this.modalEl.addClass("page-foundry-modal");
    this.contentEl.createEl("h2", { text: "Page Foundry: Cheat Sheet" });
    for (const [title, text] of [
      [
        "Create",
        "Open a note or book plan. Run Create, choose a template, check the short form, then Create PDF, EPUB or DOCX. Your writing stays unchanged.",
      ],
      [
        "Recent templates",
        "Create recent lists templates you have used. Create puts your most-used choices first. Search by purpose, size or format. Export history does not reuse personal information.",
      ],
      [
        "Books",
        "Use Set up book to choose and order opening pages, parts, chapters, scenes and closing pages. Enter exact note paths; only those notes and their images are included. Open the book plan and use Create.",
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
        "Missing required information or broken resources prevent Create. Details contains advice and reports. Paperback templates produce no-bleed black-ink proofs, not upload certification. Inspect every PDF page, use the retailer preview and order a physical proof.",
      ],
      [
        "Your designs",
        "Settings offers an output folder, default language and an optional private template-pack file. Private designs stay outside the project repository. Rendering is local: no Docker or rendering server.",
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
