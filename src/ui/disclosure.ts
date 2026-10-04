/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
/** Native disclosure preserves keyboard support and form focus. */
export function disclosure(parent: HTMLElement, label: string): HTMLElement {
  const details = parent.createEl("details", { cls: "page-foundry-details" });
  details.createEl("summary", { text: label });
  return details;
}
