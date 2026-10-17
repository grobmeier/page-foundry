/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import assert from "node:assert/strict";
import { it } from "node:test";
import { buildSync } from "esbuild";
import { runInNewContext } from "node:vm";
import { NOTE_TEMPLATES } from "../src/notes/model";

const code = buildSync({
  entryPoints: ["src/ui/noteModal.ts"],
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
  options = new Map<string, string>();
  click: () => unknown = () => {};
  change: (value: string) => void = () => {};
  empty() {
    this.children = [];
  }
  addClass() {}
  setAttribute() {}
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
}
function setup(
  kind = "letter",
  save: (...args: unknown[]) => Promise<void> = async () => {},
) {
  const values = {
    title: "Letter",
    "sender-address": "12 Example Road",
    author: "",
    closing: "Retain this",
  };
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
    name = "";
    constructor(parent: Element) {
      this.row = parent.createDiv();
    }
    setName(name: string) {
      this.name = name;
      return this;
    }
    setDesc() {
      return this;
    }
    control(tag: string, fn: (field: unknown) => unknown) {
      const el = this.row.createEl(tag);
      el.label = this.name;
      const field = {
        setValue(value: string) {
          el.value = value;
          return field;
        },
        addOption(key: string, label: string) {
          el.options.set(key, label);
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
      return this.control("input", fn);
    }
    addTextArea(fn: (field: unknown) => unknown) {
      return this.control("textarea", fn);
    }
    addDropdown(fn: (field: unknown) => unknown) {
      return this.control("select", fn);
    }
    addButton(fn: (button: unknown) => unknown) {
      const el = this.row.createEl("button");
      const button = {
        setButtonText(label: string) {
          el.textContent = label;
          return button;
        },
        setCta() {
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
  }
  const module = {
    exports: {} as {
      NoteModal: new (...args: unknown[]) => Modal & { onOpen(): void };
    },
  };
  runInNewContext(code, {
    module,
    exports: module.exports,
    TextEncoder,
    Error,
    require: () => ({
      Modal,
      SuggestModal: class {},
      Setting,
      Notice: class {},
    }),
  });
  const modal = new module.exports.NoteModal(
    {},
    NOTE_TEMPLATES[0],
    { ...values },
    "",
    "Letter.md",
    true,
    save,
    kind,
  );
  modal.onOpen();
  const field = (label: string) => {
    const found = modal.contentEl.all().find((el) => el.label === label);
    assert.ok(found, label);
    return found;
  };
  const button = (label: string) => {
    const found = modal.contentEl
      .all()
      .find((el) => el.tag === "button" && el.textContent === label);
    assert.ok(found, label);
    return found;
  };
  return { modal, field, button };
}
it("switches fields in place, retains entered values and sends only edits on explicit Save", async () => {
  const saved: unknown[][] = [];
  const h = setup("letter", async (...args) => {
    saved.push(args);
  });
  assert.deepEqual(
    [...h.field("Document type").options.keys()],
    ["plain", "letter", "submission-letter", "manuscript"],
  );
  assert.ok(
    !h.modal.contentEl
      .all()
      .some((el) => /Legacy|Salutation|Closing/.test(el.label)),
  );
  h.field("Sender address").change("A changed address");
  h.field("Document type").change("manuscript");
  h.field("Header surname").change("Example");
  h.field("Document type").change("letter");
  assert.equal(h.field("Sender address").value, "A changed address");
  h.field("Document type").change("plain");
  assert.equal(saved.length, 0);
  await h.button("Save details").click();
  assert.equal(saved.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(saved[0])), [
    "Letter.md",
    { "sender-address": "A changed address", surname: "Example" },
    false,
    "plain",
  ]);
  assert.equal(h.modal.closed, true);
});
it("Cancel never saves and unknown types remain an explicit choice", async () => {
  let writes = 0;
  const h = setup("unknown", async () => {
    writes++;
  });
  assert.equal(h.field("Document type").value, "unknown");
  assert.ok(
    h.modal.contentEl
      .all()
      .some((el) => el.textContent.includes("unrecognised")),
  );
  h.field("Document type").change("letter");
  h.field("Sender address").change("Unsaved address");
  await h.button("Cancel").click();
  assert.equal(writes, 0);
});
it("disables the selector during saving and restores it on failure without losing changes", async () => {
  let reject!: (error: Error) => void;
  const h = setup(
    "letter",
    () =>
      new Promise<void>((_resolve, fail) => {
        reject = fail;
      }),
  );
  h.field("Sender address").change("Pending address");
  const saving = h.button("Save details").click();
  assert.equal(h.field("Document type").disabled, true);
  await h.button("Cancel").click();
  assert.equal(h.modal.closed, false);
  reject(new Error("Source changed"));
  await saving;
  assert.equal(h.field("Document type").disabled, false);
  assert.equal(h.modal.closed, false);
  assert.ok(
    h.modal.contentEl
      .all()
      .some((el) => el.textContent.includes("Source changed")),
  );
});
