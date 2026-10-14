/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import assert from "node:assert/strict";
import { it } from "node:test";
import { buildSync } from "esbuild";
import { runInNewContext } from "node:vm";
import { editableBook } from "../src/books/editor";
import type { BookManifest } from "../src/books/manifest";

const code = buildSync({
  entryPoints: ["src/ui/bookModal.ts"],
  bundle: true,
  write: false,
  format: "cjs",
  external: ["obsidian"],
}).outputFiles[0]!.text;
class Element {
  children: Element[] = [];
  textContent = "";
  tag = "div";
  label = "";
  value = "";
  disabled = false;
  attributes = new Map<string, string>();
  click: () => unknown = () => {};
  change: (value: string) => void = () => {};
  empty() {
    this.children = [];
  }
  addClass() {}
  setAttribute(key: string, value: string) {
    this.attributes.set(key, value);
  }
  createEl(tag: string, options: { text?: string } = {}) {
    const child = new Element();
    child.tag = tag;
    child.textContent = options.text ?? "";
    this.children.push(child);
    return child;
  }
  createDiv() {
    return this.createEl("div");
  }
  all(): Element[] {
    return this.children.flatMap((child) => [child, ...child.all()]);
  }
  querySelectorAll(selector: string) {
    return this.all().filter((element) =>
      selector.split(", ").includes(element.tag),
    );
  }
  querySelector(selector: string) {
    return this.all().find((element) => element.tag === selector) ?? null;
  }
  focus() {}
}
function setup(
  book = editableBook(),
  save: (path: string, book: BookManifest) => Promise<void> = async () => {},
) {
  const notices: string[] = [];
  class Modal {
    contentEl = new Element();
    modalEl = new Element();
    closed = false;
    close() {
      this.closed = true;
    }
  }
  class Setting {
    row: Element;
    name: Element;
    description: Element;
    constructor(parent: Element) {
      this.row = parent.createDiv();
      this.name = this.row.createEl("span");
      this.description = this.row.createEl("span");
    }
    setName(name: string) {
      this.name.textContent = name;
      return this;
    }
    setDesc(text: string) {
      this.description.textContent = text;
      return this;
    }
    addButton(fn: (button: unknown) => unknown) {
      const el = this.row.createEl("button");
      const button = {
        setButtonText(text: string) {
          el.textContent = text;
          return button;
        },
        setCta() {
          return button;
        },
        setDisabled(disabled: boolean) {
          el.disabled = disabled;
          return button;
        },
        onClick(handler: () => unknown) {
          el.click = handler;
          return button;
        },
      };
      fn(button);
      return this;
    }
    field(tag: string, fn: (field: unknown) => unknown) {
      const el = this.row.createEl(tag);
      el.label = this.name.textContent;
      const field = {
        setValue(value: string) {
          el.value = value;
          return field;
        },
        setDisabled(disabled: boolean) {
          el.disabled = disabled;
          return field;
        },
        addOption() {
          return field;
        },
        onChange(handler: (value: string) => void) {
          el.change = handler;
          return field;
        },
      };
      fn(field);
      return this;
    }
    addText(fn: (field: unknown) => unknown) {
      return this.field("input", fn);
    }
    addTextArea(fn: (field: unknown) => unknown) {
      return this.field("textarea", fn);
    }
    addDropdown(fn: (field: unknown) => unknown) {
      return this.field("select", fn);
    }
  }
  const module = {
    exports: {} as {
      BookModal: new (...args: unknown[]) => Modal & { onOpen(): void };
    },
  };
  runInNewContext(code, {
    module,
    exports: module.exports,
    crypto,
    Error,
    TextEncoder,
    require: () => ({
      Modal,
      Setting,
      Notice: class {
        constructor(message: string) {
          notices.push(message);
        }
      },
    }),
  });
  const modal = new module.exports.BookModal(
    {},
    book,
    "My Book.book.md",
    false,
    save,
  );
  modal.onOpen();
  const button = (label: string, index = 0) => {
    const found = modal.contentEl
      .all()
      .filter((e) => e.tag === "button" && e.textContent === label)[index];
    assert.ok(found, label);
    return found;
  };
  const field = (label: string, index = 0) => {
    const found = modal.contentEl.all().filter((e) => e.label === label)[index];
    assert.ok(found, label);
    return found;
  };
  return { modal, button, field, notices };
}
it("adds editable sections without IDs, updates validation in place and cancels without saving", async () => {
  let saves = 0;
  const h = setup(undefined, async () => {
    saves++;
  });
  assert.equal(h.button("Save book plan").disabled, true);
  h.button("Add section").click();
  assert.equal(h.button("Save book plan").disabled, true);
  h.field("Note path").change("Book/Chapter One.md");
  assert.equal(h.button("Save book plan").disabled, false);
  h.field("Book plan file").change("../outside.md");
  assert.equal(h.button("Save book plan").disabled, true);
  h.field("Book plan file").change("My Book.book.md");
  assert.equal(h.button("Save book plan").disabled, false);
  assert.equal(
    h.modal.contentEl.all().some((e) => e.textContent.includes("section-")),
    false,
  );
  assert.equal(
    h.modal.contentEl
      .all()
      .some((e) => e.textContent.includes("page-foundry-book")),
    false,
  );
  assert.ok(
    h.modal.contentEl
      .all()
      .filter((e) => e.tag === "details")
      .some((e) => e.attributes.has("open")),
  );
  h.field("Book title").change("");
  assert.equal(h.button("Save book plan").disabled, true);
  h.button("Cancel").click();
  assert.equal(h.modal.closed, true);
  assert.equal(saves, 0);
});
it("moves and removes sections while preserving IDs and uses explicit Save", async () => {
  const book = editableBook();
  book.entries = [
    { id: "one", role: "chapter", path: "Book/One.md" },
    { id: "two", role: "chapter", path: "Book/Two.md" },
  ];
  const saved: BookManifest[] = [];
  const h = setup(book, async (_path, draft) => {
    saved.push(draft);
  });
  h.button("Move down").click();
  assert.equal(book.entries[0]!.id, "two");
  assert.equal(saved.length, 0);
  h.button("Remove", 1).click();
  assert.equal(book.entries.length, 1);
  await h.button("Save book plan").click();
  assert.equal(saved[0]!.entries[0]!.id, "two");
  assert.equal(h.modal.closed, true);
});
it("prevents concurrent saves and keeps failed/stale saves editable", async () => {
  const book = editableBook();
  book.entries = [{ id: "one", role: "chapter", path: "Book/One.md" }];
  let reject!: (error: Error) => void,
    saves = 0;
  const h = setup(book, () => {
    saves++;
    return new Promise((_resolve, fail) => {
      reject = fail;
    });
  });
  const button = h.button("Save book plan");
  const pending = button.click();
  await button.click();
  assert.equal(saves, 1);
  assert.equal(button.disabled, true);
  reject(new Error("The book plan changed. Nothing was overwritten."));
  await pending;
  assert.equal(h.modal.closed, false);
  assert.equal(h.button("Save book plan").disabled, false);
  assert.ok(h.notices[0]!.includes("Nothing was overwritten"));
});
