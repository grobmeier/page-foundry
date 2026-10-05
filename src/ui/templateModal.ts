/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import { App, SuggestModal } from "obsidian";
import { searchTemplates, type Template } from "../templates/catalog";
export class TemplateModal extends SuggestModal<Template> {
  constructor(
    app: App,
    private readonly templates: Template[],
    private readonly choose: (template: Template) => void,
    recent = false,
  ) {
    super(app);
    this.modalEl.addClass("page-foundry-template-picker");
    this.setPlaceholder(
      recent
        ? "Recent output presets — search by name, size or format"
        : "Publish — search letter, manuscript, EPUB, Amazon, size…",
    );
    this.setInstructions([
      { command: "↑↓", purpose: "choose a template" },
      { command: "↵", purpose: "continue" },
      { command: "esc", purpose: "cancel" },
    ]);
  }
  getSuggestions(query: string): Template[] {
    return searchTemplates(this.templates, query);
  }
  renderSuggestion(template: Template, el: HTMLElement): void {
    el.createEl("div", { text: template.name });
  }
  onChooseSuggestion(template: Template): void {
    this.choose(template);
  }
}
