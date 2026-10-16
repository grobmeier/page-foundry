/*
 * Copyright 2026 Christian Grobmeier
 * Licensed under the Apache License, Version 2.0.
 */

import type {
  BlockNode,
  FoundryDocument,
  InlineNode,
  PageProfileId,
  PdfPresetId,
} from "../core/model";
import { imageSize, requireImage } from "../core/images";
import { safeExternalHref } from "../core/headings";
import { createBookSource } from "./bookSource";

export function createTypstSource(
  document: FoundryDocument,
  preset: PdfPresetId,
  profile: PageProfileId,
): string {
  if (document.bookDesign) {
    if (preset !== "plain-document")
      throw new Error("Book designs require a Book PDF recipe.");
    return createBookSource(document, profile);
  }
  const paper = profile === "a4" ? "a4" : "us-letter";
  const style = document.style ?? {};
  const manuscript = preset === "manuscript";
  const size = style.bodySizePt ?? (manuscript ? 12 : 11);
  const body = document.blocks
    .map((block) => renderBlock(block, document))
    .join("\n\n");
  const opening =
    preset === "letter"
      ? renderLetterOpening(document)
      : manuscript
        ? renderManuscriptOpening(document)
        : document.book
          ? `#page(header: none, footer: none)[#v(30%)#align(center)[${renderText(document.title)}\n\n${renderText(document.metadata.author ?? "")}]]\n#counter(page).update(1)`
          : renderTitle(document);
  const closing = preset === "letter" ? renderLetterClosing(document) : "";

  return `#set page(paper: "${paper}", margin: (x: ${style.marginXmm ?? (manuscript ? 25.4 : 25)}mm, y: ${style.marginYmm ?? (manuscript ? 25.4 : 24)}mm))
#set text(font: "Libertinus Serif", size: ${size}pt, fill: rgb(${stringLiteral(style.color ?? "#000000")}), lang: "en")
#set par(leading: ${style.lineSpacing !== undefined ? Math.max(0, style.lineSpacing - 0.8) : manuscript ? 1.2 : 0.72}em, justify: ${!manuscript}${manuscript ? ", first-line-indent: 12.7mm" : ""})
#set heading(numbering: none)

${opening}
${body}
${closing}`;
}

function renderManuscriptOpening(document: FoundryDocument): string {
  const surname =
    document.metadata.surname ||
    document.metadata.author?.trim().split(/\s+/u).at(-1);
  const label = [surname, document.metadata["short-title"] || document.title]
    .filter(Boolean)
    .join(" / ");
  return `#page(header: none, footer: none)[#v(30%)#align(center)[${renderText(document.title)}\n\n${renderText(document.metadata.author ?? "")}]]
#counter(page).update(1)
#set page(header: context align(right)[${renderText(`${label} / `)}#counter(page).display()])`;
}

function renderTitle(document: FoundryDocument): string {
  if (!document.metadata.title) return "";
  return `#align(center)[#text(size: 18pt, weight: "semibold")[${renderText(document.title)}]]\n#v(10mm)`;
}

function renderLetterOpening(document: FoundryDocument): string {
  const from =
    [document.metadata["sender-name"], document.metadata["sender-address"]]
      .filter(Boolean)
      .join("\n") ||
    document.metadata.from ||
    document.metadata.author ||
    "";
  const to =
    [
      document.metadata["recipient-name"],
      document.metadata["recipient-address"],
    ]
      .filter(Boolean)
      .join("\n") ||
    document.metadata.to ||
    "";
  const date = document.metadata.date ?? "";
  const typed = ["letter", "submission-letter"].includes(
    document.metadata.document ?? "",
  );
  const subject = document.metadata.subject ?? (typed ? "" : document.title);
  const addressBlock = (value: string) =>
    value.split(/\r?\n/).map(renderText).join("\\\n");
  return [
    from ? `#align(right)[${addressBlock(from)}]` : "",
    date ? `#align(right)[${renderText(date)}]` : "",
    "#v(8mm)",
    to ? `${addressBlock(to)}\\` : "",
    "#v(6mm)",
    subject ? `#strong[${renderText(subject)}]` : "",
    "#v(5mm)",
    document.metadata.salutation
      ? `${renderText(document.metadata.salutation)}\n#v(3mm)`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function renderLetterClosing(document: FoundryDocument): string {
  if (
    ["letter", "submission-letter"].includes(
      document.metadata.document ?? "",
    ) &&
    !Object.hasOwn(document.metadata, "closing") &&
    !Object.hasOwn(document.metadata, "salutation") &&
    !document.metadata.from &&
    !document.metadata.to
  )
    return "";
  const closing = document.metadata.closing ?? "Yours sincerely,";
  const author = document.metadata.author ?? document.metadata.from ?? "";
  return `\n#v(8mm)\n${renderText(closing)}\n\n#v(8mm)\n${renderText(author)}`;
}

export function renderBlock(
  block: BlockNode,
  document: FoundryDocument,
): string {
  switch (block.type) {
    case "heading":
      return `#heading(level: ${Math.min(block.depth, 6)})[${renderInline(block.children, document)}]`;
    case "paragraph":
      return renderInline(block.children, document);
    case "blockquote":
      return `#quote(block: true)[${block.blocks.map((child) => renderBlock(child, document)).join("\n\n")}]`;
    case "list": {
      const functionName = block.ordered ? "enum" : "list";
      const items = block.items
        .map(
          (item) =>
            `[${item.map((child) => renderBlock(child, document)).join("\n\n")}]`,
        )
        .join(",\n");
      return `#${functionName}(${block.ordered ? `start: ${block.start ?? 1},` : ""}\n${items}\n)`;
    }
    case "table":
      return renderTable(block, document);
    case "code":
      // No user-supplied language, code or filenames are evaluated by Typst.
      return `#block(width: 100%, breakable: true, inset: 8pt, fill: luma(96%))[#set par(first-line-indent: 0pt, justify: false)\n${renderCode(block.value)}]`;
    case "thematic-break":
      return "#align(center)[* * *]";
    case "page-break":
      return "#pagebreak(weak: true)";
  }
}

function renderTable(
  table: Extract<BlockNode, { type: "table" }>,
  document: FoundryDocument,
): string {
  const columns = table.align.length;
  const cell = (nodes: InlineNode[], header = false, align = "left") =>
    `table.cell(breakable: true, align: ${align}, ${header ? "fill: luma(94%), " : ""})[${header ? "#strong[" : ""}${renderInline(nodes, document, true)}${header ? "]" : ""}]`;
  const regular = `table(columns: (${Array(columns).fill("1fr").join(",")},), inset: 6pt, stroke: 0.4pt + luma(70%),\n table.header(repeat: true, ${table.rows[0]!.map((nodes, i) => cell(nodes, true, table.align[i] ?? "left")).join(",")}),\n${table.rows
    .slice(1)
    .flatMap((row) =>
      row.map((nodes, i) => cell(nodes, false, table.align[i] ?? "left")),
    )
    .join(",\n")})`;
  // Keep every value readable rather than shrinking many columns to tiny type.
  // A layout callback also works in quotes/lists and with custom print margins.
  const stacked =
    table.rows
      .slice(1)
      .map(
        (row, rowIndex) =>
          `table(columns: (1fr, 2fr), inset: 6pt, stroke: 0.4pt + luma(70%), table.header(repeat: true, table.cell(colspan: 2, fill: luma(94%))[#strong[${renderText(`Row ${rowIndex + 1}`)}]]), ${row.flatMap((nodes, i) => [cell(table.rows[0]![i]!, true), cell(nodes)]).join(",")})`,
      )
      .join("; v(8pt); ") ||
    `table(columns: (1fr,), inset: 6pt, stroke: 0.4pt + luma(70%), ${table.rows[0]!.map((nodes) => cell(nodes, true)).join(",")})`;
  return `#block(width: 100%, breakable: true)[#set par(first-line-indent: 0pt, justify: false, leading: 0.5em)\n#layout(size => { if ${columns} > 6 or size.width / ${columns} < 60pt { ${stacked} } else { ${regular} } })]`;
}

/** Invisible break opportunities for long identifiers/URLs, not source edits. */
function wrapLongTokens(value: string): string {
  const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
  return value.replace(/\S{17,}/gu, (word) => {
    const chars = [...segmenter.segment(word)].map((part) => part.segment);
    return chars
      .map((char, i) => (i && i % 8 === 0 ? `\u200b${char}` : char))
      .join("");
  });
}

function renderCode(value: string): string {
  // Literal text rather than raw's intrinsic-width layout: long lines wrap
  // inside narrow cells/pages. Non-breaking spaces preserve code indentation.
  const lines = value
    .split("\n")
    .map((line) => {
      const expanded = line.replace(/\t/gu, "  ");
      return renderText(
        wrapLongTokens(expanded).replace(/ /gu, "\u00a0\u200b"),
      );
    })
    .join("#linebreak()\n");
  return `#[#set text(font: "DejaVu Sans Mono", size: 0.8em, hyphenate: false, overhang: false, ligatures: false)\n#set smartquote(enabled: false)\n${lines}]`;
}

function renderInline(
  nodes: InlineNode[],
  document: FoundryDocument,
  inCell = false,
): string {
  return nodes
    .map((node) => {
      switch (node.type) {
        case "text":
          return renderText(inCell ? wrapLongTokens(node.value) : node.value);
        case "emphasis":
          return `#emph[${renderInline(node.children, document, inCell)}]`;
        case "strong":
          return `#strong[${renderInline(node.children, document, inCell)}]`;
        case "inline-code":
          return renderCode(node.value);
        case "link":
          return safeExternalHref(node.url)
            ? `#link(${stringLiteral(node.url)})[${renderInline(node.children, document, inCell)}]`
            : renderInline(node.children, document, inCell);
        case "image": {
          const image = requireImage(document, node);
          const size = imageSize(
            image,
            node.width,
            Math.min(
              480,
              (((document.paperback
                ? (document.paperback.widthIn -
                    document.paperback.insideIn -
                    document.paperback.outsideIn) *
                  25.4
                : 210 - 2 * (document.style?.marginXmm ?? 25)) -
                25) *
                96) /
                25.4,
            ),
            Math.min(
              600,
              (((document.paperback
                ? (document.paperback.heightIn -
                    2 * document.paperback.verticalIn) *
                  25.4
                : 279.4 - 2 * (document.style?.marginYmm ?? 24)) -
                25) *
                96) /
                25.4,
            ),
            node.height,
          );
          const width = size.width * 0.75;
          const height = size.height * 0.75;
          return `#layout(size => { let scale = calc.min(1, size.width / ${width}pt); image("/assets/${image.id}.${image.extension}", width: ${width}pt * scale, height: ${height}pt * scale, fit: "contain", alt: ${stringLiteral(node.alt)}) })`;
        }
        case "break":
          return "\\";
      }
    })
    .join("");
}

export function renderText(value: string): string {
  return `#text(${stringLiteral(value)})`;
}

function stringLiteral(value: string): string {
  return JSON.stringify(value)
    .replace(/\u2028/gu, "\\u{2028}")
    .replace(/\u2029/gu, "\\u{2029}");
}
