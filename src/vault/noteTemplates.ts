/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import { TFile, type Vault } from "obsidian";
import {
  configuredTemplates,
  parseNoteTemplate,
  TEMPLATE_MAX_BYTES,
} from "../notes/templates";
import type { NoteTemplate } from "../notes/model";
export interface LoadedNoteTemplate {
  template: NoteTemplate;
  path: string;
  source: string;
  file: TFile;
}
export async function loadNoteTemplates(
  vault: Pick<Vault, "getAbstractFileByPath" | "read">,
  paths: unknown,
): Promise<LoadedNoteTemplate[]> {
  const result: LoadedNoteTemplate[] = [];
  for (const path of configuredTemplates(paths)) {
    const file = vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile) || file.extension !== "md")
      throw new Error(
        `Note template not found: ${path}. Update its exact path in settings.`,
      );
    const note = file;
    if (note.stat.size > TEMPLATE_MAX_BYTES)
      throw new Error(`Note template ${path} exceeds 128 KiB.`);
    const source = await vault.read(note);
    const hash = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(path),
    );
    const id = `custom-${Array.from(new Uint8Array(hash))
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 32)}`;
    result.push({
      path,
      source,
      file: note,
      template: parseNoteTemplate(source, id, note.basename),
    });
  }
  return result;
}
export async function confirmNoteTemplate(
  vault: Pick<Vault, "getAbstractFileByPath" | "read">,
  loaded: LoadedNoteTemplate,
): Promise<void> {
  if (
    vault.getAbstractFileByPath(loaded.path) !== loaded.file ||
    loaded.file.path !== loaded.path ||
    loaded.file.stat.size > TEMPLATE_MAX_BYTES ||
    (await vault.read(loaded.file)) !== loaded.source
  )
    throw new Error(
      "The selected note template changed or was moved. Reopen Create new note to review it; no note was created.",
    );
}
