/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
export const PRINT_TRIMS = {
  "5x8": { widthIn: 5, heightIn: 8, label: "5 × 8 in" },
  "5.5x8.5": { widthIn: 5.5, heightIn: 8.5, label: "5.5 × 8.5 in" },
  "6x9": { widthIn: 6, heightIn: 9, label: "6 × 9 in" },
} as const;
export interface PrintOptions {
  trim: keyof typeof PRINT_TRIMS;
  paper: "white" | "cream";
  recto: boolean;
}
export const DEFAULT_PRINT_OPTIONS: PrintOptions = {
  trim: "6x9",
  paper: "white",
  recto: true,
};
export function validatePrintOptions(value: PrintOptions): void {
  if (
    !value ||
    !Object.prototype.hasOwnProperty.call(PRINT_TRIMS, value.trim) ||
    !["white", "cream"].includes(value.paper) ||
    typeof value.recto !== "boolean" ||
    Object.keys(value).some((key) => !["trim", "paper", "recto"].includes(key))
  )
    throw new Error(
      "Choose a supported paperback trim, paper and chapter-start policy.",
    );
}
// KDP no-bleed black-ink paperback rules, checked 2026-10-02.
export const KDP_SOURCE =
  "https://kdp.amazon.com/en_US/help/topic/GVBQ3CMEQW3W2VL6";
export function minimumInsideIn(pages: number): number {
  if (!Number.isSafeInteger(pages) || pages < 1)
    throw new Error("Invalid rendered page count.");
  return pages <= 150
    ? 0.375
    : pages <= 300
      ? 0.5
      : pages <= 500
        ? 0.625
        : pages <= 700
          ? 0.75
          : 0.875;
}
export interface PrintMeasurements {
  pages: number;
  sections: { id: string; role: string; page: number }[];
  blanks: number[];
}
export function readMeasurements(value: unknown): PrintMeasurements {
  const data = value as PrintMeasurements;
  if (
    !data ||
    !Number.isSafeInteger(data.pages) ||
    data.pages < 1 ||
    !Array.isArray(data.sections) ||
    !Array.isArray(data.blanks)
  )
    throw new Error(
      "The renderer did not supply valid print proof measurements.",
    );
  const page = (number: number) =>
    Number.isSafeInteger(number) && number >= 1 && number <= data.pages;
  if (
    data.sections.some(
      (s) =>
        !s ||
        typeof s.id !== "string" ||
        typeof s.role !== "string" ||
        !page(s.page),
    ) ||
    data.blanks.some((p) => !page(p)) ||
    new Set(data.blanks).size !== data.blanks.length
  )
    throw new Error("Invalid print section or blank-page measurements.");
  return data;
}
export function printProofText(
  options: PrintOptions,
  insideIn: number,
  measurements: PrintMeasurements,
): string {
  validatePrintOptions(options);
  const { pages, sections, blanks } = readMeasurements(measurements);
  const max = options.paper === "white" ? 828 : 776;
  return [
    "Page Foundry paperback proof — not upload certification",
    `${PRINT_TRIMS[options.trim].label}; no bleed; black ink on ${options.paper} paper; ${pages} physical pages, including title/front matter and blanks.`,
    `Mirrored margins: inside ${insideIn} in; outside 0.5 in; top/bottom 0.75 in. KDP minimum inside for this page count: ${minimumInsideIn(pages)} in.`,
    pages < 24 || pages > max
      ? `Proof only: ${pages} pages is outside the supported KDP range of 24–${max}.`
      : `Page count is within the supported 24–${max} range; retailer acceptance is not guaranteed.`,
    `Parts/chapters: ${options.recto ? "right-hand physical pages" : "next page"}. Leading front matter uses Roman numbers; body uses Arabic numbers.`,
    `Intentionally blank physical pages: ${blanks.join(", ") || "none"}.`,
    ...sections.map(
      (section) =>
        `${section.role} ${section.id}: physical page ${section.page}.`,
    ),
    "Not certified: overflow, font embedding, image DPI/contrast or greyscale conversion, accessibility, bleed, cover/spine, retailer preview or physical print quality. Review every page and order a physical proof before publication.",
    `Rules checked 2 October 2026: ${KDP_SOURCE}`,
  ].join("\n");
}

export async function paginatePrint(
  options: PrintOptions,
  compile: (
    insideIn: number,
  ) => Promise<{ bytes: Uint8Array; measurements?: unknown }>,
): Promise<{
  bytes: Uint8Array;
  proofReport: string;
  measurements: PrintMeasurements;
  insideIn: number;
}> {
  validatePrintOptions(options);
  let insideIn = 0.5;
  for (let attempt = 0; attempt < 6; attempt++) {
    const result = await compile(insideIn);
    const measurements = readMeasurements(result.measurements);
    if (
      options.recto &&
      measurements.sections.some(
        (section) =>
          ["part", "chapter"].includes(section.role) && section.page % 2 === 0,
      )
    )
      throw new Error("The renderer did not honour right-hand chapter starts.");
    const required = Math.max(0.5, minimumInsideIn(measurements.pages));
    if (required <= insideIn)
      return {
        bytes: result.bytes,
        proofReport: printProofText(options, insideIn, measurements),
        measurements,
        insideIn,
      };
    insideIn = required;
  }
  throw new Error(
    "Print pagination did not converge. Try a smaller book or another trim.",
  );
}
