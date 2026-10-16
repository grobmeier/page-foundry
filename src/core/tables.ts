/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import type { Processor } from "unified";
import { gfmTable } from "micromark-extension-gfm-table";
import { gfmTableFromMarkdown } from "mdast-util-gfm-table";

/** Enable table syntax only, without silently accepting unimplemented GFM nodes. */
export function markdownTables(this: Processor): void {
  const data = this.data();
  (data.micromarkExtensions ??= []).push(gfmTable());
  (data.fromMarkdownExtensions ??= []).push(gfmTableFromMarkdown());
}
