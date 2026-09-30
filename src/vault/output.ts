/*
 * Copyright 2026 Christian Grobmeier
 * Licensed under the Apache License, Version 2.0.
 */

import { normalizePath, type Vault } from "obsidian";
import { availableOutputPath, outputPath } from "../core/naming";

export async function savePdf(
  vault: Vault,
  folder: string,
  outputName: string,
  bytes: Uint8Array,
): Promise<string> {
  const desired = outputPath(folder, outputName);
  const directory = desired.slice(0, desired.lastIndexOf("/"));
  await ensureFolder(vault, directory);
  const path = availableOutputPath(vault, desired);
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  await vault.createBinary(path, buffer);
  return path;
}

async function ensureFolder(vault: Vault, folder: string): Promise<void> {
  const segments = normalizePath(folder).split("/").filter(Boolean);
  let current = "";
  for (const segment of segments) {
    current = current ? `${current}/${segment}` : segment;
    const existing = vault.getAbstractFileByPath(current);
    if (existing && !("children" in existing)) {
      throw new Error(`${current} is a file, not a folder.`);
    }
    if (!existing) await vault.createFolder(current);
  }
}
