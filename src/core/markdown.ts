/*
 * Copyright 2026 Christian Grobmeier
 * Licensed under the Apache License, Version 2.0.
 */

import type {
  BlockContent,
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
import { markdownTables } from "./tables";
import { isRecord } from "./validation";

const parser = unified()
  .use(remarkParse)
  .use(remarkFrontmatter, ["yaml"])
  .use(markdownTables)
  .use(wikiImages);
type Definitions = Map<string, { url: string }>;

export function parseMarkdown(
  source: string,
  fallbackTitle: string,
): FoundryDocument {
  const root = parser.parse(source);
  const definitions: Definitions = new Map();
  function collect(node: Root | RootContent): void {
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
  if (!isRecord(parsed)) return {};

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
          ...(node.ordered &&
          node.start !== null &&
          node.start !== undefined &&
          node.start !== 1
            ? { start: node.start }
            : {}),
          items: node.children.map((item) => toListItem(item, definitions)),
        },
      ];
    case "thematicBreak":
      return [{ type: "thematic-break" }];
    case "table": {
      const columns = node.children[0]?.children.length ?? 0;
      return [
        {
          type: "table",
          align: Array.from(
            { length: columns },
            (_, i) => node.align?.[i] ?? null,
          ),
          rows: node.children.map((row) =>
            Array.from(
              { length: Math.max(columns, row.children.length) },
              (_, i) =>
                toInlineList(row.children[i]?.children ?? [], definitions),
            ),
          ),
        },
      ];
    }
    case "code":
      return [
        {
          type: "code",
          value: node.value,
          ...(node.lang ? { language: node.lang } : {}),
        },
      ];
    case "html":
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

function toInline(node: RootContent, definitions: Definitions): InlineNode[] {
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
        const dimensions = alias && /^(\d+)(?:x(\d+))?$/iu.exec(alias);
        const width = dimensions ? Number(dimensions[1]) : undefined;
        const height = dimensions?.[2] ? Number(dimensions[2]) : undefined;
        return [
          {
            type: "image",
            url: extra !== undefined ? node.url : url!,
            alt: dimensions ? "" : (alias ?? ""),
            width,
            ...(height !== undefined ? { height } : {}),
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

function findWarnings(node: Root | RootContent): string[] {
  const warnings: string[] = [];
  if (node.type === "html")
    warnings.push(
      "HTML is printed as literal text, not rendered markup. Review its appearance in the generated document.",
    );
  if ("children" in node) warnings.push(...node.children.flatMap(findWarnings));
  return warnings;
}

function findUnsupported(node: Root | RootContent): string[] {
  if (node.type === "table") {
    const columns = node.children[0]?.children.length ?? 0;
    if (columns > 20 || node.children.length > 1001)
      return [
        "Tables support at most 20 columns and 1000 body rows. Split this table before exporting.",
      ];
    if (node.children.some((row) => row.children.length > columns))
      return [
        "A table row has more cells than its header. Escape literal pipes with \\| or add the missing column heading.",
      ];
  }
  if (node.type === "html" && /<img\b/iu.test(node.value))
    return [
      "HTML images are not supported. Use Markdown image syntax instead.",
    ];
  if ("children" in node)
    return node.children.flatMap((child) => findUnsupported(child));
  return [];
}
