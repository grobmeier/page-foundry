/*
 * Copyright 2026 Christian Grobmeier
 * Licensed under the Apache License, Version 2.0.
 */

import { strToU8, zipSync, type Zippable } from "fflate";
import type {
  BlockNode,
  FoundryDocument,
  InlineNode,
  PublishedFile,
} from "../core/model";

export interface EpubOptions {
  language: string;
  identifier?: string;
  modified?: Date;
}

interface HeadingEntry {
  id: string;
  label: string;
}

export class EpubRenderer {
  render(document: FoundryDocument, options: EpubOptions): PublishedFile {
    const language = validateLanguage(
      options.language ||
        document.metadata.language ||
        document.metadata.lang ||
        "",
    );
    const identifier =
      document.metadata.identifier ?? options.identifier ?? createIdentifier();
    const modified = (options.modified ?? new Date())
      .toISOString()
      .replace(/\.\d{3}Z$/u, "Z");
    const headings: HeadingEntry[] = [];
    const content = renderBlocks(document.blocks, headings);

    const files: Zippable = {
      mimetype: [strToU8("application/epub+zip"), { level: 0 }],
      "META-INF/container.xml": strToU8(CONTAINER_XML),
      "EPUB/package.opf": strToU8(
        packageDocument(document, language, identifier, modified),
      ),
      "EPUB/nav.xhtml": strToU8(
        navigationDocument(document, language, headings),
      ),
      "EPUB/content.xhtml": strToU8(
        contentDocument(document, language, content),
      ),
      "EPUB/styles.css": strToU8(STYLES),
    };

    return {
      bytes: zipSync(files, { level: 6 }),
      extension: "epub",
      mediaType: "application/epub+zip",
    };
  }
}

const CONTAINER_XML = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="EPUB/package.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;

const STYLES = `body {
  font-family: serif;
  line-height: 1.5;
  margin: 5%;
}
.book-title { text-align: center; margin-block: 2em; }
blockquote { border-inline-start: 0.2em solid currentColor; margin-inline: 1em; padding-inline-start: 1em; }
pre, code { font-family: monospace; }
hr { border: 0; text-align: center; }
hr::after { content: "* * *"; }
`;

function packageDocument(
  document: FoundryDocument,
  language: string,
  identifier: string,
  modified: string,
): string {
  const creator = document.metadata.author ?? document.metadata.creator;
  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="publication-id" xml:lang="${escapeXml(language)}">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="publication-id">${escapeXml(identifier)}</dc:identifier>
    <dc:title>${escapeXml(document.title)}</dc:title>
    <dc:language>${escapeXml(language)}</dc:language>${creator ? `\n    <dc:creator>${escapeXml(creator)}</dc:creator>` : ""}
    <meta property="dcterms:modified">${modified}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="content" href="content.xhtml" media-type="application/xhtml+xml"/>
    <item id="styles" href="styles.css" media-type="text/css"/>
  </manifest>
  <spine>
    <itemref idref="content"/>
  </spine>
</package>`;
}

function navigationDocument(
  document: FoundryDocument,
  language: string,
  headings: HeadingEntry[],
): string {
  const items = headings.length
    ? headings
        .map(
          ({ id, label }) =>
            `      <li><a href="content.xhtml#${id}">${escapeXml(label)}</a></li>`,
        )
        .join("\n")
    : `      <li><a href="content.xhtml">${escapeXml(document.title)}</a></li>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${escapeXml(language)}" lang="${escapeXml(language)}">
  <head><title>Contents</title></head>
  <body>
    <nav epub:type="toc" id="toc">
      <h1>Contents</h1>
      <ol>
${items}
      </ol>
    </nav>
  </body>
</html>`;
}

function contentDocument(
  document: FoundryDocument,
  language: string,
  content: string,
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${escapeXml(language)}" lang="${escapeXml(language)}">
  <head>
    <title>${escapeXml(document.title)}</title>
    <link rel="stylesheet" type="text/css" href="styles.css"/>
  </head>
  <body>
    <h1 class="book-title">${escapeXml(document.title)}</h1>
${content}
  </body>
</html>`;
}

function renderBlocks(
  blocks: BlockNode[],
  headings: HeadingEntry[],
  indent = "    ",
): string {
  return blocks.map((block) => renderBlock(block, headings, indent)).join("\n");
}

function renderBlock(
  block: BlockNode,
  headings: HeadingEntry[],
  indent: string,
): string {
  switch (block.type) {
    case "heading": {
      const id = `heading-${headings.length + 1}`;
      headings.push({
        id,
        label: inlineText(block.children) || "Untitled section",
      });
      const depth = Math.min(block.depth + 1, 6);
      return `${indent}<h${depth} id="${id}">${renderInline(block.children)}</h${depth}>`;
    }
    case "paragraph":
      return `${indent}<p>${renderInline(block.children)}</p>`;
    case "blockquote":
      return `${indent}<blockquote>\n${renderBlocks(block.blocks, headings, `${indent}  `)}\n${indent}</blockquote>`;
    case "list": {
      const tag = block.ordered ? "ol" : "ul";
      const items = block.items
        .map(
          (item) =>
            `${indent}  <li>\n${renderBlocks(item, headings, `${indent}    `)}\n${indent}  </li>`,
        )
        .join("\n");
      return `${indent}<${tag}>\n${items}\n${indent}</${tag}>`;
    }
    case "thematic-break":
      return `${indent}<hr/>`;
  }
}

function renderInline(nodes: InlineNode[]): string {
  return nodes
    .map((node) => {
      switch (node.type) {
        case "text":
          return escapeXml(node.value);
        case "emphasis":
          return `<em>${renderInline(node.children)}</em>`;
        case "strong":
          return `<strong>${renderInline(node.children)}</strong>`;
        case "inline-code":
          return `<code>${escapeXml(node.value)}</code>`;
        case "link": {
          const href = safeHref(node.url);
          const label = renderInline(node.children);
          return href ? `<a href="${escapeXml(href)}">${label}</a>` : label;
        }
        case "break":
          return "<br/>";
      }
    })
    .join("");
}

function inlineText(nodes: InlineNode[]): string {
  return nodes
    .map((node) => {
      switch (node.type) {
        case "text":
        case "inline-code":
          return node.value;
        case "emphasis":
        case "strong":
        case "link":
          return inlineText(node.children);
        case "break":
          return " ";
      }
    })
    .join("")
    .trim();
}

function safeHref(value: string): string | undefined {
  if (value.startsWith("#")) return value;
  try {
    const url = new URL(value);
    return ["https:", "http:", "mailto:"].includes(url.protocol)
      ? value
      : undefined;
  } catch {
    return undefined;
  }
}

function validateLanguage(value: string): string {
  const language = value.trim();
  if (!/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/u.test(language)) {
    throw new Error(
      "Enter a publication language such as en, en-GB, or de before creating the EPUB.",
    );
  }
  return language;
}

function createIdentifier(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (!uuid) throw new Error("This device cannot generate an EPUB identifier.");
  return `urn:uuid:${uuid}`;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
