/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import assert from "node:assert/strict";
import { it } from "node:test";
import { buildSync } from "esbuild";
import { runInNewContext } from "node:vm";
import { createRequire } from "node:module";
import type { ImageReview } from "../src/core/images";
import { bookManifest, bookNotes } from "./fixtures/book";
import { fixturePng } from "./fixtures/images";
const code = buildSync({
  entryPoints: ["src/vault/books.ts"],
  bundle: true,
  format: "cjs",
  platform: "node",
  write: false,
  external: ["obsidian"],
}).outputFiles[0]!.text;
function setup() {
  class File {
    extension: string;
    basename: string;
    stat: { size: number };
    constructor(
      public path: string,
      public raw: string,
    ) {
      this.extension = path.split(".").at(-1)!;
      this.basename = path.split("/").at(-1)!.replace(/\.md$/, "");
      this.stat = { size: new TextEncoder().encode(raw).length };
    }
  }
  const file = new File("Book project.md", bookManifest);
  const files = new Map(
    Object.entries(bookNotes).map(([path, raw]) => [path, new File(path, raw)]),
  );
  let png = fixturePng();
  const image = new File("Artwork/panel.png", "");
  image.stat.size = png.length;
  files.set(image.path, image);
  const reads: string[] = [];
  const lookups: string[] = [];
  const app = {
    vault: {
      getAbstractFileByPath(path: string) {
        lookups.push(path);
        return files.get(path);
      },
      async read(note: File) {
        reads.push(note.path);
        return note.raw;
      },
      async readBinary(note: File) {
        reads.push(note.path);
        return png.slice().buffer;
      },
    },
    metadataCache: {
      getFirstLinkpathDest() {
        throw new Error("Unexpected short-name lookup");
      },
    },
  };
  const module = {
    exports: {} as {
      reviewVaultBook(app: unknown, file: File): Promise<ImageReview>;
    },
  };
  runInNewContext(code, {
    module,
    exports: module.exports,
    require: (name: string) =>
      name === "obsidian"
        ? { TFile: File }
        : createRequire(import.meta.url)(name),
    TextEncoder,
    TextDecoder,
    structuredClone,
    crypto,
    Uint8Array,
    ArrayBuffer,
    Blob,
    DataView,
    createImageBitmap: async () => ({ close() {} }),
  });
  return {
    review: () => module.exports.reviewVaultBook(app, file),
    file,
    files,
    reads,
    lookups,
    image,
    changeImage() {
      png = fixturePng(240, 480);
      image.stat.size = png.length;
    },
    addImage(path: string, size: number) {
      const asset = new File(path, "");
      asset.stat.size = size;
      files.set(path, asset);
    },
  };
}
it("book review reads only the manifest, explicit entries and referenced images", async () => {
  const s = setup();
  const review = await s.review();
  assert.equal(review.errors.length, 0, review.errors.join(" "));
  assert.deepEqual(s.reads, [s.file.path, ...Object.keys(bookNotes)]);
  assert.deepEqual(s.lookups, Object.keys(bookNotes));
  assert.equal(review.document.book!.entries.length, 6);
});
it("book signature changes for edits to manifest, included note and image bytes", async () => {
  const s = setup();
  const initial = await s.review();
  s.files.get("Book/Chapter One.md")!.raw += "\nNew prose.\n";
  const changed = await s.review();
  assert.notEqual(changed.signature, initial.signature);
  s.file.raw = s.file.raw.replace("A Neutral Journey", "A Changed Journey");
  assert.notEqual((await s.review()).signature, changed.signature);
  s.files.get("Book/Preface.md")!.raw += "\n![Panel](Artwork/panel.png)\n";
  const withImage = await s.review();
  s.changeImage();
  assert.notEqual((await s.review()).signature, withImage.signature);
});
it("enforces aggregate image bytes across separate notes before reading excess files", async () => {
  const s = setup();
  const paths = Object.keys(bookNotes);
  for (let index = 0; index < 6; index++) {
    const path = `Artwork/budget-${index}.png`;
    s.addImage(path, 4 * 1024 * 1024);
    s.files.get(paths[index % paths.length]!)!.raw += `\n![Panel](${path})\n`;
  }
  const review = await s.review();
  assert.match(review.errors.join(" "), /20 MiB/);
  assert.equal(s.reads.filter((path) => path.endsWith(".png")).length, 5);
});
it("missing and oversized included notes block without reading unrelated files", async () => {
  const s = setup();
  s.files.delete("Book/Chapter One.md");
  s.files.get("Book/Chapter Two.md")!.stat.size = 3 * 1024 * 1024;
  const review = await s.review();
  assert.match(review.errors.join(" "), /not found/);
  assert.match(review.errors.join(" "), /size limit/);
  assert.ok(!s.reads.includes("Book/Chapter Two.md"));
});
it("deduplicates book-wide image reads and rejects oversized images before reading", async () => {
  const s = setup();
  for (const note of s.files.values())
    if (note.extension === "md")
      note.raw += "\n![A panel](Artwork/panel.png)\n";
  const review = await s.review();
  assert.equal(review.errors.length, 0, review.errors.join(" "));
  assert.equal(s.reads.filter((path) => path === s.image.path).length, 1);
  assert.equal(Object.values(review.document.images!).length, 1);
  s.reads.length = 0;
  s.image.stat.size = 6 * 1024 * 1024;
  assert.ok((await s.review()).errors.length);
  assert.ok(!s.reads.includes(s.image.path));
});
