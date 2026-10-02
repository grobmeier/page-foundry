/*
 * Copyright 2026 Christian Grobmeier
 * Licensed under the Apache License, Version 2.0.
 */

import type {
  BlockContent,
  Content,
  ListItem,
  PhrasingContent,
  Root,
  RootContent,
} from "mdast";
import remarkFrontmatter from "remark-frontmatter";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { parse as parseYaml } from "yaml";
import type { BlockNode, FoundryDocument, InlineNode } from "./model";
import { wikiImages } from "./wikiImages";

const parser = unified()
  .use(remarkParse)
  .use(remarkFrontmatter, ["yaml"])
  .use(wikiImages);
type Definitions = Map<string, { url: string }>;

export function parseMarkdown(
  source: string,
  fallbackTitle: string,
): FoundryDocument {
  const root = parser.parse(source) as Root;
  const definitions: Definitions = new Map();
  function collect(node: Root | Content): void {
    if (
      node.type === "definition" &&
      !definitions.has(node.identifier.toUpperCase())
    )
      definitions.set(node.identifier.toUpperCase(), node);
    if ("children" in node) node.children.forEach(collect);
  }
  collect(root);
  const metadata = readMetadata(root);
  return {
    title: metadata.title ?? fallbackTitle,
    metadata,
    blocks: root.children.flatMap((node) => toBlock(node, definitions)),
    resourceErrors: findUnsupported(root),
    sourceWarnings: [...new Set(findWarnings(root))],
  };
}

function readMetadata(root: Root): Record<string, string> {
  const yamlNode = root.children.find((child) => child.type === "yaml");
  if (
    !yamlNode ||
    !("value" in yamlNode) ||
    typeof yamlNode.value !== "string"
  ) {
    return {};
  }

  const parsed: unknown = parseYaml(yamlNode.value, { maxAliasCount: 20 });
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

  return Object.fromEntries(
    Object.entries(parsed)
      .filter((entry): entry is [string, string | number | boolean | Date] => {
        const value = entry[1];
        return (
          typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "boolean" ||
          value instanceof Date
        );
      })
      .map(([key, value]) => [
        key,
        value instanceof Date ? value.toISOString() : String(value),
      ]),
  );
}

function toBlock(
  node: RootContent | BlockContent,
  definitions: Definitions,
): BlockNode[] {
  switch (node.type) {
    case "heading":
      return [
        {
          type: "heading",
          depth: node.depth,
          children: toInlineList(node.children, definitions),
        },
      ];
    case "paragraph":
      return [
        {
          type: "paragraph",
          children: toInlineList(node.children, definitions),
        },
      ];
    case "blockquote":
      return [
        {
          type: "blockquote",
          blocks: node.children.flatMap((child) => toBlock(child, definitions)),
        },
      ];
    case "list":
      return [
        {
          type: "list",
          ordered: Boolean(node.ordered),
          items: node.children.map((item) => toListItem(item, definitions)),
        },
      ];
    case "thematicBreak":
      return [{ type: "thematic-break" }];
    case "html":
    case "code":
      return [
        { type: "paragraph", children: [{ type: "text", value: node.value }] },
      ];
    default:
      return [];
  }
}

function toListItem(item: ListItem, definitions: Definitions): BlockNode[] {
  return item.children.flatMap((node) => toBlock(node, definitions));
}

function toInlineList(
  nodes: PhrasingContent[],
  definitions: Definitions,
): InlineNode[] {
  return nodes.flatMap((node) => toInline(node, definitions));
}

function toInline(node: Content, definitions: Definitions): InlineNode[] {
  switch (node.type) {
    case "text":
      return [{ type: "text", value: node.value }];
    case "emphasis":
      return [
        {
          type: "emphasis",
          children: toInlineList(node.children, definitions),
        },
      ];
    case "strong":
      return [
        { type: "strong", children: toInlineList(node.children, definitions) },
      ];
    case "inlineCode":
      return [{ type: "inline-code", value: node.value }];
    case "link":
      return [
        {
          type: "link",
          url: node.url,
          children: toInlineList(node.children, definitions),
        },
      ];
    case "break":
      return [{ type: "break" }];
    case "image":
      if (node.data?.foundryEmbed) {
        const [url, alias, extra] = node.url.split("|");
        const width = alias && /^\d+$/u.test(alias) ? Number(alias) : undefined;
        return [
          {
            type: "image",
            url: extra !== undefined ? node.url : url!,
            alt: width ? "" : (alias ?? ""),
            width,
          },
        ];
      }
      return [{ type: "image", url: node.url, alt: node.alt ?? "" }];
    case "imageReference": {
      const definition = definitions.get(node.identifier.toUpperCase());
      return [
        { type: "image", url: definition?.url ?? "", alt: node.alt ?? "" },
      ];
    }
    case "linkReference": {
      const definition = definitions.get(node.identifier.toUpperCase());
      const children = toInlineList(node.children, definitions);
      return definition
        ? [{ type: "link", url: definition.url, children }]
        : children;
    }
    case "html":
      return [{ type: "text", value: node.value }];
    default:
      return [];
  }
}

function findWarnings(node: Root | Content): string[] {
  const warnings: string[] = [];
  if (node.type === "html")
    warnings.push(
      "HTML is printed as literal text, not rendered markup. Review its appearance in the generated document.",
    );
  if (node.type === "code")
    warnings.push(
      "Code blocks are printed as ordinary text; their original block formatting is not preserved.",
    );
  if ("children" in node) warnings.push(...node.children.flatMap(findWarnings));
  return warnings;
}

function findUnsupported(node: Root | Content): string[] {
  if (node.type === "html" && /<img\b/iu.test(node.value))
    return [
      "HTML images are not supported. Use Markdown image syntax instead.",
    ];
  if ("children" in node)
    return node.children.flatMap((child) => findUnsupported(child));
  return [];
}
