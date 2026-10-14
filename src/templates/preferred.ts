/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import type { Template, TemplateLayout } from "./catalog";
import { cleanTemplateHistory, templateKey } from "./catalog";
export interface NoteLayout {
  noteKey: string;
  layoutKey: string;
}
export async function noteLayoutKey(path: string): Promise<string> {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(path),
  );
  return [...new Uint8Array(bytes)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
export function cleanNoteLayouts(value: unknown): NoteLayout[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value
    .slice(0, 500)
    .flatMap((row) => {
      if (
        !row ||
        typeof row.noteKey !== "string" ||
        !/^[a-f0-9]{64}$/.test(row.noteKey) ||
        seen.has(row.noteKey) ||
        !cleanTemplateHistory([{ key: row.layoutKey, uses: 1, lastUsed: 0 }])
          .length
      )
        return [];
      seen.add(row.noteKey);
      return [{ noteKey: row.noteKey, layoutKey: row.layoutKey }];
    })
    .slice(0, 100);
}
export function rememberNoteLayout(
  value: unknown,
  noteKey: string,
  layout: TemplateLayout,
): NoteLayout[] {
  return cleanNoteLayouts([
    { noteKey, layoutKey: templateKey(layout) },
    ...cleanNoteLayouts(value).filter((row) => row.noteKey !== noteKey),
  ]);
}
export function defaultLayout(library: Template[], kind: string): Template {
  const id =
    kind === "submission-letter"
      ? "submission-letter"
      : kind === "letter"
        ? "letter"
        : kind === "manuscript"
          ? "general-manuscript"
          : "plain-document";
  const match =
    library.find(
      (t) => t.preset === id && t.format === "pdf" && t.profile === "a4",
    ) ??
    library.find((t) => t.preset === "plain-document" && t.format === "pdf");
  if (!match) throw new Error("No compatible default layout is available.");
  return match;
}
