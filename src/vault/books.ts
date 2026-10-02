/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import { TFile, type App } from "obsidian";
import { parseBookManifest, MAX_BOOK_BYTES } from "../books/manifest";
import { assembleBook } from "../books/assemble";
import { parseMarkdown } from "../core/markdown";
import type { FoundryDocument } from "../core/model";
import type { ImageReview } from "../core/images";
import { reviewVaultImages } from "./images";

export async function reviewVaultBook(
  app: App,
  file: TFile,
): Promise<ImageReview> {
  if (file.stat.size > 128 * 1024)
    throw new Error("The book manifest exceeds 128 KiB.");
  const raw = await app.vault.read(file);
  const manifest = parseBookManifest(raw);
  const sources = new Map<string, FoundryDocument>();
  const errors: string[] = [];
  const warnings: string[] = [];
  const signatures = [await digest(raw)];
  let total = 0;
  let imageBytes = 0;
  const cache = new Map<string, Promise<Uint8Array>>();
  const readImage = (image: TFile): Promise<Uint8Array> => {
    const cached = cache.get(image.path);
    if (cached) return cached;
    const read = async () => {
      if (
        cache.size > 50 ||
        image.stat.size > 5 * 1024 * 1024 ||
        imageBytes + image.stat.size > MAX_BOOK_BYTES
      )
        throw new Error(
          "Book images exceed the 50-image, 5 MiB/file or 20 MiB total limit.",
        );
      imageBytes += image.stat.size;
      const bytes = new Uint8Array(await app.vault.readBinary(image));
      imageBytes += Math.max(0, bytes.length - image.stat.size);
      if (bytes.length > 5 * 1024 * 1024 || imageBytes > MAX_BOOK_BYTES)
        throw new Error("Book image byte limit exceeded.");
      return bytes;
    };
    // Schedule after caching, so failed reads also occupy their budget slot.
    const promise = Promise.resolve().then(read);
    cache.set(image.path, promise);
    return promise;
  };
  for (const entry of manifest.entries) {
    if (!entry.path) continue;
    try {
      const note = app.vault.getAbstractFileByPath(entry.path);
      if (!(note instanceof TFile) || note.extension !== "md")
        throw new Error("Included Markdown note not found.");
      if (note.path === file.path)
        throw new Error("A book cannot include its own manifest.");
      if (
        note.stat.size > 2 * 1024 * 1024 ||
        total + note.stat.size > MAX_BOOK_BYTES
      )
        throw new Error("Book source size limit exceeded.");
      const markdown = await app.vault.read(note);
      const size = new TextEncoder().encode(markdown).length;
      total += size;
      if (size > 2 * 1024 * 1024 || total > MAX_BOOK_BYTES)
        throw new Error("Book source size limit exceeded.");
      signatures.push(entry.path, await digest(markdown));
      const review = await reviewVaultImages(
        app,
        note,
        parseMarkdown(markdown, note.basename),
        readImage,
      );
      sources.set(entry.path, review.document);
      signatures.push(review.signature);
      errors.push(...review.errors.map((value) => `${entry.path}: ${value}`));
      warnings.push(
        ...review.warnings.map((value) => `${entry.path}: ${value}`),
      );
    } catch (error) {
      errors.push(
        `${entry.path}: ${error instanceof Error ? error.message : "Could not read included note."}`,
      );
      sources.set(entry.path, {
        title: entry.title ?? entry.path.split("/").at(-1)!.slice(0, -3),
        metadata: {},
        blocks: [],
      });
    }
  }
  const document = assembleBook(manifest, sources);
  errors.push(...(document.resourceErrors ?? []));
  document.resourceErrors = [...new Set(errors)];
  return {
    document,
    errors: document.resourceErrors,
    warnings,
    signature: await digest(JSON.stringify(signatures)),
  };
}
async function digest(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
