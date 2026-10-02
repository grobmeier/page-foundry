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

export function createTypstSource(
  document: FoundryDocument,
  preset: PdfPresetId,
  profile: PageProfileId,
): string {
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
  const from = document.metadata.from ?? document.metadata.author ?? "";
  const to = document.metadata.to ?? "";
  const date = document.metadata.date ?? "";
  const subject = document.metadata.subject ?? document.title;
  return [
    from ? `#align(right)[${renderText(from)}]` : "",
    date ? `#align(right)[${renderText(date)}]` : "",
    "#v(8mm)",
    to ? `${renderText(to)}\\` : "",
    "#v(6mm)",
    subject ? `#strong[${renderText(subject)}]` : "",
    "#v(5mm)",
  ]
    .filter(Boolean)
    .join("\n");
}

function renderLetterClosing(document: FoundryDocument): string {
  const closing = document.metadata.closing ?? "Yours sincerely,";
  const author = document.metadata.author ?? document.metadata.from ?? "";
  return `\n#v(8mm)\n${renderText(closing)}\n\n#v(8mm)\n${renderText(author)}`;
}

function renderBlock(block: BlockNode, document: FoundryDocument): string {
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
            `[${item.map((child) => renderBlock(child, document)).join("\n")}]`,
        )
        .join(",\n");
      return `#${functionName}(\n${items}\n)`;
    }
    case "thematic-break":
      return "#align(center)[* * *]";
    case "page-break":
      return "#pagebreak(weak: true)";
  }
}

function renderInline(nodes: InlineNode[], document: FoundryDocument): string {
  return nodes
    .map((node) => {
      switch (node.type) {
        case "text":
          return renderText(node.value);
        case "emphasis":
          return `#emph[${renderInline(node.children, document)}]`;
        case "strong":
          return `#strong[${renderInline(node.children, document)}]`;
        case "inline-code":
          return `#raw(${stringLiteral(node.value)})`;
        case "link":
          return safeExternalHref(node.url)
            ? `#link(${stringLiteral(node.url)})[${renderInline(node.children, document)}]`
            : renderInline(node.children, document);
        case "image": {
          const image = requireImage(document, node);
          const size = imageSize(
            image,
            node.width,
            Math.min(
              480,
              ((210 - 2 * (document.style?.marginXmm ?? 25) - 25) * 96) / 25.4,
            ),
            Math.min(
              600,
              ((279.4 - 2 * (document.style?.marginYmm ?? 24) - 25) * 96) /
                25.4,
            ),
          );
          return `#image("/assets/${image.id}.${image.extension}", width: ${size.width * 0.75}pt, height: ${size.height * 0.75}pt, fit: "contain", alt: ${stringLiteral(node.alt)})`;
        }
        case "break":
          return "\\";
      }
    })
    .join("");
}

function renderText(value: string): string {
  return `#text(${stringLiteral(value)})`;
}

function stringLiteral(value: string): string {
  return JSON.stringify(value)
    .replace(/\u2028/gu, "\\u{2028}")
    .replace(/\u2029/gu, "\\u{2029}");
}
