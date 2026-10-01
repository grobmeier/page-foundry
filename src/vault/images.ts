/*
 * Copyright 2026 Christian Grobmeier
 * Licensed under the Apache License, Version 2.0.
 */

import { TFile, type App } from "obsidian";
import { decodeImage, resolveImages, type ImageReview } from "../core/images";
import type { FoundryDocument } from "../core/model";

export function reviewVaultImages(
  app: App,
  note: TFile,
  document: FoundryDocument,
): Promise<ImageReview> {
  return resolveImages(document, {
    resolve(path) {
      const directory = note.path.slice(
        0,
        Math.max(0, note.path.lastIndexOf("/")),
      );
      // Explicit paths must not fall back to an unrelated same-named attachment.
      // Only short names use Obsidian's normal attachment-link resolution.
      const file = path.includes("/")
        ? (app.vault.getAbstractFileByPath(
            directory ? `${directory}/${path}` : path,
          ) ?? app.vault.getAbstractFileByPath(path))
        : app.metadataCache.getFirstLinkpathDest(path, note.path);
      if (!(file instanceof TFile)) return;
      return {
        path: file.path,
        size: file.stat.size,
        async read() {
          return new Uint8Array(await app.vault.readBinary(file));
        },
      };
    },
    decode: decodeImage,
  });
}
