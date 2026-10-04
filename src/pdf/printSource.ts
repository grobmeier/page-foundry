/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import type { BlockNode, FoundryDocument } from "../core/model";
import {
  PRINT_TRIMS,
  validatePrintOptions,
  type PrintOptions,
} from "../print/model";
import { renderBlock, renderText } from "./typstSource";

export function createPrintSource(
  document: FoundryDocument,
  options: PrintOptions,
  insideIn: number,
): string {
  validatePrintOptions(options);
  if (!document.book?.entries.length)
    throw new Error("Paperback interior requires an ordered book.");
  if (!Number.isFinite(insideIn) || insideIn < 0.5 || insideIn > 0.875)
    throw new Error("Invalid print gutter.");
  const trim = PRINT_TRIMS[options.trim];
  const snapshot = {
    ...document,
    paperback: { ...trim, insideIn, outsideIn: 0.5, verticalIn: 0.75 },
  };
  const entries = new Map(
    document.book.entries.map((entry) => [`book-${entry.id}`, entry]),
  );
  const groups: { role: string; blocks: BlockNode[] }[] = [];
  for (const block of document.blocks) {
    if (block.type === "page-break") continue;
    const entry =
      block.type === "heading" && block.anchor
        ? entries.get(block.anchor)
        : undefined;
    if (entry && entry.role !== "scene")
      groups.push({ role: entry.role, blocks: [] });
    if (!groups.length)
      groups.push({ role: entry?.role ?? "chapter", blocks: [] });
    groups.at(-1)!.blocks.push(block);
  }
  let body = false;
  const pages = groups
    .map((group, index) => {
      if (group.role !== "front-matter") body = true;
      const phase = body ? "body" : "front";
      const content = group.blocks
        .map((block) => {
          const entry =
            block.type === "heading" && block.anchor
              ? entries.get(block.anchor)
              : undefined;
          const marker = entry
            ? `#context [#metadata((id: ${JSON.stringify(entry.id)}, role: ${JSON.stringify(entry.role)}, phase: "${phase}")) <foundry-section>]\n`
            : "";
          return marker + renderBlock(block, snapshot);
        })
        .join("\n\n");
      const recto = options.recto && ["part", "chapter"].includes(group.role);
      const last =
        index === groups.length - 1
          ? `\n#context [#metadata((pages: here().page(), sections: query(<foundry-section>).map(it => (id: it.value.id, role: it.value.role, page: it.location().page())), blanks: query(<foundry-blank>).map(it => it.location().page()))) <foundry-proof>]`
          : "";
      return `${recto ? '#context { if calc.even(here().page()) { page(header: none, footer: none)[#metadata("blank") <foundry-blank>] } }\n' : ""}#page[${content}${last}]`;
    })
    .join("\n\n");
  return `#set page(width: ${trim.widthIn}in, height: ${trim.heightIn}in, binding: left, margin: (inside: ${insideIn}in, outside: 0.5in, top: 0.75in, bottom: 0.75in), header: none)
#set text(font: "Libertinus Serif", size: ${document.style?.bodySizePt ?? 11}pt, fill: black, lang: "en")
#set par(justify: true, leading: ${Math.max(0, (document.style?.lineSpacing ?? 1.35) - 0.8)}em)
#set heading(numbering: none)
#set page(footer: context {
  let starts = query(<foundry-section>).filter(it => it.value.phase == "body")
  let physical = here().page()
  if starts.len() > 0 and physical >= starts.first().location().page() {
    align(center)[#numbering("1", physical - starts.first().location().page() + 1)]
  } else { align(center)[#numbering("i", physical - 1)] }
})
#page(header: none, footer: none)[#v(30%)#align(center)[${renderText(document.title)}\n\n${renderText(document.metadata.author ?? "")}]]
${pages}`;
}
