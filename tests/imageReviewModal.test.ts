/*
 * Copyright 2026 Christian Grobmeier
 * Licensed under the Apache License, Version 2.0.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSync } from "esbuild";
import { runInNewContext } from "node:vm";
import type { ImageReview } from "../src/core/images";
import type { ExportChoice } from "../src/ui/exportModal";

const code = buildSync({
  entryPoints: ["src/ui/exportModal.ts"],
  bundle: true,
  write: false,
  format: "cjs",
  external: ["obsidian"],
}).outputFiles[0]!.text;

function setup(errors: string[] = []) {
  const buttons: { label: string; disabled: boolean; click(): void }[] = [];
  const controls = new Map<string, (value: string) => void>();
  const text: string[] = [];
  const published: ExportChoice[] = [];
  let refreshes = 0;
  class Modal {
    closed = false;
    contentEl = {
      empty() {
        text.length = 0;
        buttons.length = 0;
      },
      createEl(_tag: string, options: { text: string }) {
        text.push(options.text);
      },
    };
    modalEl = { addClass() {} };
    close() {
      this.closed = true;
    }
  }
  class Setting {
    name = "";
    setName(name: string) {
      this.name = name;
      return this;
    }
    setDesc() {
      return this;
    }
    addDropdown(fn: (control: unknown) => unknown) {
      return this.control(fn);
    }
    addText(fn: (control: unknown) => unknown) {
      return this.control(fn);
    }
    control(fn: (control: unknown) => unknown) {
      const name = this.name;
      const control = {
        addOption() {
          return control;
        },
        setValue() {
          return control;
        },
        onChange(handler: (value: string) => void) {
          controls.set(name, handler);
          return control;
        },
      };
      fn(control);
      return this;
    }
    addButton(fn: (button: unknown) => unknown) {
      const entry = { label: "", disabled: false, click() {} };
      const button = {
        setButtonText(label: string) {
          entry.label = label;
          return button;
        },
        setCta() {
          return button;
        },
        setDisabled(value: boolean) {
          entry.disabled = value;
          return button;
        },
        onClick(handler: () => void) {
          entry.click = handler;
          return button;
        },
      };
      buttons.push(entry);
      fn(button);
      return this;
    }
  }
  const module = {
    exports: {} as {
      ExportModal: new (...args: unknown[]) => Modal & { onOpen(): void };
    },
  };
  runInNewContext(code, {
    module,
    exports: module.exports,
    require() {
      return { Modal, Setting };
    },
  });
  const review: ImageReview = {
    document: {
      title: "Images",
      metadata: {},
      blocks: [],
      images: {
        "image-1": {
          id: "image-1",
          path: "Artwork/panel.png",
          bytes: new Uint8Array([1]),
          mediaType: "image/png",
          extension: "png",
          width: 480,
          height: 240,
        },
      },
    },
    errors,
    warnings: ["Add descriptive alt text."],
    signature: "review",
  };
  const modal = new module.exports.ExportModal(
    {},
    {
      format: "pdf",
      preset: "letter",
      profile: "a4",
      language: "en",
      outputName: "Images",
      destination: "vault",
    },
    (choice: ExportChoice) => published.push(choice),
    review,
    () => refreshes++,
  );
  modal.onOpen();
  function button(label: string) {
    const entry = buttons.find((button) => button.label === label);
    assert.ok(entry);
    return entry;
  }
  return {
    modal,
    text,
    published,
    controls,
    button,
    refreshes: () => refreshes,
  };
}

describe("image review dialog", () => {
  it("lists reviewed resources and advisory alt warnings without blocking export", () => {
    const host = setup();
    assert.equal(
      host.text.filter((value) => value.includes("Artwork/panel.png")).length,
      1,
    );
    assert.ok(host.text.some((value) => value.startsWith("Advice:")));
    assert.equal(host.button("Create PDF").disabled, false);
    host.button("Create PDF").click();
    assert.equal(host.published.length, 1);
    assert.equal(host.modal.closed, true);
  });
  it("blocks problematic exports even if the disabled callback is invoked, and supports refresh", () => {
    const host = setup(["Missing image."]);
    assert.equal(host.button("Create PDF").disabled, true);
    host.button("Create PDF").click();
    assert.equal(host.published.length, 0);
    assert.equal(host.modal.closed, false);
    host.button("Refresh image review").click();
    assert.equal(host.refreshes(), 1);
    assert.equal(host.modal.closed, true);
  });
  it("retains image review while choosing a compatible preset for another format", () => {
    const host = setup();
    host.controls.get("Output format")!("epub");
    assert.ok(host.text.some((value) => value.includes("Artwork/panel.png")));
    host.button("Create EPUB").click();
    assert.equal(host.published[0]!.preset, "reflowable-ebook");
  });
});
