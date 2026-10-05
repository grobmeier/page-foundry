/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import { App, Modal, Notice, Setting } from "obsidian";
import { CORE_PACK } from "../packs/core";
import type { PackPreset, PresetPack } from "../packs/model";
import { editablePreset, updatedPack, type PresetEdits } from "../packs/editor";
export class PresetEditorModal extends Modal {
  private target = "new";
  private base = CORE_PACK.presets.find((p) => p.id === "readable-plain")!;
  private presetId = `layout-${crypto.randomUUID()}`;
  private edits: PresetEdits = { name: "My layout" };
  private busy = false;
  constructor(
    app: App,
    private pack: PresetPack | undefined,
    private path: string,
    private save: (path: string, source: string) => Promise<void>,
  ) {
    super(app);
  }
  onOpen(): void {
    this.modalEl.addClass("page-foundry-modal");
    this.render();
  }
  private render(): void {
    this.contentEl.empty();
    this.contentEl.createEl("h2", { text: "Manage output presets" });
    this.contentEl.createEl("p", {
      text: "Save local layout settings, not a note template. No upload occurs. Fonts and recipes are limited to the portable engine; arbitrary Typst/LaTeX code is not supported. EPUB readers may override your settings.",
    });
    new Setting(this.contentEl).setName("Preset").addDropdown((d) => {
      d.addOption("new", "Create a new output preset");
      for (const p of this.pack?.presets ?? []) d.addOption(p.id, p.name);
      d.setValue(this.target).onChange((value) => {
        this.target = value;
        if (value === "new") {
          this.base = CORE_PACK.presets.find((p) => p.id === "readable-plain")!;
          this.presetId = `layout-${crypto.randomUUID()}`;
          this.edits = { name: "My layout" };
        } else {
          this.base = this.pack!.presets.find((p) => p.id === value)!;
          this.presetId = this.base.id;
          this.edits = { name: this.base.name };
        }
        this.render();
      });
    });
    if (this.target === "new")
      new Setting(this.contentEl).setName("Start from").addDropdown((d) => {
        for (const p of CORE_PACK.presets) d.addOption(p.id, p.name);
        d.setValue(this.base.id).onChange((value) => {
          this.base = CORE_PACK.presets.find((p) => p.id === value)!;
          this.edits = { name: this.edits.name };
          this.render();
        });
      });
    new Setting(this.contentEl).setName("Preset name").addText((t) =>
      t.setValue(this.edits.name).onChange((v) => {
        this.edits.name = v;
      }),
    );
    new Setting(this.contentEl)
      .setName("Private pack file")
      .setDesc(
        "Exact JSON path in an existing vault folder. A new pack never replaces an existing file.",
      )
      .addText((t) =>
        t
          .setValue(this.path)
          .setDisabled(Boolean(this.pack))
          .onChange((v) => {
            this.path = v;
          }),
      );
    const formats = Object.keys(this.base.outputs);
    this.contentEl.createEl("p", {
      text: `Outputs: ${formats.map((f) => f.toUpperCase()).join(", ")}. Existing recipe-specific fields and styles are retained unless you supply an override.`,
    });
    if (this.base.outputs.pdf?.recipe === "paperback-interior")
      this.contentEl.createEl("p", {
        text: "Paperback margins and black ink are fixed by measured proof rules; this editor does not override them. Trim, paper and chapter starts are chosen when publishing.",
      });
    const status = this.contentEl.createEl("p");
    status.setAttribute("aria-live", "polite");
    const invalid = new Set<string>();
    for (const [key, label, range] of [
      ["bodySizePt", "Body size (pt)", "8–24"],
      ["marginXmm", "Horizontal margins (mm)", "12–40"],
      ["marginYmm", "Vertical margins (mm)", "12–40"],
      ["lineSpacing", "Line spacing", "1–3"],
    ] as const) {
      if (formats.every((f) => f === "epub") && key !== "lineSpacing") continue;
      if (
        this.base.outputs.pdf?.recipe === "paperback-interior" &&
        key.startsWith("margin")
      )
        continue;
      const defaults = formats
        .map((format) => this.base.outputs[format as "pdf"]?.style?.[key])
        .filter((v) => v !== undefined);
      new Setting(this.contentEl)
        .setName(label)
        .setDesc(
          `${range}. Blank retains each output’s current setting${defaults.length ? ` (${[...new Set(defaults)].join(" / ")})` : ""}.`,
        )
        .addText((t) =>
          t.setValue(this.edits[key]?.toString() ?? "").onChange((v) => {
            if (!v.trim()) {
              delete this.edits[key];
              invalid.delete(key);
            } else {
              const number = Number(v);
              if (!Number.isFinite(number)) invalid.add(key);
              else {
                this.edits[key] = number;
                invalid.delete(key);
              }
            }
            status.textContent = invalid.size
              ? "Enter a number or leave the override blank."
              : "";
          }),
        );
    }
    if (this.base.outputs.pdf?.recipe !== "paperback-interior")
      new Setting(this.contentEl)
        .setName("Text colour")
        .setDesc(
          "Optional six-digit hex colour, for example #243b53. Blank keeps current colours.",
        )
        .addText((t) =>
          t.setValue(this.edits.color ?? "").onChange((v) => {
            this.edits.color = v.trim() || undefined;
          }),
        );
    for (const format of ["pdf", "docx", "epub"] as const) {
      if (!this.base.outputs[format]) continue;
      const fonts =
        format === "pdf"
          ? ["Libertinus Serif"]
          : format === "docx"
            ? ["Times New Roman", "Arial", "Calibri", "Courier New"]
            : ["serif", "sans-serif", "monospace"];
      new Setting(this.contentEl)
        .setName(`${format.toUpperCase()} font`)
        .addDropdown((d) => {
          d.addOption("", "Keep current font");
          for (const font of fonts) d.addOption(font, font);
          d.setValue(this.edits.fonts?.[format] ?? "").onChange((v) => {
            this.edits.fonts = { ...this.edits.fonts, [format]: v };
          });
        });
    }
    new Setting(this.contentEl)
      .addButton((b) =>
        b.setButtonText("Cancel").onClick(() => {
          if (!this.busy) this.close();
        }),
      )
      .addButton((b) =>
        b
          .setButtonText("Save private output preset")
          .setCta()
          .onClick(async () => {
            if (this.busy) return;
            try {
              if (invalid.size)
                throw new Error(
                  "Enter valid numbers or leave overrides blank.",
                );
              const source = updatedPack(
                this.pack,
                editablePreset(this.base, this.presetId, this.edits),
              );
              this.busy = true;
              for (const el of this.contentEl.querySelectorAll<HTMLInputElement>(
                "input, select, button",
              ))
                el.disabled = true;
              await this.save(this.path, source);
              this.close();
            } catch (e) {
              const message =
                e instanceof Error
                  ? e.message
                  : "Could not save this output preset.";
              status.textContent = message;
              new Notice(message);
            } finally {
              this.busy = false;
              for (const el of this.contentEl.querySelectorAll<HTMLInputElement>(
                "input, select, button",
              ))
                el.disabled = false;
            }
          }),
      );
  }
  onClose(): void {
    this.contentEl.empty();
  }
}
