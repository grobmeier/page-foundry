/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import type { BlockNode, FoundryDocument, InlineNode } from "./model";

export function inlineText(nodes: InlineNode[]): string {
  return nodes
    .map((node) =>
      "children" in node
        ? inlineText(node.children)
        : node.type === "break"
          ? " "
          : node.type === "image"
            ? node.alt
            : node.value,
    )
    .join("")
    .trim();
}

export interface HeadingEntry {
  id: string;
  label: string;
  depth: number;
}
export interface HeadingIndex {
  entries: HeadingEntry[];
  byBlock: Map<BlockNode, HeadingEntry>;
}

export function headingIndex(document: FoundryDocument): HeadingIndex {
  const entries: HeadingEntry[] = [];
  const byBlock = new Map<BlockNode, HeadingEntry>();
  function visit(blocks: BlockNode[]): void {
    for (const block of blocks) {
      if (block.type === "heading") {
        const entry = {
          id: block.anchor ?? `heading-${entries.length + 1}`,
          label: inlineText(block.children) || "Untitled section",
          depth: block.depth,
        };
        entries.push(entry);
        byBlock.set(block, entry);
      } else if (block.type === "blockquote") visit(block.blocks);
      else if (block.type === "list") block.items.forEach(visit);
    }
  }
  visit(document.blocks);
  return { entries, byBlock };
}

function normalise(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\s+/gu, "-")
    .replace(/[^\p{L}\p{N}_-]/gu, "");
}

export function resolveFragment(
  index: HeadingIndex,
  url: string,
): { id?: string; error?: string } {
  let target: string;
  try {
    target = decodeURIComponent(url.slice(1));
  } catch {
    return { error: "The heading link has invalid URL escaping." };
  }
  if (target.startsWith("^"))
    return {
      error:
        "Obsidian block-reference links are not EPUB heading destinations. Link to a section heading instead.",
    };
  const explicit = index.entries.find((entry) => entry.id === target);
  if (explicit) return { id: explicit.id };
  const key = normalise(target);
  const matches = key
    ? index.entries.filter((entry) => normalise(entry.label) === key)
    : [];
  if (matches.length === 1) return { id: matches[0]!.id };
  return {
    error: matches.length
      ? `Heading link ${url} is ambiguous. Use an explicit ID such as #${matches[0]!.id}.`
      : `Heading link ${url} has no destination in this note.`,
  };
}

export function safeExternalHref(value: string): string | undefined {
  try {
    return ["https:", "http:", "mailto:"].includes(new URL(value).protocol)
      ? value
      : undefined;
  } catch {
    return undefined;
  }
}
