/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import type {
  BlockNode,
  FoundryDocument,
  InlineNode,
  OutputFormat,
  PageProfileId,
} from "./model";
import { headingIndex, resolveFragment, safeExternalHref } from "./headings";
import { metadataErrors, type ResolvedPreset } from "../packs/model";
import {
  DEFAULT_PRINT_OPTIONS,
  PRINT_TRIMS,
  validatePrintOptions,
  type PrintOptions,
} from "../print/model";

export interface PreflightFinding {
  code: string;
  severity: "blocker" | "advice";
  message: string;
}
export interface PreflightReport {
  findings: PreflightFinding[];
  notChecked: string[];
  summary: string;
}
export interface PreflightOptions {
  format: OutputFormat;
  profile: PageProfileId;
  preset: ResolvedPreset;
  metadata: Record<string, string>;
  resourceErrors?: string[];
  resourceWarnings?: string[];
  packError?: string;
  printOptions?: PrintOptions;
}

export function preflight(
  document: FoundryDocument,
  options: PreflightOptions,
): PreflightReport {
  const findings: PreflightFinding[] = [];
  const add = (
    code: string,
    severity: PreflightFinding["severity"],
    message: string,
  ): void => {
    if (
      !findings.some(
        (finding) =>
          finding.message === message && finding.severity === severity,
      )
    )
      findings.push({ code, severity, message });
  };
  if (options.packError) add("pack", "blocker", options.packError);
  if (
    options.preset.outputs[options.format]?.book &&
    !document.book?.entries.length
  )
    add(
      "book-design",
      "blocker",
      "This design needs an ordered book. Open a book plan before publishing.",
    );
  for (const message of metadataErrors(
    options.preset,
    options.metadata,
    options.format,
  ))
    add("metadata", "blocker", message);
  for (const message of [
    ...(document.resourceErrors ?? []),
    ...(options.resourceErrors ?? []),
  ])
    add("resource", "blocker", message);
  for (const message of options.resourceWarnings ?? [])
    add("resource-advice", "advice", message);
  for (const message of document.sourceWarnings ?? [])
    add("source-format", "advice", message);
  const index = headingIndex(document);
  let words = 0,
    images = 0,
    content = false;
  function inline(nodes: InlineNode[]): void {
    for (const node of nodes) {
      if (node.type === "image") {
        content = true;
        images++;
        if (
          !node.alt.trim() &&
          !options.resourceWarnings?.some((message) =>
            message.includes("alt text"),
          )
        )
          add(
            "image-description",
            "advice",
            "An image has no description. Add useful alt text if it conveys information; a deliberately decorative image may remain empty.",
          );
      } else if (node.type === "text" || node.type === "inline-code") {
        words +=
          node.value.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)?.length ??
          0;
        if (node.value.trim()) content = true;
      } else if ("children" in node) {
        if (node.type === "link") {
          if (node.destinationError)
            add(
              "heading-link",
              options.format === "epub" ? "blocker" : "advice",
              node.destinationError,
            );
          else if (node.url.startsWith("#")) {
            if (options.format === "epub") {
              const result = resolveFragment(index, node.url);
              if (result.error) add("heading-link", "blocker", result.error);
            } else
              add(
                "heading-link",
                "advice",
                "In-note heading links become plain text in PDF/DOCX; live destinations are currently supported only in EPUB.",
              );
          } else if (!safeExternalHref(node.url))
            add(
              "unsupported-link",
              "advice",
              document.book
                ? "A link outside the explicit book list or using an unsupported protocol becomes plain text. Unlisted notes and remote destinations are not checked."
                : "A local, other-note, or unsupported-protocol link becomes plain text. Only this note is included; other files and remote destinations are not checked.",
            );
        }
        inline(node.children);
      }
    }
  }
  function blocks(nodes: BlockNode[]): void {
    for (const node of nodes) {
      if ("children" in node) inline(node.children);
      else if (node.type === "blockquote") blocks(node.blocks);
      else if (node.type === "list") node.items.forEach(blocks);
    }
  }
  blocks(document.blocks);
  if (!content)
    add(
      "empty-content",
      "blocker",
      "The note has no exportable body content. Add text or a supported image before publishing.",
    );
  const author = options.preset.metadata.some((field) => field.key === "author")
    ? options.metadata.author
    : (document.metadata.author ?? document.metadata.creator);
  if (
    !author?.trim() &&
    options.preset.outputs[options.format]?.recipe !== "letter"
  )
    add(
      "author",
      "advice",
      "No author is supplied. Add one if the intended publication requires it.",
    );
  let depth = 0;
  for (const heading of index.entries) {
    if (heading.depth > depth + 1)
      add(
        "heading-order",
        "advice",
        "The heading structure skips a level. Review section hierarchy for navigation and readability.",
      );
    depth = heading.depth;
  }
  if (options.format === "epub" && !index.entries.length)
    add(
      "navigation",
      "advice",
      "No section headings are present. EPUB navigation will contain only the document title.",
    );
  const recipe = options.preset.outputs[options.format]?.recipe;
  const print = recipe === "paperback-interior";
  if (print) {
    if (!document.book)
      add(
        "print-book",
        "blocker",
        "Paperback interior requires an ordered book.",
      );
    try {
      validatePrintOptions(options.printOptions ?? DEFAULT_PRINT_OPTIONS);
    } catch (error) {
      add("print-options", "blocker", (error as Error).message);
    }
    add(
      "print-proof",
      "advice",
      "No-bleed black-ink paperback proof. Colour images are not converted to greyscale. Inspect the measured report and every PDF page before publication.",
    );
  }
  if (document.book && recipe === "letter")
    add("book-preset", "blocker", "Letter layouts are not book presets.");
  const manuscript = recipe === "manuscript" || recipe === "general-manuscript";
  const notChecked = [
    document.book
      ? "External destinations and notes outside the explicit book list are not opened or checked."
      : "External destinations and other notes are not opened or checked.",
    "Accessibility and publisher-specific submission compliance are not certified.",
    "Physical-device memory, performance and saving/sharing require device testing.",
  ];
  if (options.format !== "epub")
    notChecked.unshift(
      "Rendered page count, overflow, blank pages and font embedding have not been inspected by this report.",
    );
  if (options.format === "pdf" && !print)
    notChecked.unshift(
      "KDP trim, gutter, bleed and recto/verso rules are not checked; A4/US Letter is not a KDP profile.",
    );
  return {
    findings,
    notChecked,
    summary: `${options.format.toUpperCase()} · ${options.preset.name} · approximately ${words} body words · ${index.entries.length} section headings · ${images} image occurrences${print ? ` · ${PRINT_TRIMS[(options.printOptions ?? DEFAULT_PRINT_OPTIONS).trim]?.label ?? "invalid trim"}` : options.format !== "epub" ? ` · ${options.profile === "a4" ? "A4" : "US Letter"}` : ""}.${manuscript ? " The selected recipe provides a title page, running header and numbered body; inspect the generated file to confirm layout." : ""}`,
  };
}

export function reportText(report: PreflightReport): string {
  const blockers = report.findings.filter(
    (finding) => finding.severity === "blocker",
  ).length;
  return [
    "Page Foundry preflight",
    report.summary,
    `${blockers} blocker(s); ${report.findings.length - blockers} advice item(s).`,
    ...report.findings.map(
      (finding) =>
        `${finding.severity === "blocker" ? "Cannot export" : "Advice"}: ${finding.message}`,
    ),
    "Not checked:",
    ...report.notChecked.map((message) => `- ${message}`),
  ].join("\n");
}
