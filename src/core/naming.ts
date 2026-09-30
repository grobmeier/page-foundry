/*
 * Copyright 2026 Christian Grobmeier
 * Licensed under the Apache License, Version 2.0.
 */

import { normalizePath, type TAbstractFile, type Vault } from "obsidian";

export function safePdfName(value: string): string {
  const stem = value
    .replace(/\.pdf$/iu, "")
    .normalize("NFKC")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/gu, "-")
    .replace(/\s+/gu, " ")
    .replace(/[. ]+$/gu, "")
    .trim();
  return `${stem || "document"}.pdf`;
}

export function outputPath(folder: string, name: string): string {
  const cleanFolder = normalizePath(folder.trim() || "Page Foundry").replace(
    /^\/+|\/+$/gu,
    "",
  );
  if (
    !cleanFolder ||
    cleanFolder === "." ||
    cleanFolder.split("/").includes("..")
  ) {
    throw new Error("Choose a folder inside the vault.");
  }
  return normalizePath(`${cleanFolder}/${safePdfName(name)}`);
}

export function availableOutputPath(
  vault: Pick<Vault, "getAbstractFileByPath">,
  desired: string,
): string {
  if (!vault.getAbstractFileByPath(desired)) return desired;
  const stem = desired.replace(/\.pdf$/iu, "");
  for (let index = 2; index < 10_000; index += 1) {
    const candidate = `${stem} ${index}.pdf`;
    if (!vault.getAbstractFileByPath(candidate)) return candidate;
  }
  throw new Error("Could not find an available output filename.");
}

export function isFolder(file: TAbstractFile | null): boolean {
  return Boolean(file && "children" in file);
}
