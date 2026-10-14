/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import assert from "node:assert/strict";
import { it } from "node:test";
import { buildSync } from "esbuild";
import { runInNewContext } from "node:vm";
import {
  parsePack,
  type PackPreset,
  type PresetPack,
} from "../src/packs/model";
import { updatedPack } from "../src/packs/editor";
import { newBookDesign } from "../src/books/designEditor";
import { CORE_PACK } from "../src/packs/core";
const code = buildSync({
  entryPoints: ["src/ui/bookDesignModal.ts"],
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
  value: string | boolean = "";
  disabled = false;
  click: () => unknown = () => {};
  change: (value: any) => void = () => {};
  empty() {
    this.children = [];
  }
  addClass() {}
  setAttribute() {}
  createEl(tag: string, options: { text?: string } = {}) {
    const el = new Element();
    el.tag = tag;
    el.textContent = options.text ?? "";
    this.children.push(el);
    return el;
  }
  createDiv() {
    return this.createEl("div");
  }
  all(): Element[] {
    return this.children.flatMap((c) => [c, ...c.all()]);
  }
  querySelectorAll(selector: string) {
    return this.all().filter((el) => selector.split(", ").includes(el.tag));
  }
}
function setup(
  pack?: PresetPack,
  save: (path: string, source: string) => Promise<void> = async () => {},
  proof?: (preset: PackPreset) => Promise<void>,
) {
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
    label = "";
    constructor(parent: Element) {
      this.row = parent.createDiv();
    }
    setName(label: string) {
      this.label = label;
      return this;
    }
    setDesc() {
      return this;
    }
    field(tag: string, fn: (control: any) => unknown) {
      const el = this.row.createEl(tag);
      el.label = this.label;
      const control = {
        setValue(v: string | boolean) {
          el.value = v;
          return control;
        },
        setDisabled(v: boolean) {
          el.disabled = v;
          return control;
        },
        addOption() {
          return control;
        },
        onChange(handler: Element["change"]) {
          el.change = handler;
          return control;
        },
        setButtonText(v: string) {
          el.textContent = v;
          return control;
        },
        setCta() {
          return control;
        },
        onClick(handler: Element["click"]) {
          el.click = handler;
          return control;
        },
      };
      fn(control);
      return this;
    }
    addText(fn: (v: any) => unknown) {
      return this.field("input", fn);
    }
    addToggle(fn: (v: any) => unknown) {
      return this.field("input", fn);
    }
    addDropdown(fn: (v: any) => unknown) {
      return this.field("select", fn);
    }
    addButton(fn: (v: any) => unknown) {
      return this.field("button", fn);
    }
  }
  const module = {
    exports: {} as {
      BookDesignModal: new (...args: unknown[]) => Modal & { onOpen(): void };
    },
  };
  const notices: string[] = [];
  runInNewContext(code, {
    module,
    exports: module.exports,
    crypto,
    structuredClone,
    TextEncoder,
    Error,
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
  const modal = new module.exports.BookDesignModal(
    {},
    pack,
    "Designs/local.json",
    save,
    proof,
  );
  modal.onOpen();
  return {
    modal,
    notices,
    field: (name: string) =>
      modal.contentEl.all().find((el) => el.label === name)!,
    button: (name: string) =>
      modal.contentEl
        .all()
        .find((el) => el.tag === "button" && el.textContent === name)!,
  };
}
it("saves a friendly book design and rejects invalid visible values even through the callback", async () => {
  const writes: string[] = [];
  const h = setup(undefined, async (_path, source) => {
    writes.push(source);
  });
  h.field("Design name").change("My neutral book");
  h.field("Body size (pt)").change("99");
  await h.button("Save book design").click();
  assert.equal(writes.length, 0);
  h.field("Body size (pt)").change("10");
  await h.button("Save book design").click();
  const pack = parsePack(writes[0]!);
  assert.equal(pack.schemaVersion, 2);
  assert.equal(pack.presets[0]!.name, "My neutral book");
  assert.equal(pack.presets[0]!.outputs.pdf!.style!.bodySizePt, 10);
  assert.equal(h.modal.closed, true);
});
it("defaults an older pack upgrade to a copy and preserves every existing preset", async () => {
  const old = parsePack(
    updatedPack(undefined, { ...CORE_PACK.presets[0]!, id: "old" }),
  );
  const before = structuredClone(old);
  let path = "",
    saved = "";
  const h = setup(old, async (p, s) => {
    path = p;
    saved = s;
  });
  assert.equal(h.field("Save a copy").value, true);
  await h.button("Save book design").click();
  assert.equal(path, "Designs/local-book-designs.json");
  assert.deepEqual(parsePack(saved).presets[0], old.presets[0]);
  assert.deepEqual(old, before);
});
it("duplicates a design with a new ID without mutating the existing design", async () => {
  const original = newBookDesign("original");
  const pack = parsePack(updatedPack(undefined, original));
  let saved = "";
  const h = setup(pack, async (_p, s) => {
    saved = s;
  });
  h.field("Design").change("original");
  h.button("Duplicate design").click();
  await h.button("Save book design").click();
  const result = parsePack(saved);
  assert.equal(result.presets.length, 2);
  assert.notEqual(result.presets[1]!.id, original.id);
  assert.deepEqual(result.presets[0], pack.presets[0]);
});
it("proofs unsaved edits without saving, closing or allowing concurrent actions", async () => {
  let saves = 0,
    proofs = 0;
  let release!: () => void;
  let received: PackPreset | undefined;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const h = setup(
    undefined,
    async () => {
      saves++;
    },
    async (p) => {
      received = p;
      proofs++;
      await pending;
    },
  );
  h.field("Design name").change("Unsaved layout");
  const action = h.button("Create proof").click();
  await h.button("Create proof").click();
  await h.button("Save book design").click();
  h.button("Cancel").click();
  assert.equal(h.modal.closed, false);
  assert.equal(proofs, 1);
  assert.equal(saves, 0);
  release();
  await action;
  assert.equal(received!.name, "Unsaved layout");
  assert.equal(h.modal.closed, false);
});
it("keeps a failed save editable and restores previously disabled path controls", async () => {
  const pack = parsePack(updatedPack(undefined, newBookDesign("neutral")));
  const h = setup(pack, async () => {
    throw new Error("Stale pack");
  });
  assert.equal(h.field("Local pack file").disabled, true);
  await h.button("Save book design").click();
  assert.equal(h.modal.closed, false);
  assert.equal(h.notices.at(-1), "Stale pack");
  assert.equal(h.field("Local pack file").disabled, true);
  assert.equal(h.button("Save book design").disabled, false);
});
