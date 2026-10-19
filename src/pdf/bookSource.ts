/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import type { BlockNode, FoundryDocument, PageProfileId } from "../core/model";
import { parseBookDesign } from "../books/design";
import {
  PRINT_TRIMS,
  validatePrintOptions,
  type PrintOptions,
} from "../print/model";
import { renderBlock, renderText } from "./typstSource";

/** Generate only validated data; no caller-supplied template source is executed. */
export function createBookSource(
  document: FoundryDocument,
  profile: PageProfileId,
  print?: PrintOptions,
  insideIn = 0.5,
): string {
  if (!document.book?.entries.length)
    throw new Error("This design needs an ordered book.");
  const design = parseBookDesign(document.bookDesign);
  if (print) {
    validatePrintOptions(print);
    if (!Number.isFinite(insideIn) || insideIn < 0.5 || insideIn > 0.875)
      throw new Error("Invalid print gutter.");
  }
  const style = document.style ?? {};
  // Typst's paragraph spacing replaces leading at a paragraph boundary.
  // Zero extra gap must retain the normal line separation, not replace it.
  const leadingEm = Math.max(0, (style.lineSpacing ?? 1.35) - 0.8);
  const snapshot = print
    ? {
        ...document,
        paperback: {
          ...PRINT_TRIMS[print.trim],
          insideIn,
          outsideIn: 0.5,
          verticalIn: 0.75,
        },
      }
    : document;
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
      throw new Error("The book is missing its opening section heading.");
    groups.at(-1)!.blocks.push(block);
  }
  const geometry = print
    ? `width: ${PRINT_TRIMS[print.trim].widthIn}in, height: ${PRINT_TRIMS[print.trim].heightIn}in, binding: left, margin: (inside: ${insideIn}in, outside: 0.5in, top: 0.75in, bottom: 0.75in)`
    : `paper: "${profile === "a4" ? "a4" : "us-letter"}", margin: (x: ${style.marginXmm ?? 25}mm, y: ${style.marginYmm ?? 24}mm)`;
  const align = design.titleAlign;
  const opening = [
    design.titlePage
      ? `#page(header: none, footer: none)[#v(${design.titleTopMm}mm)#align(${align})[#text(size: ${design.titleSizePt}pt, weight: "bold")[${renderText(document.title)}]\n\n${document.metadata.subtitle ? `#v(5mm)${renderText(document.metadata.subtitle)}\n\n` : ""}#v(8mm)${renderText(document.metadata.author ?? "")}#metadata(none) <foundry-front-end>]]`
      : "",
    design.imprintPage && document.metadata.imprint?.trim()
      ? `#page(header: none, footer: none)[#v(20mm)${document.metadata.imprint.split(/\r?\n/).map(renderText).join("\\\n")}#metadata(none) <foundry-front-end>]`
      : "",
    design.contents
      ? `#page(header: none, footer: none)[#text(size: 20pt, weight: "bold")[Contents]\n#v(8mm)\n#context {
      for item in query(<foundry-section>).filter(it => it.value.role != "scene") {
        let target = item.location()
        let entry = item.value
        block(width: 100%, above: 2mm, below: 2mm)[#link(target)[#box(width: 80%)[#text(entry.title)]#h(1fr)#foundry-number(target.page())]]
      }
    }#metadata(none) <foundry-front-end>]`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
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
            ? `#metadata((id: ${JSON.stringify(entry.id)}, role: ${JSON.stringify(entry.role)}, title: ${JSON.stringify(entry.title)}, phase: "${phase}")) <foundry-section>\n`
            : "";
          const label =
            block.type === "heading" && block.anchor
              ? `#label(${JSON.stringify(block.anchor)})`
              : "";
          const chapter = entry?.role === "chapter";
          const heading = chapter
            ? `#v(${design.chapterTopMm}mm)#align(${design.chapterAlign})[#heading(level: ${block.type === "heading" ? block.depth : 1}, outlined: false)[#text(size: ${design.chapterSizePt}pt)[${renderText(entry.title)}]]${label}${design.chapterRule ? `\n#v(3mm)#line(length: ${design.ruleWidthPercent}%, stroke: ${design.ruleWeightPt}pt)` : ""}]\n#v(8mm)`
            : renderBlock(block, snapshot) + label;
          return marker + heading;
        })
        .join("\n\n");
      const recto = print?.recto && ["part", "chapter"].includes(group.role);
      const last =
        index === groups.length - 1 && print
          ? `\n#context [#metadata((pages: here().page(), sections: query(<foundry-section>).map(it => (id: it.value.id, role: it.value.role, page: it.location().page())), blanks: foundry-blanks())) <foundry-proof>]`
          : "";
      return `#pagebreak(weak: true${recto ? ', to: "odd"' : ""})\n#metadata((index: ${index}, recto: ${Boolean(recto)})) <foundry-opening>\n${content}\n#metadata(${index}) <foundry-group-end>${last}`;
    })
    .join("\n\n");
  return `#set page(${geometry})
#set text(font: "Libertinus Serif", size: ${style.bodySizePt ?? 11}pt, fill: ${print ? "black" : `rgb(${JSON.stringify(style.color ?? "#000000")})`}, lang: "en")
#set par(justify: true, leading: ${leadingEm}em, first-line-indent: ${design.indentMm}mm, spacing: ${leadingEm}em + ${design.paragraphSpaceMm}mm)
#set heading(numbering: none)
#let foundry-blanks() = {
  let ends = query(<foundry-group-end>)
  let blanks = ()
  for start in query(<foundry-opening>).filter(it => it.value.recto) {
    let previous = if start.value.index > 0 { ends.at(start.value.index - 1).location().page() } else {
      let front = query(<foundry-front-end>)
      if front.len() > 0 { front.last().location().page() } else { 0 }
    }
    blanks += range(previous + 1, start.location().page())
  }
  blanks
}
#let foundry-number(physical) = {
  let starts = query(<foundry-section>).filter(it => it.value.phase == "body")
  if starts.len() > 0 and physical >= starts.first().location().page() {
    numbering("1", physical - starts.first().location().page() + 1)
  } else { numbering("i", calc.max(1, physical - ${design.titlePage ? 1 : 0})) }
}
#set page(header: context {
  let physical = here().page()
  let opening = query(<foundry-opening>).any(it => it.location().page() == physical)
  let chapters = query(<foundry-section>).filter(it => it.value.role == "chapter" and it.location().page() <= physical)
  if not opening and not foundry-blanks().contains(physical) ${design.header === "none" ? "and false" : ""} {
    align(center)[#text(size: 9pt)[${design.header === "book-title" ? renderText(document.title) : "#if chapters.len() > 0 { text(chapters.last().value.title) }"}]]
  }
}, footer: context {
  let physical = here().page()
  if not foundry-blanks().contains(physical) {
    align(${design.pageNumbers === "outside" ? "if calc.odd(physical) { right } else { left }" : "center"})[#foundry-number(physical)]
  }
})
${opening}
${pages}`;
}
