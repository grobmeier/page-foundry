/*
 * Copyright 2026 Christian Grobmeier
 * Licensed under the Apache License, Version 2.0.
 */

import type {
  BlockNode,
  FoundryDocument,
  InlineNode,
  PageProfileId,
  PresetId,
} from "../core/model";

export function createTypstSource(
  document: FoundryDocument,
  preset: PresetId,
  profile: PageProfileId,
): string {
  const paper = profile === "a4" ? "a4" : "us-letter";
  const body = document.blocks.map(renderBlock).join("\n\n");
  const opening =
    preset === "letter" ? renderLetterOpening(document) : renderTitle(document);
  const closing = preset === "letter" ? renderLetterClosing(document) : "";

  return `#set page(paper: "${paper}", margin: (x: 25mm, y: 24mm))
#set text(font: "Libertinus Serif", size: 11pt, lang: "en")
#set par(leading: 0.72em, justify: true)
#set heading(numbering: none)

${opening}
${body}
${closing}`;
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

function renderBlock(block: BlockNode): string {
  switch (block.type) {
    case "heading":
      return `#heading(level: ${Math.min(block.depth, 6)})[${renderInline(block.children)}]`;
    case "paragraph":
      return renderInline(block.children);
    case "blockquote":
      return `#quote(block: true)[${block.blocks.map(renderBlock).join("\n\n")}]`;
    case "list": {
      const functionName = block.ordered ? "enum" : "list";
      const items = block.items
        .map((item) => `[${item.map(renderBlock).join("\n")}]`)
        .join(",\n");
      return `#${functionName}(\n${items}\n)`;
    }
    case "thematic-break":
      return "#align(center)[* * *]";
  }
}

function renderInline(nodes: InlineNode[]): string {
  return nodes
    .map((node) => {
      switch (node.type) {
        case "text":
          return renderText(node.value);
        case "emphasis":
          return `#emph[${renderInline(node.children)}]`;
        case "strong":
          return `#strong[${renderInline(node.children)}]`;
        case "inline-code":
          return `#raw(${stringLiteral(node.value)})`;
        case "link":
          return `#link(${stringLiteral(node.url)})[${renderInline(node.children)}]`;
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
