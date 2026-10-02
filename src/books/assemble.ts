/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import type { BlockNode, FoundryDocument, InlineNode } from "../core/model";
import {
  headingIndex,
  inlineText,
  resolveFragment,
  safeExternalHref,
} from "../core/headings";
import type { BookManifest } from "./manifest";

export function assembleBook(
  manifest: BookManifest,
  sources: Map<string, FoundryDocument>,
): FoundryDocument {
  const result: FoundryDocument = {
    title: manifest.metadata.title!,
    metadata: { ...manifest.metadata },
    blocks: [],
    images: {},
    resourceErrors: [],
    sourceWarnings: [],
    book: { entries: [] },
  };
  const targets = new Map<
    string,
    {
      anchor: string;
      index: ReturnType<typeof headingIndex>;
      anchors: Map<string, string>;
    }
  >();
  for (const entry of manifest.entries) {
    if (!entry.path) continue;
    const source = sources.get(entry.path);
    if (!source) throw new Error(`Missing included note: ${entry.path}.`);
    const title = entry.title ?? source.title;
    const index = headingIndex(source);
    const anchors = new Map(
      index.entries.map((h) => [h.id, `entry-heading-${entry.id}-${h.id}`]),
    );
    const first = source.blocks[0];
    if (
      first?.type === "heading" &&
      first.depth === 1 &&
      inlineText(first.children).toLowerCase() === title.toLowerCase()
    )
      anchors.set(index.byBlock.get(first)!.id, `book-${entry.id}`);
    targets.set(entry.path, { anchor: `book-${entry.id}`, index, anchors });
  }
  const assetIds = new Map<string, string>();
  let part = false;
  let chapterDepth = 1;
  for (const entry of manifest.entries) {
    const source = entry.path ? sources.get(entry.path)! : undefined;
    const title = entry.title ?? source?.title ?? "Untitled part";
    const depth =
      entry.role === "chapter"
        ? part
          ? 2
          : 1
        : entry.role === "scene"
          ? Math.min(6, chapterDepth + 1)
          : 1;
    if (entry.role === "part") part = true;
    if (entry.role === "front-matter" || entry.role === "back-matter")
      part = false;
    if (entry.role === "chapter") chapterDepth = depth;
    if (result.blocks.length && entry.role !== "scene")
      result.blocks.push({ type: "page-break" });
    result.blocks.push({
      type: "heading",
      depth,
      anchor: `book-${entry.id}`,
      children: [{ type: "text", value: title }],
    });
    result.book!.entries.push({ ...entry, title });
    if (!source || !entry.path) continue;
    const target = targets.get(entry.path)!;
    const imageIds = new Map<string, string>();
    for (const image of Object.values(source.images ?? {})) {
      let id = assetIds.get(image.path);
      if (!id) {
        id = `book-image-${assetIds.size + 1}`;
        assetIds.set(image.path, id);
        result.images![id] = { ...image, id };
      }
      imageIds.set(image.id, id);
    }
    result.resourceErrors!.push(
      ...(source.resourceErrors ?? []).map(
        (error) => `${entry.path}: ${error}`,
      ),
    );
    result.sourceWarnings!.push(
      ...(source.sourceWarnings ?? []).map(
        (warning) => `${entry.path}: ${warning}`,
      ),
    );
    function inlines(nodes: InlineNode[]): InlineNode[] {
      return nodes.map((node): InlineNode => {
        if (node.type === "image")
          return {
            ...node,
            resourceId: node.resourceId
              ? imageIds.get(node.resourceId)
              : undefined,
          };
        if (!("children" in node)) return { ...node };
        const copy = { ...node, children: inlines(node.children) };
        if (copy.type !== "link" || safeExternalHref(copy.url)) return copy;
        let destination = target;
        let fragment = copy.url;
        if (
          fragment.startsWith("#book-") &&
          manifest.entries.some((listed) => fragment === `#book-${listed.id}`)
        )
          return copy;
        if (!fragment.startsWith("#")) {
          const hash = fragment.indexOf("#");
          let path: string;
          try {
            path = decodeURIComponent(
              hash < 0 ? fragment : fragment.slice(0, hash),
            );
          } catch {
            return { ...copy, destinationError: "Invalid note-link escaping." };
          }
          if (/[\\:\u0000-\u001f]/.test(path) || path.startsWith("/"))
            return copy;
          const directory = entry.path!.split("/").slice(0, -1);
          const segments = [...directory];
          let escaped = false;
          for (const segment of path.split("/")) {
            if (segment === "..") {
              if (!segments.length) escaped = true;
              else segments.pop();
            } else if (segment && segment !== ".") segments.push(segment);
          }
          const candidates = new Set(
            [path, segments.join("/")]
              .flatMap((candidate) =>
                candidate.endsWith(".md")
                  ? [candidate]
                  : [candidate, `${candidate}.md`],
              )
              .filter((candidate) => targets.has(candidate)),
          );
          if (escaped || !candidates.size) return copy;
          if (candidates.size > 1)
            return {
              ...copy,
              destinationError: "Ambiguous included-note link.",
            };
          destination = targets.get([...candidates][0]!)!;
          fragment = hash < 0 ? "" : fragment.slice(hash);
        }
        if (!fragment) return { ...copy, url: `#${destination.anchor}` };
        const resolved = resolveFragment(destination.index, fragment);
        return resolved.error
          ? { ...copy, destinationError: `${entry.path}: ${resolved.error}` }
          : { ...copy, url: `#${destination.anchors.get(resolved.id!)}` };
      });
    }
    function blocks(nodes: BlockNode[]): BlockNode[] {
      return nodes.map((block): BlockNode => {
        if (block.type === "heading")
          return {
            ...block,
            depth: Math.min(6, depth + block.depth - (omit ? 1 : 0)),
            anchor: target.anchors.get(target.index.byBlock.get(block)!.id),
            children: inlines(block.children),
          };
        if ("children" in block)
          return { ...block, children: inlines(block.children) };
        if (block.type === "blockquote")
          return { ...block, blocks: blocks(block.blocks) };
        if (block.type === "list")
          return { ...block, items: block.items.map(blocks) };
        return { ...block };
      });
    }
    const first = source.blocks[0];
    const omit =
      first?.type === "heading" &&
      target.anchors.get(target.index.byBlock.get(first)!.id) === target.anchor;
    const content = omit ? source.blocks.slice(1) : source.blocks;
    if (!content.length && entry.role !== "part")
      result.resourceErrors!.push(
        `${entry.path}: The included note has no body content.`,
      );
    result.blocks.push(...blocks(content));
  }
  return result;
}
