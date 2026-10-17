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
import { parseMarkdown } from "../src/core/markdown";

const code = buildSync({
  entryPoints: ["src/ui/exportModal.ts"],
  bundle: true,
  write: false,
  format: "cjs",
  external: ["obsidian"],
}).outputFiles[0]!.text;

function setup(
  errors: string[] = [],
  source = "A neutral draft paragraph.",
  clipboard?: { writeText(value: string): Promise<void> },
  book = false,
) {
  const buttons: { label: string; disabled: boolean; click(): void }[] = [];
  const controls = new Map<string, (value: string) => void>();
  const text: string[] = [];
  const published: ExportChoice[] = [];
  let refreshes = 0;
  const notices: string[] = [];
  class Modal {
    closed = false;
    contentEl = {
      empty() {
        text.length = 0;
        buttons.length = 0;
      },
      createEl(_tag: string, options: { text: string }) {
        const index = text.length;
        text.push(options.text ?? "");
        return {
          createEl: this.createEl.bind(this),
          setAttribute() {},
          get textContent() {
            return text[index] ?? "";
          },
          set textContent(value: string) {
            text[index] = value;
          },
        };
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
    addTextArea(fn: (control: unknown) => unknown) {
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
    TextEncoder,
    navigator: { clipboard },
    module,
    exports: module.exports,
    require() {
      return {
        Modal,
        Setting,
        Notice: class {
          constructor(message: string) {
            notices.push(message);
          }
        },
      };
    },
  });
  const review: ImageReview = {
    document: {
      ...parseMarkdown(source, "Images"),
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
  if (book)
    review.document.book = {
      entries: [
        {
          id: "one",
          role: "chapter",
          title: "Chapter One",
          path: "Book/One.md",
        },
        { id: "part", role: "part", title: "Part Two" },
      ],
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
    notices,
  };
}

describe("image review dialog", () => {
  it("offers print controls only for the book PDF recipe and keeps options export-only", () => {
    const host = setup([], "A neutral chapter.", undefined, true);
    host.controls.get("Layout")!("paperback-interior");
    assert.ok(host.controls.has("Paperback trim"));
    host.controls.get("Paperback trim")!("5x8");
    host.controls.get("Paper (black ink)")!("cream");
    host.controls.get("Part/chapter starts")!("next");
    assert.ok(host.text.some((value) => value.includes("5 × 8 in")));
    host.button("Create PDF").click();
    assert.equal(host.published[0]!.printOptions!.trim, "5x8");
    assert.equal(host.published[0]!.printOptions!.paper, "cream");
    assert.equal(host.published[0]!.printOptions!.recto, false);
    assert.equal(host.published[0]!.metadata!.trim, undefined);
    host.controls.get("Output format")!("epub");
    host.button("Create EPUB").click();
    assert.notEqual(host.published.at(-1)!.preset, "paperback-interior");
  });
  it("shows book inclusion order and refresh without retaining a letter preset", () => {
    const host = setup([], "A neutral chapter.", undefined, true);
    assert.ok(host.text.includes("Publish this book"));
    assert.ok(host.text.includes("1. Chapter One · Chapter"));
    assert.ok(host.text.includes("2. Part Two · Part"));
    host.button("Create PDF").click();
    assert.equal(host.published.length, 1);
    assert.notEqual(host.published[0]!.preset, "letter");
    host.button("Refresh book review").click();
    assert.equal(host.refreshes(), 1);
  });
  it("blocks empty content even when Create's disabled callback is invoked", () => {
    const host = setup([], "");
    assert.equal(host.button("Create PDF").disabled, true);
    host.button("Create PDF").click();
    assert.equal(host.published.length, 0);
    assert.ok(
      host.text.some((value) => value.includes("no exportable body content")),
    );
  });
  it("updates the report while typing and blocks broken heading links only in EPUB", () => {
    const host = setup([], "# Chapter\n\n[Jump](#missing)");
    host.controls.get("Layout")!("plain-document");
    assert.equal(host.button("Create PDF").disabled, false);
    host.controls.get("Author")!("Alex Example");
    assert.ok(
      !host.text.some((value) => value.includes("No author is supplied")),
    );
    host.controls.get("Output format")!("epub");
    assert.equal(host.button("Create EPUB").disabled, true);
    host.button("Create EPUB").click();
    assert.equal(host.published.length, 0);
    assert.ok(
      host.text.some((value) => value.includes("no destination in this note")),
    );
  });
  it("copies only on request and truthfully reports clipboard failure", async () => {
    const copies: string[] = [];
    const host = setup([], "A draft.", {
      async writeText(value) {
        copies.push(value);
      },
    });
    assert.equal(copies.length, 0);
    await host.button("Copy preflight report").click();
    assert.match(copies[0]!, /Not checked:/);
    assert.ok(host.notices.some((value) => value.includes("report copied")));
    const denied = setup([], "A draft.", {
      async writeText() {
        throw new Error("Denied");
      },
    });
    await denied.button("Copy preflight report").click();
    assert.ok(denied.notices.some((value) => value.includes("Could not copy")));
    assert.equal(denied.button("Create PDF").disabled, false);
  });
  it("requires submission metadata and resets export-only values when changing preset", () => {
    const host = setup();
    host.controls.get("Layout")!("submission-letter");
    assert.equal(host.button("Create PDF").disabled, true);
    host.controls.get("Sender name")!("Alex Example");
    host.controls.get("Recipient name")!("Jamie Example");
    host.controls.get("Subject")!("Export only subject");
    assert.equal(host.button("Create PDF").disabled, false);
    host.controls.get("Layout")!("letter");
    host.button("Create PDF").click();
    assert.equal(host.published[0]!.metadata!.subject, "");
    assert.equal(host.published[0]!.metadata!.author, undefined);
  });
  it("does not carry an edited language to another preset and updates the page-size review", () => {
    const host = setup();
    host.controls.get("Layout")!("readable-plain");
    host.controls.get("Publication language")!("de");
    host.controls.get("Layout")!("plain-document");
    host.controls.get("Page size")!("us-letter");
    assert.ok(host.text.some((value) => value.startsWith("US Letter;")));
    host.controls.get("Output format")!("epub");
    host.button("Create EPUB").click();
    assert.equal(host.published[0]!.metadata!.language, "en");
  });
  it("lists reviewed resources and advisory alt warnings without blocking export", () => {
    const host = setup();
    assert.equal(
      host.text.filter((value) => value.includes("Artwork/panel.png")).length,
      1,
    );
    assert.ok(host.text.some((value) => value.includes("Advice:")));
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
