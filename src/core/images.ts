/*
 * Copyright 2026 Christian Grobmeier
 * Licensed under the Apache License, Version 2.0.
 */

import type {
  BlockNode,
  FoundryDocument,
  ImageAsset,
  InlineNode,
} from "./model";

import { hasControlCharacters } from "./validation";

export const IMAGE_LIMITS = {
  fileBytes: 5 * 1024 * 1024,
  totalBytes: 20 * 1024 * 1024,
  count: 50,
  pixels: 20_000_000,
};
export interface ImageHost {
  resolve(
    path: string,
  ): { path: string; size: number; read(): Promise<Uint8Array> } | undefined;
  decode(bytes: Uint8Array, mediaType: string): Promise<void>;
}
export interface ImageReview {
  document: FoundryDocument;
  errors: string[];
  warnings: string[];
  signature: string;
}

export function localImagePath(value: string): string {
  let path: string;
  try {
    path = decodeURIComponent(value.trim());
  } catch {
    throw new Error("The image path has invalid URL escaping.");
  }
  if (
    !path ||
    /^[a-z][a-z\d+.-]*:/iu.test(path) ||
    path.startsWith("/") ||
    /[\\|?#%]/u.test(path) ||
    hasControlCharacters(path) ||
    path.split("/").some((part) => part === "..")
  ) {
    throw new Error(
      "Use an image path inside this vault, without remote URLs or parent traversal.",
    );
  }
  path = path
    .split("/")
    .filter((part) => part && part !== ".")
    .join("/");
  if (!/\.(png|jpe?g)$/iu.test(path))
    throw new Error(
      "Only local PNG and JPEG images are supported in this milestone.",
    );
  return path;
}

export function imageNodes(
  document: FoundryDocument,
): Extract<InlineNode, { type: "image" }>[] {
  const images: Extract<InlineNode, { type: "image" }>[] = [];
  function inline(nodes: InlineNode[]) {
    for (const node of nodes) {
      if (node.type === "image") images.push(node);
      else if ("children" in node) inline(node.children);
    }
  }
  function blocks(nodes: BlockNode[]) {
    for (const block of nodes) {
      if ("children" in block) inline(block.children);
      else if (block.type === "blockquote") blocks(block.blocks);
      else if (block.type === "list")
        for (const item of block.items) blocks(item);
      else if (block.type === "table")
        for (const row of block.rows) for (const cell of row) inline(cell);
    }
  }
  blocks(document.blocks);
  return images;
}

export async function resolveImages(
  source: FoundryDocument,
  host: ImageHost,
): Promise<ImageReview> {
  const document = structuredClone(source);
  document.images = {};
  const errors = [...(document.resourceErrors ?? [])];
  const warnings: string[] = [];
  const byPath = new Map<string, ImageAsset>();
  const attempts = new Set<string>();
  const fingerprints: string[] = [];
  let total = 0;
  for (const node of imageNodes(document)) {
    try {
      const path = localImagePath(node.url);
      if (
        node.width !== undefined &&
        (!Number.isFinite(node.width) || node.width < 1 || node.width > 10000)
      )
        throw new Error("Image width must be between 1 and 10000 pixels.");
      if (
        node.height !== undefined &&
        (!Number.isFinite(node.height) ||
          node.height < 1 ||
          node.height > 10000)
      )
        throw new Error("Image height must be between 1 and 10000 pixels.");
      const entry = host.resolve(path);
      if (!entry)
        throw new Error("Image not found. Check its attachment path.");
      localImagePath(entry.path);
      let asset = byPath.get(entry.path);
      if (!asset) {
        attempts.add(entry.path);
        if (attempts.size > IMAGE_LIMITS.count)
          throw new Error("Use at most 50 unique images per note.");
        checkSize(entry.size, total);
        const bytes = await entry.read();
        checkSize(bytes.byteLength, total);
        total += bytes.byteLength;
        const info = inspectImage(bytes);
        if (
          (/\.png$/iu.test(entry.path) ? "image/png" : "image/jpeg") !==
          info.mediaType
        )
          throw new Error(
            "Image contents do not match the filename extension.",
          );
        await host.decode(bytes, info.mediaType);
        const id = `image-${byPath.size + 1}`;
        asset = { id, path: entry.path, bytes, ...info };
        byPath.set(entry.path, asset);
        document.images[id] = asset;
        fingerprints.push(`${entry.path}:${await digest(bytes)}`);
      }
      node.resourceId = asset.id;
      if (!node.alt.trim())
        warnings.push(
          `${entry.path}: add descriptive alt text for readers using assistive technology.`,
        );
    } catch (error) {
      errors.push(
        `${node.url || "Image"}: ${error instanceof Error ? error.message : "The image could not be read."}`,
      );
    }
  }
  // Includes semantic references, resolved paths, byte content, and diagnostics.
  const signature = await digest(
    new TextEncoder().encode(
      JSON.stringify([source, fingerprints, errors, warnings]),
    ),
  );
  return {
    document,
    errors: [...new Set(errors)],
    warnings: [...new Set(warnings)],
    signature,
  };
}

function checkSize(size: number, total: number): void {
  if (!Number.isSafeInteger(size) || size < 1 || size > IMAGE_LIMITS.fileBytes)
    throw new Error("Each image must be no larger than 5 MiB.");
  if (total + size > IMAGE_LIMITS.totalBytes)
    throw new Error("Images must total no more than 20 MiB.");
}

async function digest(bytes: Uint8Array): Promise<string> {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes.slice().buffer)),
    (value) => value.toString(16).padStart(2, "0"),
  ).join("");
}

export function inspectImage(
  bytes: Uint8Array,
): Pick<ImageAsset, "mediaType" | "extension" | "width" | "height"> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let width = 0,
    height = 0;
  let png = false;
  if (
    bytes.length >= 33 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every(
      (value, index) => bytes[index] === value,
    )
  ) {
    png = true;
    let offset = 8,
      data = false,
      end = false;
    while (offset + 12 <= bytes.length) {
      const length = view.getUint32(offset);
      if (length > bytes.length - offset - 12)
        throw new Error("The PNG is truncated or malformed.");
      const type = new TextDecoder().decode(
        bytes.slice(offset + 4, offset + 8),
      );
      if (offset === 8 && (type !== "IHDR" || length !== 13))
        throw new Error("The PNG header is malformed.");
      if (type === "IHDR") {
        if (offset !== 8)
          throw new Error("The PNG contains duplicate headers.");
        width = view.getUint32(offset + 8);
        height = view.getUint32(offset + 12);
        checkPixels(width, height);
      }
      if (type === "acTL")
        throw new Error("Animated PNG images are not supported.");
      if (type === "IDAT") data = true;
      offset += length + 12;
      if (type === "IEND") {
        end = length === 0 && offset === bytes.length;
        break;
      }
    }
    if (!end || !data) throw new Error("The PNG is truncated or malformed.");
  } else if (
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes.at(-2) === 255 &&
    bytes.at(-1) === 217
  ) {
    let offset = 2;
    while (offset + 4 <= bytes.length) {
      if (bytes[offset] !== 255) throw new Error("The JPEG is malformed.");
      while (bytes[offset] === 255) offset++;
      const marker = bytes[offset++]!;
      if (marker === 218 || marker === 217) break;
      if (offset + 2 > bytes.length) break;
      const length = view.getUint16(offset);
      if (length < 2 || offset + length > bytes.length)
        throw new Error("The JPEG is truncated.");
      if ([192, 193, 194].includes(marker) && length >= 8) {
        if (width) throw new Error("The JPEG contains duplicate frames.");
        height = view.getUint16(offset + 3);
        width = view.getUint16(offset + 5);
        checkPixels(width, height);
      }
      offset += length;
    }
  } else throw new Error("The file is not a valid PNG or JPEG image.");
  checkPixels(width, height);
  return {
    mediaType: png ? "image/png" : "image/jpeg",
    extension: png ? "png" : "jpg",
    width,
    height,
  };
}

function checkPixels(width: number, height: number): void {
  if (!width || !height || width * height > IMAGE_LIMITS.pixels)
    throw new Error(
      "Images must have valid dimensions and no more than 20 megapixels.",
    );
}

export function requireImage(
  document: FoundryDocument,
  node: Extract<InlineNode, { type: "image" }>,
): ImageAsset {
  const image = node.resourceId
    ? document.images?.[node.resourceId]
    : undefined;
  if (!image)
    throw new Error("Review and resolve the note's images before exporting.");
  return image;
}

export function imageSize(
  image: Pick<ImageAsset, "width" | "height">,
  requested: number | undefined,
  maxWidth: number,
  maxHeight: number,
  requestedHeight?: number,
): { width: number; height: number } {
  const scale = Math.min(
    1,
    (requested ?? image.width) / image.width,
    (requestedHeight ?? image.height) / image.height,
    maxWidth / image.width,
    maxHeight / image.height,
  );
  return { width: image.width * scale, height: image.height * scale };
}

export async function decodeImage(
  bytes: Uint8Array,
  mediaType: string,
): Promise<void> {
  const blob = new Blob([bytes.slice().buffer], { type: mediaType });
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(blob);
    bitmap.close();
    return;
  }
  const url = URL.createObjectURL(blob);
  try {
    await new Promise<void>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve();
      image.onerror = () =>
        reject(
          new Error("The image cannot be decoded. Re-save it as PNG or JPEG."),
        );
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
