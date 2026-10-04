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
import { readFileSync } from "node:fs";
import type { PresetCatalog } from "../src/packs/model";
import type { Template } from "../src/templates/catalog";

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
    "./ui/templateModal",
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

function setup(bookMode = false) {
  class File {
    extension = "md";
    stat = { size: fixturePng().length };
    constructor(
      public path: string,
      public basename: string,
    ) {}
  }
  const note = new File("Notes/Images.md", "Images");
  const attachment = new File("Artwork/photo.png", "photo");
  const pack = new File("Designs/pack.json", "pack");
  const bookNote = new File("Book/Chapter.md", "Chapter");
  let bookSource = "# Chapter\n\nA neutral chapter.";
  let bookManifest =
    "---\npage-foundry-book: 1\ntitle: Neutral Book\nlanguage: en\nentries:\n  - id: chapter\n    role: chapter\n    path: Book/Chapter.md\n---\n";
  let packSource = readFileSync(
    "examples/neutral-pack/page-foundry-pack.json",
    "utf8",
  );
  pack.stat.size = new TextEncoder().encode(packSource).length;
  let markdown = "![A panel](Artwork/photo.png)";
  let bytes = fixturePng();
  let exists = true;
  const reads: string[] = [],
    links: string[] = [],
    saves: string[] = [],
    notices: string[] = [];
  const reviews: ImageReview[] = [];
  const catalogs: PresetCatalog[] = [];
  const lookups: string[] = [];
  const stored: unknown[] = [];
  const renders: FoundryDocument[] = [];
  let reviewReady!: () => void;
  const firstReview = new Promise<void>((resolve) => {
    reviewReady = resolve;
  });
  const templateDialogs: {
    templates: Template[];
    choose(template: Template): void;
  }[] = [];
  const app = {
    vault: {
      async cachedRead(file: File) {
        assert.equal(file, note);
        return bookMode ? bookManifest : markdown;
      },
      async readBinary(file: File) {
        reads.push(file.path);
        return bytes.slice().buffer;
      },
      getAbstractFileByPath(path: string) {
        lookups.push(path);
        if (bookMode && path === bookNote.path) return bookNote;
        return path === pack.path
          ? pack
          : exists && path === attachment.path
            ? attachment
            : undefined;
      },
      async read(file: File) {
        if (bookMode && file === note) {
          reads.push(file.path);
          return bookManifest;
        }
        if (bookMode && file === bookNote) {
          reads.push(file.path);
          return bookSource;
        }
        assert.equal(file, pack);
        reads.push(file.path);
        return packSource;
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
    async saveData(value: unknown) {
      stored.push(structuredClone(value));
    }
  }
  const module = {
    exports: {} as {
      default: new () => {
        settings: { packManifestPath: string };
        openCreate(file: File, recent?: boolean): Promise<void>;
        openExport(
          file: File,
          choice?: ExportChoice,
          book?: boolean,
        ): Promise<void>;
        publish(
          file: File,
          choice: ExportChoice,
          review: ImageReview,
          source: string,
          catalog?: PresetCatalog,
          book?: boolean,
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
          Modal: class {},
          SuggestModal: class {},
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
              _refresh: unknown,
              catalog: PresetCatalog,
            ) {
              reviews.push(review);
              reviewReady();
              catalogs.push(catalog);
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
      if (name === "./ui/templateModal")
        return {
          TemplateModal: class {
            constructor(
              _app: unknown,
              templates: Template[],
              choose: (template: Template) => void,
            ) {
              templateDialogs.push({ templates, choose });
            }
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
    catalogs,
    lookups,
    stored,
    templateDialogs,
    firstReview,
    changeBookNote() {
      bookSource += "\nChanged chapter.";
    },
    changeBookManifest() {
      bookManifest = bookManifest.replace("Neutral Book", "Changed Book");
    },
    setPackPath(path: string) {
      plugin.settings.packManifestPath = path;
    },
    changePack() {
      packSource = packSource.replace('"bodySizePt": 14', '"bodySizePt": 15');
    },
    breakPack() {
      packSource = "{";
    },
    oversizePack() {
      pack.stat.size = 128 * 1024 + 1;
    },
    source: () => markdown,
    changeNote() {
      markdown += "\n\nA changed paragraph.";
    },
    clearNote() {
      markdown = "";
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
  it("Create recent falls back to a picker without exporting or reading images before selection", async () => {
    const host = setup();
    await host.plugin.openCreate(host.note, true);
    assert.equal(host.templateDialogs.length, 1);
    assert.equal(host.templateDialogs[0]!.templates.length, 20);
    assert.equal(host.saves.length, 0);
    assert.equal(host.reads.length, 0);
    assert.equal(host.reviews.length, 0);
    assert.ok(
      host.notices.some((message) => message.includes("No recent templates")),
    );
    host.templateDialogs[0]!.choose(
      host.templateDialogs[0]!.templates.find((t) => t.preset === "letter")!,
    );
    await host.firstReview;
    assert.equal(host.reviews.length, 1);
    assert.equal(host.saves.length, 0);
  });
  it("Create recognises a book and excludes letter templates without reading chapters yet", async () => {
    const host = setup(true);
    await host.plugin.openCreate(host.note);
    const templates = host.templateDialogs[0]!.templates;
    assert.equal(templates.length, 28);
    assert.ok(templates.some((t) => t.printOptions));
    assert.equal(
      templates.some((t) => t.preset === "letter"),
      false,
    );
    assert.equal(host.reads.length, 0);
    assert.equal(host.saves.length, 0);
  });
  it("rechecks the complete book snapshot before publishing", async () => {
    const host = setup(true);
    await host.plugin.openExport(host.note, undefined, true);
    const review = host.reviews[0]!;
    assert.equal(review.document.book?.entries.length, 1);
    await host.plugin.publish(
      host.note,
      choice,
      review,
      "",
      host.catalogs[0],
      true,
    );
    assert.equal(host.renders.length, 1);
    assert.equal(host.saves.length, 1);
    assert.ok(host.reads.includes("Book/Chapter.md"));
  });
  for (const change of ["changeBookNote", "changeBookManifest"] as const)
    it(`returns changed books to review (${change})`, async () => {
      const host = setup(true);
      await host.plugin.openExport(host.note, undefined, true);
      const review = host.reviews[0]!;
      host[change]();
      await host.plugin.publish(
        host.note,
        choice,
        review,
        "",
        host.catalogs[0],
        true,
      );
      assert.equal(host.renders.length, 0);
      assert.equal(host.saves.length, 0);
      assert.equal(host.reviews.length, 2);
      assert.ok(
        host.notices.some((message) =>
          message.includes("book or its included files changed"),
        ),
      );
    });
  it("rechecks preflight before rendering even when the dialog callback is bypassed", async () => {
    const host = setup();
    host.clearNote();
    await host.plugin.openExport(host.note);
    await host.plugin.publish(
      host.note,
      choice,
      host.reviews[0]!,
      host.source(),
      host.catalogs[0],
    );
    assert.equal(host.renders.length, 0);
    assert.equal(host.saves.length, 0);
    assert.ok(
      host.notices.some((value) =>
        value.includes("no exportable body content"),
      ),
    );
  });
  it("reads only an explicitly configured pack and re-reviews content changes before rendering", async () => {
    const host = setup();
    host.setPackPath("Designs/pack.json");
    await host.plugin.openExport(host.note);
    assert.ok(host.reads.includes("Designs/pack.json"));
    const catalog = host.catalogs[0]!;
    host.changePack();
    await host.plugin.publish(
      host.note,
      {
        ...choice,
        preset: "neutral-example:studio-proof",
        metadata: {
          title: "Only in export",
          author: "Alex Example",
          language: "en",
        },
      },
      host.reviews[0]!,
      host.source(),
      catalog,
    );
    assert.equal(host.renders.length, 0);
    assert.equal(host.saves.length, 0);
    assert.equal(host.reviews.length, 2);
    assert.ok(
      host.notices.some((message) => message.includes("preset pack changed")),
    );
  });
  it("exports custom metadata and layout without storing metadata in settings", async () => {
    const host = setup();
    host.setPackPath("Designs/pack.json");
    await host.plugin.openExport(host.note);
    await host.plugin.publish(
      host.note,
      {
        ...choice,
        preset: "neutral-example:studio-proof",
        metadata: {
          title: "Export only title",
          author: "Alex Example",
          language: "en",
        },
      },
      host.reviews[0]!,
      host.source(),
      host.catalogs[0],
    );
    assert.equal(host.renders[0]!.title, "Export only title");
    assert.equal(host.renders[0]!.style!.bodySizePt, 14);
    assert.equal(
      JSON.stringify(host.stored).includes("Export only title"),
      false,
    );
    assert.equal(host.source(), "![A panel](Artwork/photo.png)");
  });
  for (const mode of ["invalid", "oversize", "traversal", "missing"] as const)
    it(`blocks a ${mode} configured pack without falling back to publishing`, async () => {
      const host = setup();
      host.setPackPath(
        mode === "traversal"
          ? "../pack.json"
          : mode === "missing"
            ? "Absent/pack.json"
            : "Designs/pack.json",
      );
      if (mode === "invalid") host.breakPack();
      if (mode === "oversize") host.oversizePack();
      await host.plugin.openExport(host.note);
      assert.ok(host.catalogs[0]!.error);
      await host.plugin.publish(
        host.note,
        choice,
        host.reviews[0]!,
        host.source(),
        host.catalogs[0],
      );
      assert.equal(host.renders.length, 0);
      assert.equal(host.saves.length, 0);
      if (mode === "oversize" || mode === "traversal")
        assert.ok(!host.reads.includes("Designs/pack.json"));
      if (mode === "traversal")
        assert.ok(!host.lookups.includes("../pack.json"));
    });
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
