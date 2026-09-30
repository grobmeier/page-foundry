/*
 * Copyright 2026 Christian Grobmeier
 * Licensed under the Apache License, Version 2.0.
 */

export type PageProfileId = "a4" | "us-letter";
export type PresetId = "plain-document" | "letter";

export type InlineNode =
  | { type: "text"; value: string }
  | { type: "emphasis"; children: InlineNode[] }
  | { type: "strong"; children: InlineNode[] }
  | { type: "inline-code"; value: string }
  | { type: "link"; url: string; children: InlineNode[] }
  | { type: "break" };

export type BlockNode =
  | { type: "heading"; depth: number; children: InlineNode[] }
  | { type: "paragraph"; children: InlineNode[] }
  | { type: "blockquote"; blocks: BlockNode[] }
  | { type: "list"; ordered: boolean; items: BlockNode[][] }
  | { type: "thematic-break" };

export interface FoundryDocument {
  title: string;
  metadata: Record<string, string>;
  blocks: BlockNode[];
}

export interface PublishRequest {
  preset: PresetId;
  profile: PageProfileId;
  outputName: string;
}
