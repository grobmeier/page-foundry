/*
 * Copyright 2026 Christian Grobmeier
 * Licensed under the Apache License, Version 2.0.
 */

export type PageProfileId = "a4" | "us-letter";
export type OutputFormat = "pdf" | "epub" | "docx";
export type PdfPresetId = "plain-document" | "letter" | "manuscript";
export type EpubPresetId = "reflowable-ebook";
export type DocxPresetId = "plain-editable" | "general-manuscript";
export type PresetId = string;

export type InlineNode =
  | { type: "text"; value: string }
  | { type: "emphasis"; children: InlineNode[] }
  | { type: "strong"; children: InlineNode[] }
  | { type: "inline-code"; value: string }
  | {
      type: "link";
      url: string;
      children: InlineNode[];
      destinationError?: string;
    }
  | {
      type: "image";
      url: string;
      alt: string;
      width?: number;
      resourceId?: string;
    }
  | { type: "break" };

export type BlockNode =
  | { type: "heading"; depth: number; children: InlineNode[]; anchor?: string }
  | { type: "paragraph"; children: InlineNode[] }
  | { type: "blockquote"; blocks: BlockNode[] }
  | { type: "list"; ordered: boolean; items: BlockNode[][] }
  | { type: "thematic-break" }
  | { type: "page-break" };

export interface FoundryDocument {
  title: string;
  metadata: Record<string, string>;
  blocks: BlockNode[];
  images?: Record<string, ImageAsset>;
  resourceErrors?: string[];
  sourceWarnings?: string[];
  style?: RenderStyle;
  book?: {
    entries: { id: string; role: string; title: string; path?: string }[];
  };
}

export interface RenderStyle {
  bodySizePt?: number;
  marginXmm?: number;
  marginYmm?: number;
  lineSpacing?: number;
  color?: string;
  font?: string;
}

export interface ImageAsset {
  id: string;
  path: string;
  bytes: Uint8Array;
  mediaType: "image/png" | "image/jpeg";
  extension: "png" | "jpg";
  width: number;
  height: number;
}

export interface PublishRequest {
  format: OutputFormat;
  preset: PresetId;
  profile: PageProfileId;
  outputName: string;
  language: string;
}

export interface PublishedFile {
  bytes: Uint8Array;
  extension: OutputFormat;
  mediaType: string;
}

export function defaultPreset(format: OutputFormat): PresetId {
  switch (format) {
    case "pdf":
      return "plain-document";
    case "epub":
      return "reflowable-ebook";
    case "docx":
      return "plain-editable";
  }
}
