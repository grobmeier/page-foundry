/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import { TFile, type Vault } from "obsidian";
import { parsePack, PACK_MAX_BYTES, type PresetPack } from "../packs/model";
import { saveNoteDetails } from "./notes";
import { hasControlCharacters } from "../core/validation";
export interface PackSnapshot {
  file: TFile;
  path: string;
  source: string;
  pack: PresetPack;
}
export function editablePackPath(value: string): string {
  const path = value.trim();
  if (
    !path ||
    path.length > 1000 ||
    !path.endsWith(".json") ||
    /[\\:%?#]/.test(path) ||
    hasControlCharacters(path) ||
    path.split("/").some((p) => !p || p === "." || p === "..")
  )
    throw new Error(
      "Choose an exact vault-relative JSON file path without traversal or a URL.",
    );
  return path;
}
export async function readEditablePack(
  vault: Pick<Vault, "getAbstractFileByPath" | "read">,
  path: string,
): Promise<PackSnapshot> {
  editablePackPath(path);
  const file = vault.getAbstractFileByPath(path);
  if (!(file instanceof TFile) || file.extension !== "json")
    throw new Error(
      "The configured output preset pack was not found. Repair its path or clear it before creating a new pack.",
    );
  const note = file;
  if (note.stat.size > PACK_MAX_BYTES)
    throw new Error("This output pack exceeds 128 KiB.");
  const source = await vault.read(note),
    pack = parsePack(source);
  if (pack.id === "core")
    throw new Error(
      "This pack cannot be edited by this engine. Its contents were not changed.",
    );
  return { file: note, path, source, pack };
}
export async function saveEditablePack(
  vault: Pick<Vault, "getAbstractFileByPath" | "process" | "create">,
  path: string,
  source: string,
  snapshot?: PackSnapshot,
): Promise<void> {
  path = editablePackPath(path);
  parsePack(source);
  if (snapshot) {
    if (snapshot.path !== path)
      throw new Error(
        "The configured pack changed. Reopen Manage output presets.",
      );
    return saveNoteDetails(vault, snapshot.file, path, snapshot.source, source);
  }
  if (vault.getAbstractFileByPath(path))
    throw new Error(
      "That pack file already exists. Nothing was overwritten; configure it explicitly or choose a new path.",
    );
  const folder = path.split("/").slice(0, -1).join("/");
  if (folder) {
    const parent = vault.getAbstractFileByPath(folder);
    if (!parent || !("children" in parent))
      throw new Error(
        "Choose an existing vault folder for your private output pack.",
      );
  }
  await vault.create(path, source);
}
