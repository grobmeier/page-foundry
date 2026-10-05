/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import type { TFile, Vault } from "obsidian";
import { bookPlanPath } from "../books/editor";
export async function createNote(
  vault: Pick<Vault, "getAbstractFileByPath" | "create" | "createFolder">,
  path: string,
  source: string,
  createFolders = false,
): Promise<TFile> {
  bookPlanPath(path);
  if (vault.getAbstractFileByPath(path))
    throw new Error(
      "That file already exists. Choose another filename; nothing was overwritten.",
    );
  const parts = path.split("/").slice(0, -1);
  for (let i = 1; i <= parts.length; i++) {
    const folder = parts.slice(0, i).join("/");
    const existing = vault.getAbstractFileByPath(folder);
    if (existing && !("children" in existing))
      throw new Error(`A file blocks the folder ${folder}.`);
    if (!existing) {
      if (!createFolders)
        throw new Error(
          `Folder ${folder} does not exist. Enable Create missing folders, or choose an existing folder.`,
        );
      await vault.createFolder(folder);
    }
  }
  return vault.create(path, source);
}
export async function saveNoteDetails(
  vault: Pick<Vault, "getAbstractFileByPath" | "process">,
  file: TFile,
  path: string,
  original: string,
  replacement: string,
): Promise<void> {
  const check = () => {
    if (file.path !== path || vault.getAbstractFileByPath(path) !== file)
      throw new Error("The note was moved or removed. Reopen its details.");
  };
  check();
  await vault.process(file, (current) => {
    check();
    if (current !== original)
      throw new Error(
        "The note changed while this form was open. Reopen its details; nothing was overwritten.",
      );
    return replacement;
  });
}
