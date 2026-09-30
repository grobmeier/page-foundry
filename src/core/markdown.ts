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

const parser = unified().use(remarkParse).use(remarkFrontmatter, ["yaml"]);

export function parseMarkdown(
  source: string,
  fallbackTitle: string,
): FoundryDocument {
  const root = parser.parse(source) as Root;
  const metadata = readMetadata(root);
  return {
    title: metadata.title ?? fallbackTitle,
    metadata,
    blocks: root.children.flatMap(toBlock),
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

function toBlock(node: RootContent | BlockContent): BlockNode[] {
  switch (node.type) {
    case "heading":
      return [
        {
          type: "heading",
          depth: node.depth,
          children: toInlineList(node.children),
        },
      ];
    case "paragraph":
      return [{ type: "paragraph", children: toInlineList(node.children) }];
    case "blockquote":
      return [{ type: "blockquote", blocks: node.children.flatMap(toBlock) }];
    case "list":
      return [
        {
          type: "list",
          ordered: Boolean(node.ordered),
          items: node.children.map(toListItem),
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

function toListItem(item: ListItem): BlockNode[] {
  return item.children.flatMap(toBlock);
}

function toInlineList(nodes: PhrasingContent[]): InlineNode[] {
  return nodes.flatMap(toInline);
}

function toInline(node: Content): InlineNode[] {
  switch (node.type) {
    case "text":
      return [{ type: "text", value: node.value }];
    case "emphasis":
      return [{ type: "emphasis", children: toInlineList(node.children) }];
    case "strong":
      return [{ type: "strong", children: toInlineList(node.children) }];
    case "inlineCode":
      return [{ type: "inline-code", value: node.value }];
    case "link":
      return [
        { type: "link", url: node.url, children: toInlineList(node.children) },
      ];
    case "break":
      return [{ type: "break" }];
    case "image":
      return [{ type: "text", value: node.alt ? `[${node.alt}]` : "[Image]" }];
    default:
      return [];
  }
}
