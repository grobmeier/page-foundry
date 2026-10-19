/*
 * Copyright 2026 Christian Grobmeier
 * Licensed under the Apache License, Version 2.0.
 */

import { normalizePath, type TAbstractFile, type Vault } from "obsidian";
import type { OutputFormat } from "./model";
import { replaceControlCharacters } from "./validation";

export function safePdfName(value: string): string {
  return safeOutputName(value, "pdf");
}

export function safeOutputName(value: string, extension: OutputFormat): string {
  const stem = replaceControlCharacters(
    value.replace(/\.(?:pdf|epub|docx)$/iu, "").normalize("NFKC"),
    "-",
  )
    .replace(/[<>:"/\\|?*]/gu, "-")
    .replace(/\s+/gu, " ")
    .replace(/[. ]+$/gu, "")
    .trim();
  return `${stem || "document"}.${extension}`;
}

export function outputPath(
  folder: string,
  name: string,
  extension: OutputFormat,
): string {
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
  return normalizePath(`${cleanFolder}/${safeOutputName(name, extension)}`);
}

export function availableOutputPath(
  vault: Pick<Vault, "getAbstractFileByPath">,
  desired: string,
): string {
  if (!vault.getAbstractFileByPath(desired)) return desired;
  const match = /^(.*)(\.[^.]+)$/u.exec(desired);
  const stem = match?.[1] ?? desired;
  const extension = match?.[2] ?? "";
  for (let index = 2; index < 10_000; index += 1) {
    const candidate = `${stem} ${index}${extension}`;
    if (!vault.getAbstractFileByPath(candidate)) return candidate;
  }
  throw new Error("Could not find an available output filename.");
}

export function isFolder(file: TAbstractFile | null): boolean {
  return Boolean(file && "children" in file);
}
