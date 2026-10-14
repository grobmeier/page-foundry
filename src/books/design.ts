/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import { validatePrintOptions, type PrintOptions } from "../print/model";

export interface BookDesign {
  titlePage: boolean;
  titleAlign: "left" | "center";
  titleSizePt: number;
  titleTopMm: number;
  imprintPage: boolean;
  contents: boolean;
  chapterAlign: "left" | "center";
  chapterSizePt: number;
  chapterTopMm: number;
  chapterRule: boolean;
  ruleWidthPercent: number;
  ruleWeightPt: number;
  indentMm: number;
  paragraphSpaceMm: number;
  header: "none" | "book-title" | "chapter-title";
  pageNumbers: "center" | "outside";
  printDefaults?: PrintOptions;
}
export const DEFAULT_BOOK_DESIGN: BookDesign = {
  titlePage: true,
  titleAlign: "center",
  titleSizePt: 26,
  titleTopMm: 55,
  imprintPage: true,
  contents: true,
  chapterAlign: "center",
  chapterSizePt: 20,
  chapterTopMm: 18,
  chapterRule: false,
  ruleWidthPercent: 25,
  ruleWeightPt: 0.5,
  indentMm: 4,
  paragraphSpaceMm: 0,
  header: "chapter-title",
  pageNumbers: "outside",
};
export const BOOK_DESIGN_RANGES = {
  titleSizePt: [8, 48],
  titleTopMm: [0, 80],
  chapterSizePt: [8, 48],
  chapterTopMm: [0, 80],
  ruleWidthPercent: [5, 80],
  ruleWeightPt: [0.1, 2],
  indentMm: [0, 12],
  paragraphSpaceMm: [0, 12],
} as const;

export function parseBookDesign(value: unknown): BookDesign {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Book design must be an object.");
  const input = value as Record<string, unknown>;
  for (const key of Object.keys(input))
    if (!Object.hasOwn(DEFAULT_BOOK_DESIGN, key) && key !== "printDefaults")
      throw new Error(`Unsupported book design field: ${key}.`);
  const result = { ...DEFAULT_BOOK_DESIGN, ...input };
  for (const key of [
    "titlePage",
    "imprintPage",
    "contents",
    "chapterRule",
  ] as const)
    if (typeof result[key] !== "boolean")
      throw new Error(`${key} must be true or false.`);
  for (const [key, range] of Object.entries(BOOK_DESIGN_RANGES)) {
    const number = result[key as keyof typeof BOOK_DESIGN_RANGES];
    if (
      typeof number !== "number" ||
      !Number.isFinite(number) ||
      number < range[0] ||
      number > range[1]
    )
      throw new Error(`${key} is outside the supported book design range.`);
  }
  for (const key of ["titleAlign", "chapterAlign"] as const)
    if (!["left", "center"].includes(result[key]))
      throw new Error("Choose left or centred alignment.");
  if (!["none", "book-title", "chapter-title"].includes(result.header))
    throw new Error("Choose a supported running header.");
  if (!["center", "outside"].includes(result.pageNumbers))
    throw new Error("Choose centred or outside page numbers.");
  if (input.printDefaults !== undefined)
    validatePrintOptions(input.printDefaults as PrintOptions);
  return structuredClone(result) as BookDesign;
}
