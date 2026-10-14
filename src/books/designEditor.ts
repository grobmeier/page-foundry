/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import type { PackPreset } from "../packs/model";
import {
  parseBookDesign,
  DEFAULT_BOOK_DESIGN,
  type BookDesign,
} from "./design";
export function newBookDesign(
  id: string,
  recipe: "plain-document" | "paperback-interior" = "plain-document",
): PackPreset {
  return {
    id,
    name: "My book design",
    description: "A locally configured book design.",
    metadata: [
      { key: "title", label: "Book title", required: true },
      { key: "author", label: "Author" },
      { key: "subtitle", label: "Subtitle" },
      { key: "imprint", label: "Imprint" },
    ],
    outputs: {
      pdf: {
        recipe,
        style: { bodySizePt: 11, lineSpacing: 1.35 },
        book: structuredClone(DEFAULT_BOOK_DESIGN),
      },
    },
  };
}
export function editBookDesign(
  base: PackPreset,
  name: string,
  design: BookDesign,
): PackPreset {
  if (
    !base.outputs.pdf ||
    !["plain-document", "paperback-interior"].includes(base.outputs.pdf.recipe)
  )
    throw new Error("Choose a Book PDF or Paperback proof base.");
  const result = structuredClone(base);
  result.name = name.trim();
  result.outputs.pdf!.book = parseBookDesign(design);
  return result;
}
export function bookDesignCopyPath(path: string): string {
  return path.replace(/\.json$/, "-book-designs.json");
}
