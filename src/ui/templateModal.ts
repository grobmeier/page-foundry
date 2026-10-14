/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import { App, SuggestModal } from "obsidian";
import { searchTemplates, type Template } from "../templates/catalog";
export class TemplateModal extends SuggestModal<Template> {
  constructor(
    app: App,
    private readonly templates: Template[],
    private readonly choose: (template: Template) => void,
    recent = false,
    private readonly kind = "plain",
    private readonly expanded = false,
  ) {
    super(app);
    this.modalEl.addClass("page-foundry-template-picker");
    this.setPlaceholder(
      recent
        ? "Recent output presets — search by name, size or format"
        : "Change layout — search layouts, EPUB, Amazon or sizes…",
    );
    this.setInstructions([
      { command: "↑↓", purpose: "choose an output preset" },
      { command: "↵", purpose: "continue" },
      { command: "esc", purpose: "cancel" },
    ]);
  }
  getSuggestions(query: string): Template[] {
    if (query.trim() || this.expanded)
      return searchTemplates(this.templates, query);
    const id =
      this.kind === "submission-letter"
        ? "submission-letter"
        : this.kind === "letter"
          ? "letter"
          : this.kind === "manuscript"
            ? "general-manuscript"
            : "plain-document";
    const basics = this.templates.filter(
      (t) =>
        (t.profile === "a4" &&
          t.format === "pdf" &&
          (t.preset === id || t.preset.includes(":"))) ||
        (this.kind !== "letter" &&
          this.kind !== "submission-letter" &&
          ((t.format === "epub" && t.preset === "reflowable-ebook") ||
            (t.format === "docx" &&
              t.profile === "a4" &&
              t.preset ===
                (this.kind === "manuscript"
                  ? "general-manuscript"
                  : "plain-editable")))),
    );
    return basics.length === this.templates.length
      ? basics
      : [
          ...basics,
          {
            key: "more",
            name: "More layouts…",
            search: "more",
            format: "pdf",
            preset: "plain-document",
            profile: "a4",
          },
        ];
  }
  renderSuggestion(template: Template, el: HTMLElement): void {
    el.createEl("div", { text: template.name });
  }
  onChooseSuggestion(template: Template): void {
    if (template.key === "more") {
      new TemplateModal(
        this.app,
        this.templates,
        this.choose,
        false,
        this.kind,
        true,
      ).open();
      return;
    }
    this.choose(template);
  }
}
