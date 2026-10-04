/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import type { TFile, Vault } from "obsidian";
import { bookPlanPath, serializeBookPlan } from "../books/editor";
import type { BookManifest } from "../books/manifest";
export interface BookPlanSnapshot {
  file: TFile;
  source: string;
}

export async function saveBookPlan(
  vault: Pick<Vault, "getAbstractFileByPath" | "create" | "process">,
  path: string,
  book: BookManifest,
  snapshot?: BookPlanSnapshot,
): Promise<TFile> {
  const desired = bookPlanPath(path);
  const source = serializeBookPlan(book, snapshot?.source);
  for (const entry of book.entries) {
    if (!entry.path?.trim()) continue;
    if (entry.path.trim() === desired)
      throw new Error("A book cannot include its own book plan.");
    const file = vault.getAbstractFileByPath(entry.path.trim());
    if (!file || !("extension" in file) || file.extension !== "md")
      throw new Error(
        `Note not found: ${entry.path.trim()}. Check its exact path.`,
      );
  }
  const existing = vault.getAbstractFileByPath(desired);
  if (!snapshot) {
    if (existing)
      throw new Error(
        "That book plan file already exists. Choose another filename, or open it and use Set up book to edit it.",
      );
    return vault.create(desired, source);
  }
  if (snapshot.file.path !== desired || existing !== snapshot.file)
    throw new Error(
      "The book plan was moved or removed. Reopen it before saving.",
    );
  await vault.process(snapshot.file, (current) => {
    if (
      snapshot.file.path !== desired ||
      vault.getAbstractFileByPath(desired) !== snapshot.file
    )
      throw new Error(
        "The book plan was moved or removed. Reopen it before saving.",
      );
    if (current !== snapshot.source)
      throw new Error(
        "The book plan changed while this form was open. Reopen it to review the latest version; nothing was overwritten.",
      );
    return source;
  });
  return snapshot.file;
}
