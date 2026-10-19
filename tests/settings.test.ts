/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import assert from "node:assert/strict";
import { it } from "node:test";
import { buildSync } from "esbuild";
import { runInNewContext } from "node:vm";
import type * as SettingsModule from "../src/settings";

it("shares searchable settings definitions with the older-host display and persists changes", async () => {
  const code = buildSync({
    entryPoints: ["src/settings.ts"],
    bundle: true,
    format: "cjs",
    write: false,
    external: ["obsidian"],
  }).outputFiles[0]!.text;
  const names: string[] = [];
  const edits = new Map<string, (value: string) => Promise<void>>();
  const actions = new Map<string, () => Promise<void>>();
  class Setting {
    name = "";
    constructor(_container?: unknown) {}
    setName(name: string) {
      this.name = name;
      names.push(name);
      return this;
    }
    setDesc() {
      return this;
    }
    addText(render: (control: unknown) => void) {
      return this.control(render);
    }
    addTextArea(render: (control: unknown) => void) {
      return this.control(render);
    }
    control(render: (control: unknown) => void) {
      const name = this.name;
      const control = {
        setValue() {
          return control;
        },
        setPlaceholder() {
          return control;
        },
        onChange(fn: (value: string) => Promise<void>) {
          edits.set(name, fn);
          return control;
        },
      };
      render(control);
      return this;
    }
    addButton(render: (control: unknown) => void) {
      const name = this.name;
      const control = {
        setButtonText() {
          return control;
        },
        onClick(fn: () => Promise<void>) {
          actions.set(name, fn);
          return control;
        },
      };
      render(control);
      return this;
    }
  }
  class Tab {
    containerEl = {
      empty() {
        names.length = 0;
      },
    };
  }
  const module = { exports: {} as typeof SettingsModule };
  runInNewContext(code, {
    module,
    exports: module.exports,
    require: () => ({ App: class {}, PluginSettingTab: Tab, Setting }),
  });
  let saves = 0;
  const plugin = {
    settings: structuredClone(module.exports.DEFAULT_SETTINGS),
    saveSettings: async () => {
      saves++;
    },
    openDesigns() {},
  };
  const tab = new module.exports.PageFoundrySettingTab(
    {} as never,
    plugin as never,
  );
  const definitions = tab.getSettingDefinitions();
  assert.equal(definitions.length, 7);
  assert.equal(saves, 0, "Search indexing must not write settings");
  for (const row of definitions)
    row.render(new Setting().setName(row.name) as never);
  const indexed = [...names];
  tab.display();
  assert.deepEqual(names, indexed, "Old and new hosts must show the same rows");
  await edits.get("Output folder")!("  Published  ");
  assert.equal(plugin.settings.outputFolder, "Published");
  await edits.get("Private note templates")!(
    "Drafts/Letter.md\n\nDrafts/Book.md",
  );
  assert.deepEqual(
    [...plugin.settings.noteTemplatePaths],
    ["Drafts/Letter.md", "Drafts/Book.md"],
  );
  await edits.get("Default publication language")!("");
  assert.equal(plugin.settings.defaultLanguage, "en");
  plugin.settings.noteLayouts = [{ noteKey: "kept", layoutKey: "kept" }];
  await actions.get("Recent and most-used templates")!();
  assert.equal(plugin.settings.noteLayouts.length, 0);
  assert.equal(saves, 4);
});
