/*
 * Copyright 2026 Christian Grobmeier
 * Licensed under the Apache License, Version 2.0.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { unzipSync, strFromU8 } from "fflate";
import { parseMarkdown } from "../src/core/markdown";
import {
  IMAGE_LIMITS,
  imageNodes,
  imageSize,
  inspectImage,
  localImagePath,
  resolveImages,
  type ImageHost,
} from "../src/core/images";
import { EpubRenderer } from "../src/epub/renderer";
import { DocxRenderer } from "../src/docx/renderer";
import { createTypstSource } from "../src/pdf/typstSource";
import { fixtureJpeg, fixturePng } from "./fixtures/images";

function host(bytes = fixturePng()) {
  const reads: string[] = [];
  const resolved: string[] = [];
  const adapter: ImageHost = {
    resolve(path) {
      resolved.push(path);
      if (path === "missing.png") return;
      return {
        path: path === "photo.png" ? "Artwork/photo.png" : path,
        size: bytes.length,
        async read() {
          reads.push(path);
          return bytes.slice();
        },
      };
    },
    async decode() {},
  };
  return { adapter, reads, resolved };
}

describe("local images", () => {
  it("validates and embeds a neutral JPEG as native JPEG bytes", async () => {
    const jpeg = fixtureJpeg();
    assert.deepEqual(inspectImage(jpeg), {
      mediaType: "image/jpeg",
      extension: "jpg",
      width: 240,
      height: 480,
    });
    const review = await resolveImages(
      parseMarkdown("![Portrait](portrait.jpg)", "JPEG"),
      host(jpeg).adapter,
    );
    assert.deepEqual(review.errors, []);
    const epub = unzipSync(
      new EpubRenderer().render(review.document, {
        language: "en",
        identifier: "urn:page-foundry:jpeg",
      }).bytes,
    );
    assert.deepEqual(epub["EPUB/images/image-1.jpg"], jpeg);
    const docx = unzipSync(
      (
        await new DocxRenderer().render(
          review.document,
          "plain-editable",
          "us-letter",
        )
      ).bytes,
    );
    assert.ok(
      Object.entries(docx).some(
        ([name, bytes]) =>
          name.endsWith(".jpg") && Buffer.from(bytes).equals(Buffer.from(jpeg)),
      ),
    );
  });

  it("bounds total source reads even for malformed resources", async () => {
    const fixture = host(new Uint8Array(IMAGE_LIMITS.fileBytes));
    const review = await resolveImages(
      parseMarkdown(
        Array.from({ length: 5 }, (_, i) => `![Panel](p${i}.png)`).join("\n\n"),
        "Budget",
      ),
      fixture.adapter,
    );
    assert.equal(fixture.reads.length, 4);
    assert.match(review.errors.at(-1)!, /20 MiB/u);
  });

  it("keeps nested reference definitions local to each parsed note", () => {
    const first = parseMarkdown(
      "> ![Panel][nested]\n>\n> [nested]: first.png",
      "First",
    );
    const second = parseMarkdown(
      "![Panel][nested]\n\n[nested]: second.png",
      "Second",
    );
    assert.equal(imageNodes(first)[0]!.url, "first.png");
    assert.equal(imageNodes(second)[0]!.url, "second.png");
  });
  it("parses Markdown, references, wiki images, aliases and nested image links", () => {
    const document = parseMarkdown(
      "![Blue & gold](Artwork/photo.png)\n\n![Reference][panel]\n\n![[photo.png|300]]\n\n![[photo.png|A panel]]\n\n[![Linked](photo.png)](https://example.com)\n\n[panel]: Artwork/photo.png",
      "Images",
    );
    const nodes = imageNodes(document);
    assert.equal(nodes.length, 5);
    assert.equal(nodes[1]!.url, "Artwork/photo.png");
    assert.equal(nodes[2]!.width, 300);
    assert.equal(nodes[3]!.alt, "A panel");
  });

  it("does not request images from escaped text, inline code or fenced code", () => {
    const document = parseMarkdown(
      "\\![[photo.png]] `![[photo.png]]`\n\n```\n![hidden](photo.png)\n```\n\n![[photo.png]]",
      "Escapes",
    );
    assert.equal(imageNodes(document).length, 1);
  });

  it("normalises local paths while rejecting remote, traversal and unsafe paths", () => {
    assert.equal(
      localImagePath("./Artwork/a%20panel.png"),
      "Artwork/a panel.png",
    );
    for (const path of [
      "https://example.com/a.png",
      "//host/a.png",
      "/a.png",
      "C:/a.png",
      "../a.png",
      "x/%2e%2e/a.png",
      "%252e%252e/a.png",
      "file:a.png",
      "data:a.png",
      "x\\a.png",
      "a.svg",
      "a.png?x",
      "a.png#x",
      "a%00.png",
      "a%ZZ.png",
    ])
      assert.throws(() => localImagePath(path), Error, path);
  });

  it("reads only references, deduplicates resolved paths and retains per-occurrence alt text", async () => {
    const fixture = host();
    const source = parseMarkdown(
      "![First](photo.png) ![Second](Artwork/photo.png)",
      "Images",
    );
    const review = await resolveImages(source, fixture.adapter);
    assert.deepEqual(review.errors, []);
    assert.equal(Object.keys(review.document.images!).length, 1);
    assert.deepEqual(fixture.reads, ["photo.png"]);
    assert.equal(imageNodes(source)[0]!.resourceId, undefined);
    assert.equal(imageNodes(review.document)[1]!.alt, "Second");
  });

  it("reports missing and remote files without reading unrelated files", async () => {
    const fixture = host();
    const review = await resolveImages(
      parseMarkdown(
        "![Missing](missing.png) ![Remote](https://example.com/a.png)",
        "Bad",
      ),
      fixture.adapter,
    );
    assert.equal(review.errors.length, 2);
    assert.deepEqual(fixture.resolved, ["missing.png"]);
    assert.deepEqual(fixture.reads, []);
  });

  it("rejects oversized metadata before reading and actual bytes after reading", async () => {
    const fixture = host();
    fixture.adapter.resolve = (path) => ({
      path,
      size: IMAGE_LIMITS.fileBytes + 1,
      async read() {
        throw new Error("Must not read");
      },
    });
    assert.match(
      (
        await resolveImages(
          parseMarkdown("![](photo.png)", "Limit"),
          fixture.adapter,
        )
      ).errors[0]!,
      /5 MiB/u,
    );
    fixture.adapter.resolve = (path) => ({
      path,
      size: 10,
      async read() {
        return new Uint8Array(IMAGE_LIMITS.fileBytes + 1);
      },
    });
    assert.match(
      (
        await resolveImages(
          parseMarkdown("![](photo.png)", "Limit"),
          fixture.adapter,
        )
      ).errors[0]!,
      /5 MiB/u,
    );
  });

  it("rejects malformed, mismatched, undecodable and oversized-dimension images", async () => {
    assert.throws(() => inspectImage(new Uint8Array([1, 2, 3])), /valid PNG/u);
    assert.throws(() => inspectImage(fixturePng().slice(0, -5)), /truncated/u);
    const pixels = fixturePng();
    new DataView(pixels.buffer).setUint32(16, 100_000);
    assert.throws(() => inspectImage(pixels), /megapixels/u);
    const fixture = host();
    assert.match(
      (
        await resolveImages(
          parseMarkdown("![](photo.jpg)", "Mismatch"),
          fixture.adapter,
        )
      ).errors[0]!,
      /extension/u,
    );
    fixture.adapter.decode = async () => {
      throw new Error("Cannot decode");
    };
    assert.match(
      (
        await resolveImages(
          parseMarkdown("![](photo.png)", "Decode"),
          fixture.adapter,
        )
      ).errors[0]!,
      /Cannot decode/u,
    );
  });

  it("enforces the unique-image count and warns about missing alt text", async () => {
    const fixture = host();
    const source = Array.from(
      { length: 51 },
      (_, i) => `![](panel-${i}.png)`,
    ).join("\n\n");
    const review = await resolveImages(
      parseMarkdown(source, "Count"),
      fixture.adapter,
    );
    assert.equal(fixture.reads.length, 50);
    assert.match(review.errors[0]!, /50 unique/u);
    assert.equal(review.warnings.length, 50);
  });

  it("fingerprints byte changes and resolved paths, not just names or file sizes", async () => {
    const source = parseMarkdown("![Panel](photo.png)", "Change");
    const first = await resolveImages(source, host().adapter);
    const changed = fixturePng();
    changed[changed.length - 1] = changed[changed.length - 1]! ^ 1;
    const second = await resolveImages(source, host(changed).adapter);
    assert.notEqual(first.signature, second.signature);
  });

  it("blocks HTML images and does not upscale or distort image sizing", async () => {
    const review = await resolveImages(
      parseMarkdown('<img src="photo.png">', "HTML"),
      host().adapter,
    );
    assert.match(review.errors[0]!, /HTML images/u);
    const image = {
      ...inspectImage(fixturePng()),
      id: "image-1",
      path: "photo.png",
      bytes: fixturePng(),
    };
    assert.deepEqual(imageSize(image, 300, 480, 600), {
      width: 300,
      height: 150,
    });
    assert.deepEqual(imageSize(image, 1000, 480, 600), {
      width: 480,
      height: 240,
    });
  });

  it("embeds the same reviewed bytes natively across EPUB, DOCX and Typst", async () => {
    const source = parseMarkdown(
      "---\nidentifier: urn:page-foundry:images\n---\n\n![Blue & gold](photo.png)\n\n![[photo.png|300]]",
      "Images",
    );
    const { document } = await resolveImages(source, host().adapter);
    const epub = unzipSync(
      new EpubRenderer().render(document, { language: "en" }).bytes,
    );
    assert.deepEqual(epub["EPUB/images/image-1.png"], fixturePng());
    assert.match(
      strFromU8(epub["EPUB/package.opf"]!),
      /media-type="image\/png"/u,
    );
    assert.match(
      strFromU8(epub["EPUB/content.xhtml"]!),
      /alt="Blue &amp; gold"/u,
    );
    const docx = unzipSync(
      (await new DocxRenderer().render(document, "plain-editable", "a4")).bytes,
    );
    const media = Object.entries(docx).filter(
      ([name]) => name.startsWith("word/media/") && !name.endsWith("/"),
    );
    assert.equal(media.length, 1);
    assert.deepEqual(media[0]![1], fixturePng());
    assert.match(
      strFromU8(docx["word/document.xml"]!),
      /descr="Blue &amp; gold"/u,
    );
    const typst = createTypstSource(document, "plain-document", "a4");
    assert.match(typst, /\/assets\/image-1.png/u);
    assert.match(typst, /width: 225pt, height: 112.5pt/u);
    assert.throws(
      () => createTypstSource(source, "plain-document", "a4"),
      /resolve/u,
    );
  });
});
