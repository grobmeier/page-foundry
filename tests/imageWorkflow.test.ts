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
import type { NoteTemplate } from "../src/notes/model";
import { noteProperties } from "../src/notes/model";
import { noteLayoutKey } from "../src/templates/preferred";
import type { PackPreset } from "../src/packs/model";
import { newBookDesign } from "../src/books/designEditor";
import { updatedPack } from "../src/packs/editor";

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
    "./ui/noteModal",
    "./ui/letterWritingModal",
    "./ui/bookLivePreview",
    "./ui/bookDesignModal",
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

it("rejects changed original packs when saving an upgraded copy and moved proof sources", async () => {
  const h = setup(true);
  h.activateBook();
  h.setPackPath("Designs/pack.json");
  await h.plugin.openBookDesigns();
  h.changePack();
  await assert.rejects(
    () =>
      h.designForms[0]!.save(
        "Copy.json",
        updatedPack(undefined, newBookDesign("neutral")),
      ),
    /pack changed/,
  );
  assert.equal(h.createdNotes.size, 0);
  const moved = setup(true);
  moved.activateBook();
  await moved.plugin.openBookDesigns();
  moved.note.path = "Moved.md";
  await assert.rejects(
    () => moved.designForms[0]!.proof!(newBookDesign("neutral")),
    /moved/,
  );
  assert.equal(moved.saves.length, 0);
});

it("guards unsaved book proofs and pack copies without remembering a draft layout or changing sources", async () => {
  const h = setup(true);
  h.activateBook();
  await h.plugin.openBookDesigns();
  const form = h.designForms[0]!;
  assert.ok(form.proof);
  await form.proof!(newBookDesign("neutral"));
  assert.equal(h.saves.length, 1);
  assert.equal(h.stored.length, 0);
  assert.equal(h.plugin.settings.noteLayouts.length, 0);
  h.changeBookNote();
  await assert.rejects(() => form.proof!(newBookDesign("neutral")), /changed/);
  assert.equal(h.saves.length, 1);
  await h.plugin.openBookDesigns();
  h.plugin.settings.packManifestPath = "Designs/pack.json";
  await assert.rejects(
    () =>
      h.designForms
        .at(-1)!
        .save("New.json", updatedPack(undefined, newBookDesign("neutral"))),
    /configured pack changed/,
  );
});

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
  pack.extension = "json";
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
  const exportChoices: ExportChoice[] = [];
  const lookups: string[] = [];
  const stored: unknown[] = [];
  let settingsFail = false;
  const renders: FoundryDocument[] = [];
  let reviewReady!: () => void;
  const firstReview = new Promise<void>((resolve) => {
    reviewReady = resolve;
  });
  const templateDialogs: {
    templates: Template[];
    choose(template: Template): void;
  }[] = [];
  const notePickers: {
    templates: NoteTemplate[];
    choose(template: NoteTemplate): void;
  }[] = [];
  const noteForms: {
    template: NoteTemplate;
    values: Record<string, string>;
    editing: boolean;
    save(
      path: string,
      values: Record<string, string>,
      folders: boolean,
      kind?: string,
    ): Promise<void>;
  }[] = [];
  const createdNotes = new Map<string, string>();
  const letterReviews: {
    writing: string;
    save(writing: string): Promise<void>;
  }[] = [];
  const opened: string[] = [];
  const designForms: {
    save(path: string, source: string): Promise<void>;
    proof?: (preset: PackPreset) => Promise<void>;
  }[] = [];
  const commands: {
    id: string;
    callback?: () => void;
    checkCallback?: (checking: boolean) => boolean;
  }[] = [];
  const app = {
    workspace: {
      getActiveFile: () => null,
      async openLinkText(path: string) {
        opened.push(path);
      },
    },
    vault: {
      async create(path: string, source: string) {
        assert.ok(!createdNotes.has(path));
        createdNotes.set(path, source);
        return new File(path, path.replace(/\.md$/, ""));
      },
      async process(_file: File, fn: (source: string) => string) {
        markdown = fn(markdown);
        return markdown;
      },
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
        if (path === note.path) return note;
        if (bookMode && path === bookNote.path) return bookNote;
        return path === pack.path
          ? pack
          : exists && path === attachment.path
            ? attachment
            : undefined;
      },
      async read(file: File) {
        if (!bookMode && file === note) return markdown;
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
    async loadData() {
      return null;
    }
    addSettingTab() {}
    registerEditorExtension() {}
    addCommand(command: (typeof commands)[number]) {
      commands.push(command);
    }
    async saveData(value: unknown) {
      if (settingsFail) throw new Error("Settings could not be saved");
      stored.push(structuredClone(value));
    }
  }
  const module = {
    exports: {} as {
      default: new () => {
        settings: {
          packManifestPath: string;
          noteLayouts: { noteKey: string; layoutKey: string }[];
        };
        onload(): Promise<void>;
        openNewNote(recent?: boolean): Promise<void>;
        openNoteDetails(file: File): Promise<void>;
        openPublishPicker(
          file: File,
          recent?: boolean,
          previous?: ExportChoice,
          replace?: () => void,
        ): Promise<void>;
        openPublish(file: File): Promise<void>;
        openLetterWriting(file: File): Promise<void>;
        openBookDesigns(): Promise<void>;
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
      if (name === "./ui/bookLivePreview") return { bookLivePreview: () => [] };
      if (name === "./ui/bookDesignModal")
        return {
          BookDesignModal: class {
            constructor(
              _app: unknown,
              _pack: unknown,
              _path: string,
              save: (path: string, source: string) => Promise<void>,
              proof?: (preset: PackPreset) => Promise<void>,
            ) {
              designForms.push({ save, proof });
            }
            open() {}
          },
        };
      if (name === "./ui/letterWritingModal")
        return {
          LetterWritingModal: class {
            constructor(
              _app: unknown,
              writing: string,
              save: (writing: string) => Promise<void>,
            ) {
              letterReviews.push({ writing, save });
            }
            open() {}
          },
        };
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
              _choice: ExportChoice,
              _publish: unknown,
              review: ImageReview,
              _refresh: unknown,
              catalog: PresetCatalog,
            ) {
              reviews.push(review);
              exportChoices.push(_choice);
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
      if (name === "./ui/noteModal")
        return {
          NoteTemplateModal: class {
            constructor(
              _app: unknown,
              templates: NoteTemplate[],
              choose: (template: NoteTemplate) => void,
            ) {
              notePickers.push({ templates, choose });
            }
            open() {}
          },
          NoteModal: class {
            constructor(
              _app: unknown,
              template: NoteTemplate,
              values: Record<string, string>,
              _folder: string,
              _filename: string,
              editing: boolean,
              save: (typeof noteForms)[number]["save"],
            ) {
              noteForms.push({ template, values, editing, save });
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
    exportChoices,
    lookups,
    stored,
    templateDialogs,
    firstReview,
    notePickers,
    noteForms,
    createdNotes,
    opened,
    commands,
    letterReviews,
    designForms,
    failSettings() {
      settingsFail = true;
    },
    activateBook() {
      app.workspace.getActiveFile = () => note as any;
    },
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
    setSource(value: string) {
      markdown = value;
    },
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
  it("reports a preference-persistence failure without pretending the saved type failed", async () => {
    const host = setup();
    host.plugin.settings.noteLayouts = [
      {
        noteKey: await noteLayoutKey(host.note.path),
        layoutKey: "letter|pdf|a4|-|-|-",
      },
    ];
    await host.plugin.openNoteDetails(host.note);
    host.failSettings();
    await host.noteForms[0]!.save(host.note.path, {}, false, "manuscript");
    assert.equal(noteProperties(host.source()).document, "manuscript");
    assert.equal(host.plugin.settings.noteLayouts.length, 0);
    assert.ok(
      host.notices.some((notice) =>
        notice.includes("reset output choice could not be saved"),
      ),
    );
    await host.plugin.openPublish(host.note);
    assert.equal(host.exportChoices[0]!.preset, "general-manuscript");
  });
  it("exposes one author workflow without migration and duplicate commands", async () => {
    const host = setup();
    await host.plugin.onload();
    assert.deepEqual(host.commands.map((command) => command.id).sort(), [
      "cheat-sheet",
      "create",
      "create-recent",
      "edit-document-details",
      "manage-designs",
      "publish",
      "save-note-template",
    ]);
  });
  it("saves a changed type, resets only its remembered layout and publishes the new default", async () => {
    const host = setup();
    host.setSource(
      "---\ndocument: letter\nfrom: Alex Example\nto: Jamie Example\nclosing: ''\n---\nOriginal writing.",
    );
    await host.plugin.openPublish(host.note);
    assert.equal(host.exportChoices[0]!.preset, "letter");
    const ownKey = await noteLayoutKey(host.note.path),
      otherKey = await noteLayoutKey("Another.md");
    host.plugin.settings.noteLayouts = [ownKey, otherKey].map((noteKey) => ({
      noteKey,
      layoutKey: "letter|pdf|a4|-|-|-",
    }));
    await host.plugin.openNoteDetails(host.note);
    await host.noteForms[0]!.save(
      host.note.path,
      { surname: "Example" },
      false,
      "manuscript",
    );
    assert.equal(noteProperties(host.source()).document, "manuscript");
    assert.equal(noteProperties(host.source()).from, "Alex Example");
    assert.equal(noteProperties(host.source()).to, "Jamie Example");
    assert.equal(noteProperties(host.source()).closing, "");
    assert.ok(host.source().endsWith("Original writing."));
    assert.deepEqual(
      Array.from(host.plugin.settings.noteLayouts, (row) => row.noteKey),
      [otherKey],
    );
    await host.plugin.openPublish(host.note);
    assert.equal(host.exportChoices.at(-1)!.preset, "general-manuscript");
    assert.ok(host.notices.some((notice) => notice.includes("default design")));
    await host.plugin.openNoteDetails(host.note);
    await host.noteForms[1]!.save(host.note.path, {}, false, "plain");
    await host.plugin.openPublish(host.note);
    assert.equal(host.exportChoices.at(-1)!.preset, "plain-document");
  });
  it("does not clear preferences on Cancel, same-type saves, stale or moved sources", async () => {
    const host = setup();
    const key = await noteLayoutKey(host.note.path);
    host.plugin.settings.noteLayouts = [
      { noteKey: key, layoutKey: "letter|pdf|a4|-|-|-" },
    ];
    await host.plugin.openNoteDetails(host.note);
    assert.equal(host.plugin.settings.noteLayouts.length, 1);
    await host.noteForms[0]!.save(
      host.note.path,
      { title: "New title" },
      false,
      "plain",
    );
    assert.equal(host.plugin.settings.noteLayouts.length, 1);
    await host.plugin.openNoteDetails(host.note);
    host.changeNote();
    await assert.rejects(
      () => host.noteForms[1]!.save(host.note.path, {}, false, "letter"),
      /changed/,
    );
    assert.equal(host.plugin.settings.noteLayouts.length, 1);
    await host.plugin.openNoteDetails(host.note);
    host.note.path = "Moved.md";
    await assert.rejects(
      () => host.noteForms[2]!.save(host.note.path, {}, false, "letter"),
      /moved/,
    );
    assert.equal(host.plugin.settings.noteLayouts.length, 1);
  });
  it("opens unknown type details for explicit correction without changing the source on open", async () => {
    const host = setup();
    host.setSource("---\ndocument: unknown\n---\nWriting");
    const original = host.source();
    await host.plugin.openNoteDetails(host.note);
    assert.equal(host.source(), original);
    await host.noteForms[0]!.save(host.note.path, {}, false, "letter");
    assert.equal(noteProperties(host.source()).document, "letter");
  });
  it("reviews legacy letter conversion and refuses a stale save before accepting a fresh review", async () => {
    const host = setup();
    host.setSource(
      "---\ndocument: letter\nsalutation: Dear Jamie,\nclosing: Kind regards,\nauthor: Alex Example\ncustom: retained\n---\nOriginal writing.",
    );
    const original = host.source();
    await host.plugin.openLetterWriting(host.note);
    assert.equal(host.source(), original);
    assert.ok(host.letterReviews[0]!.writing.includes("Dear Jamie,"));
    host.changeNote();
    const edited = host.source();
    await assert.rejects(
      host.letterReviews[0]!.save(host.letterReviews[0]!.writing),
      /changed/,
    );
    assert.equal(host.source(), edited);
    await host.plugin.openLetterWriting(host.note);
    await host.letterReviews[1]!.save(host.letterReviews[1]!.writing);
    assert.equal(noteProperties(host.source()).custom, "retained");
    assert.equal(noteProperties(host.source()).closing, undefined);
    assert.ok(host.source().includes("A changed paragraph."));
  });
  it("opens a typed letter directly and remembers its published layout without a second picker", async () => {
    const host = setup();
    host.setSource(
      "---\ndocument: letter\ntitle: Enquiry\nsender-name: Alex Example\n---\nDear Jamie,\n\nMy writing.\n\nKind regards,\n\nAlex Example.",
    );
    await host.plugin.openPublish(host.note);
    assert.equal(host.templateDialogs.length, 0);
    assert.equal(host.exportChoices[0]!.preset, "letter");
    assert.equal(host.saves.length, 0);
    const selected = {
      ...host.exportChoices[0]!,
      profile: "us-letter" as const,
    };
    await host.plugin.publish(
      host.note,
      selected,
      host.reviews[0]!,
      host.source(),
      host.catalogs[0],
    );
    assert.equal(host.saves.length, 1);
    await host.plugin.openPublish(host.note);
    assert.equal(host.exportChoices.at(-1)!.profile, "us-letter");
    const data = JSON.stringify(host.plugin.settings.noteLayouts);
    assert.ok(!data.includes("Alex Example") && !data.includes("Notes/Images"));
  });
  it("visibly falls back when an explicitly remembered layout disappears", async () => {
    const host = setup();
    host.plugin.settings.noteLayouts = [
      {
        noteKey: await noteLayoutKey(host.note.path),
        layoutKey: "missing:layout|pdf|a4|-|-|-",
      },
    ];
    await host.plugin.openPublish(host.note);
    assert.equal(host.exportChoices[0]!.preset, "plain-document");
    assert.ok(
      host.notices.some((t) => t.includes("previous layout is unavailable")),
    );
    assert.equal(host.saves.length, 0);
  });
  it("creates a book draft without copying the active note or adding irrelevant date properties", async () => {
    const host = setup();
    await host.plugin.openNewNote();
    host.notePickers[0]!.choose(
      host.notePickers[0]!.templates.find((t) => t.kind === "book")!,
    );
    const form = host.noteForms[0]!;
    await form.save("New Book.book.md", form.values, false);
    const source = host.createdNotes.get("New Book.book.md")!;
    assert.equal(noteProperties(source).document, "book");
    assert.equal(noteProperties(source).date, undefined);
    assert.ok(!source.includes(host.note.path));
    assert.equal(host.renders.length, 0);
  });
  it("offers Create without an active file and prepares one note without exporting or changing the old source", async () => {
    const host = setup();
    await host.plugin.onload();
    const create = host.commands.find((c) => c.id === "create")!;
    assert.equal(typeof create.callback, "function");
    assert.equal(create.checkCallback, undefined);
    await host.plugin.openNewNote();
    assert.deepEqual(
      new Set(host.notePickers[0]!.templates.map((t) => t.id)),
      new Set(["letter", "manuscript", "book", "plain", "submission-letter"]),
    );
    assert.equal(host.notePickers.length, 1);
    host.notePickers[0]!.choose(
      host.notePickers[0]!.templates.find((t) => t.kind === "letter")!,
    );
    const form = host.noteForms[0]!;
    const before = host.source();
    assert.equal(form.editing, false);
    assert.equal(host.createdNotes.size, 0);
    await form.save(
      "New letter.md",
      {
        ...form.values,
        "sender-name": "Alex Example",
        "sender-address": "12 Sample Street\nExample Town",
      },
      false,
    );
    assert.equal(host.createdNotes.size, 1);
    assert.equal(host.source(), before);
    assert.deepEqual(host.opened, ["New letter.md"]);
    assert.equal(host.saves.length, 0);
    assert.equal(host.reviews.length, 0);
    assert.equal(host.renders.length, 0);
    assert.equal(
      noteProperties(host.createdNotes.get("New letter.md")!)["sender-address"],
      "12 Sample Street\nExample Town",
    );
    await host.plugin.openNewNote(true);
    assert.deepEqual(
      Array.from(host.notePickers[1]!.templates, (t) => t.id),
      ["letter"],
    );
    assert.ok(!JSON.stringify(host.stored).includes("12 Sample Street"));
  });
  it("saves details explicitly, preserves prose and rejects a changed source", async () => {
    const host = setup();
    await host.plugin.openNoteDetails(host.note);
    const form = host.noteForms[0]!,
      before = host.source();
    assert.equal(form.editing, true);
    assert.equal(host.source(), before); // Opening or cancelling has no write callback.
    await form.save(
      host.note.path,
      { ...form.values, title: "Saved title", author: "Alex Example" },
      false,
    );
    assert.equal(noteProperties(host.source()).title, "Saved title");
    assert.ok(host.source().endsWith(before));
    await host.plugin.openNoteDetails(host.note);
    host.changeNote();
    const changed = host.source();
    await assert.rejects(
      () => host.noteForms[1]!.save(host.note.path, { title: "Stale" }, false),
      /nothing was overwritten/,
    );
    assert.equal(host.source(), changed);
    assert.equal(host.saves.length, 0);
  });
  it("Publish recent falls back to a picker without exporting or reading images before selection", async () => {
    const host = setup();
    await host.plugin.openPublishPicker(host.note, true);
    assert.equal(host.templateDialogs.length, 1);
    assert.equal(host.templateDialogs[0]!.templates.length, 20);
    assert.equal(host.saves.length, 0);
    assert.equal(host.reads.length, 0);
    assert.equal(host.reviews.length, 0);
    assert.ok(
      host.notices.some((message) =>
        message.includes("No recent output presets"),
      ),
    );
    host.templateDialogs[0]!.choose(
      host.templateDialogs[0]!.templates.find((t) => t.preset === "letter")!,
    );
    await host.firstReview;
    assert.equal(host.reviews.length, 1);
    assert.equal(host.saves.length, 0);
  });
  it("carries transient Publish choices to a freshly reviewed layout without saving settings", async () => {
    const h = setup();
    let replaced = false;
    await h.plugin.openPublishPicker(
      h.note,
      false,
      {
        ...choice,
        outputName: "Author proof",
        destination: "share",
        language: "de",
        metadata: {
          title: "Temporary title",
          language: "de",
          "sender-address": "Not applicable",
        },
      },
      () => {
        replaced = true;
      },
    );
    assert.equal(replaced, false);
    const picker = h.templateDialogs[0]!;
    picker.choose(
      picker.templates.find(
        (t) => t.format === "docx" && t.preset === "plain-editable",
      )!,
    );
    await h.firstReview;
    assert.equal(replaced, true);
    const next = h.exportChoices[0]!;
    assert.equal(next.outputName, "Author proof");
    assert.equal(next.destination, "share");
    assert.equal(next.language, "de");
    assert.equal(next.metadata!.title, "Temporary title");
    assert.equal(next.metadata!["sender-address"], undefined);
    assert.equal(h.stored.length, 0);
    assert.equal(h.saves.length, 0);
  });
  it("rejects a moved note before replacing a Publish review", async () => {
    const h = setup();
    let replaced = false;
    await h.plugin.openPublishPicker(h.note, false, choice, () => {
      replaced = true;
    });
    h.note.path = "Moved.md";
    h.templateDialogs[0]!.choose(h.templateDialogs[0]!.templates[0]!);
    assert.equal(replaced, false);
    assert.equal(h.reviews.length, 0);
    assert.ok(h.notices.some((message) => message.includes("note moved")));
  });
  it("Publish recognises a book and excludes letter presets without reading chapters yet", async () => {
    const host = setup(true);
    await host.plugin.openPublishPicker(host.note);
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
