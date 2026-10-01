/*
 * Copyright 2026 Christian Grobmeier
 * Licensed under the Apache License, Version 2.0.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runInNewContext } from "node:vm";
import { buildSync } from "esbuild";
import { builtinModules, createRequire } from "node:module";
import type { FoundryDocument } from "../src/core/model";
import type { ImageReview } from "../src/core/images";
import type { ExportChoice } from "../src/ui/exportModal";
import { fixturePng } from "./fixtures/images";

const code = buildSync({
  entryPoints: ["src/main.ts"],
  platform: "node",
  bundle: true,
  write: false,
  format: "cjs",
  external: [
    "obsidian",
    "./pdf/renderer",
    "./docx/renderer",
    "./epub/renderer",
    "./ui/exportModal",
    "./ui/resultModal",
  ],
}).outputFiles[0]!.text;

const choice: ExportChoice = {
  format: "pdf",
  preset: "plain-document",
  profile: "a4",
  outputName: "Images",
  language: "en",
  destination: "vault",
};
const nodeRequire = createRequire(import.meta.url);

function setup() {
  class File {
    stat = { size: fixturePng().length };
    constructor(
      public path: string,
      public basename: string,
    ) {}
  }
  const note = new File("Notes/Images.md", "Images");
  const attachment = new File("Artwork/photo.png", "photo");
  let markdown = "![A panel](Artwork/photo.png)";
  let bytes = fixturePng();
  let exists = true;
  const reads: string[] = [],
    links: string[] = [],
    saves: string[] = [],
    notices: string[] = [];
  const reviews: ImageReview[] = [];
  const renders: FoundryDocument[] = [];
  const app = {
    vault: {
      async cachedRead(file: File) {
        assert.equal(file, note);
        return markdown;
      },
      async readBinary(file: File) {
        reads.push(file.path);
        return bytes.slice().buffer;
      },
      getAbstractFileByPath(path: string) {
        return exists && path === attachment.path ? attachment : undefined;
      },
      async createFolder() {},
      async createBinary(path: string) {
        saves.push(path);
      },
    },
    metadataCache: {
      getFirstLinkpathDest(path: string, source: string) {
        links.push(`${source}:${path}`);
        return exists ? attachment : undefined;
      },
    },
  };
  class Plugin {
    app = app;
    async saveData() {}
  }
  const module = {
    exports: {} as {
      default: new () => {
        openExport(file: File): Promise<void>;
        publish(
          file: File,
          choice: ExportChoice,
          review: ImageReview,
          source: string,
        ): Promise<void>;
      };
    },
  };
  runInNewContext(code, {
    module,
    exports: module.exports,
    structuredClone,
    crypto,
    TextEncoder,
    TextDecoder,
    Blob,
    Uint8Array,
    ArrayBuffer,
    DataView,
    URL,
    Buffer,
    process,
    console: { error() {} },
    createImageBitmap: async () => ({ close() {} }),
    require(name: string) {
      if (name.startsWith("node:") || builtinModules.includes(name))
        return nodeRequire(name);
      if (name === "obsidian")
        return {
          Plugin,
          PluginSettingTab: class {},
          TFile: File,
          normalizePath: (path: string) => path,
          Notice: class {
            constructor(message: string) {
              notices.push(message);
            }
            hide() {}
          },
        };
      if (name === "./pdf/renderer")
        return {
          TypstPdfRenderer: class {
            async render(document: FoundryDocument) {
              renders.push(document);
              return new Uint8Array([1]);
            }
          },
        };
      if (name === "./ui/exportModal")
        return {
          ExportModal: class {
            constructor(
              _app: unknown,
              _choice: unknown,
              _publish: unknown,
              review: ImageReview,
            ) {
              reviews.push(review);
            }
            open() {}
          },
        };
      if (name === "./ui/resultModal")
        return {
          ResultModal: class {
            open() {}
          },
        };
      throw new Error(name);
    },
  });
  const plugin = new module.exports.default();
  return {
    plugin,
    note,
    reads,
    links,
    saves,
    notices,
    reviews,
    renders,
    source: () => markdown,
    changeNote() {
      markdown += "\n\nA changed paragraph.";
    },
    changeImage() {
      bytes = fixturePng(240, 480);
      attachment.stat.size = bytes.length;
    },
    removeImage() {
      exists = false;
    },
    useShortName() {
      markdown = "![A panel](photo.png)";
    },
  };
}

describe("review-to-export image workflow", () => {
  it("uses the host link cache only for short attachment names", async () => {
    const host = setup();
    host.useShortName();
    await host.plugin.openExport(host.note);
    assert.deepEqual(host.links, ["Notes/Images.md:photo.png"]);
    assert.deepEqual(host.reads, ["Artwork/photo.png"]);
    assert.equal(host.reviews[0]!.errors.length, 0);
  });
  it("reads only the referenced attachment and renders a freshly validated snapshot", async () => {
    const host = setup();
    await host.plugin.openExport(host.note);
    assert.deepEqual(host.links, []);
    await host.plugin.publish(
      host.note,
      choice,
      host.reviews[0]!,
      host.source(),
    );
    assert.equal(host.renders.length, 1);
    assert.deepEqual(host.reads, ["Artwork/photo.png", "Artwork/photo.png"]);
    assert.deepEqual(host.saves, ["Page Foundry/Images.pdf"]);
    assert.notEqual(host.renders[0], host.reviews[0]!.document);
  });
  for (const change of ["changeNote", "changeImage", "removeImage"] as const) {
    it(`returns to review without rendering or saving after ${change}`, async () => {
      const host = setup();
      await host.plugin.openExport(host.note);
      const source = host.source();
      host[change]();
      await host.plugin.publish(host.note, choice, host.reviews[0]!, source);
      assert.equal(host.renders.length, 0);
      assert.equal(host.saves.length, 0);
      assert.equal(host.reviews.length, 2);
      assert.ok(host.notices.some((message) => message.includes("changed")));
      if (change === "removeImage")
        assert.equal(host.reviews[1]!.errors.length, 1);
    });
  }
});
