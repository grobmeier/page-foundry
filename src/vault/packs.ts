/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import { TFile, type App } from "obsidian";
import { CORE_PACK, CORE_CATALOG } from "../packs/core";
import {
  catalogue,
  parsePack,
  PACK_MAX_BYTES,
  type PresetCatalog,
} from "../packs/model";

export function packPath(value: string): string {
  const path = value.trim();
  let decoded: string;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    throw new Error("Invalid preset pack path.");
  }
  if (
    !path ||
    path.length > 1000 ||
    /[\\:\u0000-\u001f]/u.test(decoded) ||
    decoded.startsWith("/") ||
    decoded.split("/").some((part) => !part || part === "." || part === "..") ||
    !decoded.endsWith(".json")
  )
    throw new Error(
      "Use an explicit vault-relative JSON path without traversal or a URL.",
    );
  return path;
}

export async function loadVaultPacks(
  app: App,
  configuredPath: string,
): Promise<PresetCatalog> {
  if (!configuredPath.trim()) return CORE_CATALOG;
  try {
    const path = packPath(configuredPath);
    const file = app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile))
      throw new Error("The configured preset pack was not found.");
    if (file.stat.size > PACK_MAX_BYTES)
      throw new Error("A preset pack must be no larger than 128 KiB.");
    const source = await app.vault.read(file);
    const pack = parsePack(source);
    return catalogue([CORE_PACK, pack], `${path}\n${source}`);
  } catch (error) {
    return {
      ...CORE_CATALOG,
      signature: "invalid",
      error: `Cannot load the configured preset pack. ${error instanceof Error ? error.message : "Check the file and its permissions."} Repair it or clear the preset pack path in settings.`,
    };
  }
}
