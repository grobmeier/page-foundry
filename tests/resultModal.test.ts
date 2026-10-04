/*
 * Copyright 2026 Christian Grobmeier
 * Licensed under the Apache License, Version 2.0.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runInNewContext } from "node:vm";
import { buildSync } from "esbuild";

const code = buildSync({
  entryPoints: ["src/ui/resultModal.ts"],
  bundle: true,
  write: false,
  format: "cjs",
  external: ["obsidian", "electron"],
}).outputFiles[0]!.text;

class Element {
  children: Element[] = [];
  text = "";
  disabled = false;
  click: () => unknown = () => {};
  empty() {
    this.children = [];
  }
  addClass() {}
  createEl(_tag: string, options: { text?: string } = {}) {
    const child = new Element();
    child.text = options.text ?? "";
    this.children.push(child);
    return child;
  }
  createDiv() {
    return this.createEl("div");
  }
  querySelectorAll() {
    return this.children;
  }
  descendants(): Element[] {
    return this.children.flatMap((child) => [child, ...child.descendants()]);
  }
}

class Button {
  private element: Element;
  constructor(parent: Element) {
    this.element = parent.createEl("button");
  }
  setButtonText(text: string) {
    this.element.text = text;
    return this;
  }
  setCta() {
    return this;
  }
  onClick(handler: () => unknown) {
    this.element.click = handler;
    return this;
  }
}

class Adapter {
  getFullPath(path: string) {
    return `/test-vault/${path}`;
  }
}

function setup(
  desktop = false,
  sharing = "supported",
  clipboard?: { writeText(value: string): Promise<void> },
) {
  const notices: string[] = [];
  const opened: string[] = [];
  const revealed: string[] = [];
  const shared: string[] = [];
  let hostLoads = 0;
  class Modal {
    contentEl = new Element();
    modalEl = new Element();
    closed = false;
    constructor(public app: unknown) {}
    close() {
      this.closed = true;
    }
  }
  const module = {
    exports: {} as {
      ResultModal: new (...args: unknown[]) => Modal & { onOpen(): void };
    },
  };
  runInNewContext(code, {
    module,
    exports: module.exports,
    Error,
    DOMException,
    File,
    navigator: {
      clipboard,
      canShare:
        sharing === "unchecked"
          ? undefined
          : () => {
              if (sharing === "throws") throw new Error("Unavailable");
              return sharing !== "rejected";
            },
      share:
        sharing === "missing"
          ? undefined
          : async (data: { files: File[] }) => {
              shared.push(data.files[0]!.name);
            },
    },
    require(name: string) {
      if (name === "obsidian")
        return {
          Modal,
          ButtonComponent: Button,
          FileSystemAdapter: Adapter,
          Platform: { isDesktopApp: desktop },
          Notice: class {
            constructor(message: string) {
              notices.push(message);
            }
          },
        };
      if (name === "electron") {
        hostLoads++;
        return {
          shell: {
            openPath: async (path: string) => {
              opened.push(path);
              return "";
            },
            showItemInFolder: (path: string) => {
              revealed.push(path);
            },
          },
        };
      }
      throw new Error(name);
    },
  });
  const create = (
    save: () => Promise<string>,
    path?: string,
    proofReport?: string,
  ) => {
    const modal = new module.exports.ResultModal(
      { vault: { adapter: new Adapter() } },
      "Draft.epub",
      {
        bytes: new Uint8Array([1]),
        extension: "epub",
        mediaType: "application/epub+zip",
        proofReport,
      },
      save,
      path,
    );
    modal.onOpen();
    return modal;
  };
  return {
    create,
    opened,
    revealed,
    shared,
    notices,
    hostLoads: () => hostLoads,
  };
}

function button(modal: { contentEl: Element }, label: string): Element {
  const found = modal.contentEl
    .descendants()
    .find((element) => element.text === label);
  assert.ok(found, `Expected action ${label}`);
  return found;
}

describe("export result", () => {
  it("shows the measured proof and copies it only on explicit request", async () => {
    const copied: string[] = [];
    const host = setup(false, "missing", {
      async writeText(value) {
        copied.push(value);
      },
    });
    const modal = host.create(
      async () => "unused",
      "Draft.pdf",
      "Measured neutral proof",
    );
    assert.ok(
      modal.contentEl
        .descendants()
        .some((element) => element.text === "Measured neutral proof"),
    );
    assert.equal(copied.length, 0);
    await button(modal, "Copy print proof report").click();
    assert.deepEqual(copied, ["Measured neutral proof"]);
    assert.ok(host.notices.includes("Print proof report copied."));
    const failed = setup(false, "missing", {
      async writeText() {
        throw new Error("Unavailable");
      },
    });
    const failedModal = failed.create(
      async () => "unused",
      "Draft.pdf",
      "Measured neutral proof",
    );
    await button(failedModal, "Copy print proof report").click();
    assert.ok(
      failed.notices.some((notice) => notice.includes("Could not copy")),
    );
  });
  for (const sharing of ["missing", "unchecked", "rejected", "throws"]) {
    it(`hides unsupported sharing (${sharing}) while keeping desktop file actions`, async () => {
      const host = setup(true, sharing);
      const modal = host.create(
        async () => "unused",
        "Page Foundry/Draft.epub",
      );
      assert.equal(
        modal.contentEl
          .descendants()
          .some((el) => el.text === "Share or save elsewhere"),
        false,
      );
      await button(modal, "Open in default app").click();
      button(modal, "Show in folder").click();
      assert.deepEqual(host.opened, ["/test-vault/Page Foundry/Draft.epub"]);
      assert.deepEqual(host.revealed, host.opened);
      assert.deepEqual(host.notices, []);
    });
  }

  it("keeps vault saving available without file sharing", async () => {
    const host = setup(false, "missing");
    const modal = host.create(async () => "Page Foundry/Draft.epub");
    await button(modal, "Save in vault").click();
    assert.ok(
      modal.contentEl
        .descendants()
        .some((el) => el.text === "Page Foundry/Draft.epub"),
    );
    assert.equal(host.hostLoads(), 0);
    assert.deepEqual(host.notices, []);
  });

  it("shows and shares the numbered saved file on mobile without loading Electron", async () => {
    const host = setup();
    const modal = host.create(
      async () => "unused",
      "Page Foundry/Draft 3.epub",
    );
    assert.ok(
      modal.contentEl
        .descendants()
        .some((el) => el.text === "Page Foundry/Draft 3.epub"),
    );
    assert.ok(
      modal.contentEl.descendants().some((el) => el.text.includes("may hide")),
    );
    await button(modal, "Share or save elsewhere").click();
    assert.deepEqual(host.shared, ["Draft 3.epub"]);
    assert.equal(host.hostLoads(), 0);
    assert.equal(modal.closed, false);
    assert.equal(
      modal.contentEl.descendants().some((el) => el.text === "Save in vault"),
      false,
    );
  });

  it("opens and reveals only the actual saved desktop path", async () => {
    const host = setup(true);
    const modal = host.create(
      async () => "unused",
      "Page Foundry/Draft 2.epub",
    );
    await button(modal, "Open in default app").click();
    button(modal, "Show in folder").click();
    assert.deepEqual(host.opened, ["/test-vault/Page Foundry/Draft 2.epub"]);
    assert.deepEqual(host.revealed, host.opened);
  });

  it("prevents concurrent duplicate saves and updates the persistent result", async () => {
    const host = setup();
    let saves = 0;
    let finish!: (value: string) => void;
    const modal = host.create(() => {
      saves++;
      return new Promise((resolve) => {
        finish = resolve;
      });
    });
    const save = button(modal, "Save in vault");
    const pending = save.click();
    await save.click();
    assert.equal(saves, 1);
    finish("Page Foundry/Draft 4.epub");
    await pending;
    assert.equal(modal.closed, false);
    await button(modal, "Share or save elsewhere").click();
    assert.deepEqual(host.shared, ["Draft 4.epub"]);
  });

  it("keeps a failed save available for retry and preserves sharing", async () => {
    const host = setup();
    const modal = host.create(async () => {
      throw new Error("Disk full");
    });
    await button(modal, "Save in vault").click();
    assert.deepEqual(host.notices, ["Disk full"]);
    button(modal, "Save in vault");
    await button(modal, "Share or save elsewhere").click();
    assert.deepEqual(host.shared, ["Draft.epub"]);
  });
});
