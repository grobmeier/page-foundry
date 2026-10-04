/*
 * Copyright 2026 Christian Grobmeier
 * Licensed under the Apache License, Version 2.0.
 */

import type {
  DocxPresetId,
  FoundryDocument,
  OutputFormat,
  PdfPresetId,
  RenderStyle,
} from "../core/model";

export const PACK_ENGINE_VERSION = 1;
export const PACK_MAX_BYTES = 128 * 1024;
export const METADATA_KEYS = [
  "title",
  "author",
  "language",
  "identifier",
  "surname",
  "short-title",
  "from",
  "to",
  "date",
  "subject",
  "closing",
] as const;
export interface MetadataField {
  key: string;
  label: string;
  required?: boolean;
  default?: string;
}
export interface PackOutput {
  recipe: PdfPresetId | DocxPresetId | "reflowable-ebook";
  style?: RenderStyle;
}
export interface PackPreset {
  id: string;
  name: string;
  description: string;
  outputs: Partial<Record<OutputFormat, PackOutput>>;
  metadata: MetadataField[];
}
export interface PresetPack {
  schemaVersion: 1;
  id: string;
  name: string;
  version: string;
  compatibility: { minEngine: number; maxEngine: number };
  presets: PackPreset[];
}
export interface ResolvedPreset extends PackPreset {
  packId: string;
  packName: string;
  packVersion: string;
  selectionId: string;
}
export interface PresetCatalog {
  presets: ResolvedPreset[];
  signature: string;
  error?: string;
}

function record(
  value: unknown,
  keys: string[],
  label: string,
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${label} must be an object.`);
  const object = value as Record<string, unknown>;
  for (const key of Object.keys(object))
    if (!keys.includes(key))
      throw new Error(`${label} has an unsupported field: ${key}.`);
  return object;
}
function text(value: unknown, label: string, max = 160): string {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > max ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value)
  )
    throw new Error(
      `${label} must be non-empty text of at most ${max} characters.`,
    );
  return value;
}
function id(value: unknown, label: string): string {
  const result = text(value, label, 64);
  if (
    !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u.test(result) ||
    ["constructor", "prototype", "__proto__"].includes(result)
  )
    throw new Error(`${label} must be a safe lowercase identifier.`);
  return result;
}
const RECIPES: Record<OutputFormat, readonly string[]> = {
  pdf: ["plain-document", "letter", "manuscript", "paperback-interior"],
  epub: ["reflowable-ebook"],
  docx: ["plain-editable", "general-manuscript"],
};

function style(value: unknown, format: OutputFormat): RenderStyle | undefined {
  if (value === undefined) return;
  const keys =
    format === "epub"
      ? ["font", "lineSpacing", "color"]
      : [
          "font",
          "bodySizePt",
          "marginXmm",
          "marginYmm",
          "lineSpacing",
          "color",
        ];
  const result = record(value, keys, "Style");
  const ranges: Record<string, [number, number]> = {
    bodySizePt: [8, 24],
    marginXmm: [12, 40],
    marginYmm: [12, 40],
    lineSpacing: [1, 3],
  };
  for (const [key, range] of Object.entries(ranges))
    if (
      result[key] !== undefined &&
      (typeof result[key] !== "number" ||
        !Number.isFinite(result[key]) ||
        result[key] < range[0] ||
        result[key] > range[1])
    )
      throw new Error(`${key} is outside the supported range.`);
  if (
    result.color !== undefined &&
    (typeof result.color !== "string" || !/^#[0-9a-f]{6}$/iu.test(result.color))
  )
    throw new Error("Style color must be a six-digit hex color.");
  const fonts =
    format === "pdf"
      ? ["Libertinus Serif"]
      : format === "docx"
        ? ["Times New Roman", "Arial", "Calibri", "Courier New"]
        : ["serif", "sans-serif", "monospace"];
  if (result.font !== undefined && !fonts.includes(String(result.font)))
    throw new Error("Choose a supported font for this output format.");
  return result as RenderStyle;
}

export function parsePack(source: string): PresetPack {
  if (new TextEncoder().encode(source).length > PACK_MAX_BYTES)
    throw new Error("A preset pack must be no larger than 128 KiB.");
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    throw new Error("The preset pack is not valid JSON.");
  }
  const root = record(
    value,
    ["schemaVersion", "id", "name", "version", "compatibility", "presets"],
    "Pack",
  );
  if (root.schemaVersion !== 1)
    throw new Error("Only preset pack schema version 1 is supported.");
  const packId = id(root.id, "Pack ID");
  const name = text(root.name, "Pack name");
  const version = text(root.version, "Pack version", 32);
  if (!/^\d+\.\d+\.\d+$/u.test(version))
    throw new Error("Pack version must use major.minor.patch.");
  const compatibility = record(
    root.compatibility,
    ["minEngine", "maxEngine"],
    "Compatibility",
  );
  const minEngine = compatibility.minEngine,
    maxEngine = compatibility.maxEngine;
  if (
    typeof minEngine !== "number" ||
    typeof maxEngine !== "number" ||
    !Number.isSafeInteger(minEngine) ||
    !Number.isSafeInteger(maxEngine) ||
    minEngine < 1 ||
    maxEngine < minEngine ||
    PACK_ENGINE_VERSION < minEngine ||
    PACK_ENGINE_VERSION > maxEngine
  )
    throw new Error(
      "This pack is not compatible with the current publishing engine.",
    );
  if (
    !Array.isArray(root.presets) ||
    !root.presets.length ||
    root.presets.length > 30
  )
    throw new Error("A pack must contain between 1 and 30 presets.");
  const seen = new Set<string>();
  const presets = root.presets.map((value): PackPreset => {
    const preset = record(
      value,
      ["id", "name", "description", "outputs", "metadata"],
      "Preset",
    );
    const presetId = id(preset.id, "Preset ID");
    if (seen.has(presetId))
      throw new Error("Preset IDs must be unique within a pack.");
    seen.add(presetId);
    const outputsObject = record(
      preset.outputs,
      ["pdf", "epub", "docx"],
      "Outputs",
    );
    if (!Object.keys(outputsObject).length)
      throw new Error("Every preset must support at least one format.");
    const outputs: PackPreset["outputs"] = {};
    for (const format of Object.keys(outputsObject) as OutputFormat[]) {
      const output = record(
        outputsObject[format],
        ["recipe", "style"],
        "Output",
      );
      if (!RECIPES[format].includes(String(output.recipe)))
        throw new Error(`The recipe does not support ${format.toUpperCase()}.`);
      outputs[format] = {
        recipe: output.recipe as PackOutput["recipe"],
        style: style(output.style, format),
      };
    }
    if (
      !Array.isArray(preset.metadata) ||
      preset.metadata.length > METADATA_KEYS.length
    )
      throw new Error("Metadata must be a bounded field list.");
    const fields = new Set<string>();
    const metadata = preset.metadata.map((value): MetadataField => {
      const field = record(
        value,
        ["key", "label", "required", "default"],
        "Metadata field",
      );
      const key = text(field.key, "Metadata key", 40);
      if (
        !(METADATA_KEYS as readonly string[]).includes(key) ||
        fields.has(key)
      )
        throw new Error("Metadata keys must be supported and unique.");
      fields.add(key);
      if (field.required !== undefined && typeof field.required !== "boolean")
        throw new Error("Required must be true or false.");
      return {
        key,
        label: text(field.label, "Field label"),
        required: field.required as boolean | undefined,
        default:
          field.default === undefined
            ? undefined
            : text(field.default, "Default metadata", 2000),
      };
    });
    return {
      id: presetId,
      name: text(preset.name, "Preset name"),
      description: text(preset.description, "Preset description", 1000),
      outputs,
      metadata,
    };
  });
  return {
    schemaVersion: 1,
    id: packId,
    name,
    version,
    compatibility: { minEngine, maxEngine },
    presets,
  };
}

export function catalogue(
  packs: PresetPack[],
  signature: string,
): PresetCatalog {
  const ids = new Set<string>();
  const presets: ResolvedPreset[] = [];
  for (const pack of packs) {
    if (ids.has(pack.id))
      throw new Error(
        "Pack IDs must be unique; custom packs cannot replace core.",
      );
    ids.add(pack.id);
    for (const preset of pack.presets)
      presets.push({
        ...preset,
        packId: pack.id,
        packName: pack.name,
        packVersion: pack.version,
        selectionId: pack.id === "core" ? preset.id : `${pack.id}:${preset.id}`,
      });
  }
  return { presets, signature };
}

export function choosePreset(
  catalog: PresetCatalog,
  selection: string,
  format: OutputFormat,
): ResolvedPreset {
  const preset = catalog.presets.find(
    (preset) => preset.selectionId === selection && preset.outputs[format],
  );
  if (!preset)
    throw new Error(
      "Choose a preset that supports the selected output format.",
    );
  return preset;
}

export function initialMetadata(
  document: FoundryDocument,
  preset: ResolvedPreset,
): Record<string, string> {
  return Object.fromEntries(
    preset.metadata.map((field) => [
      field.key,
      document.metadata[field.key] ??
        (field.key === "title"
          ? document.title
          : field.key === "language"
            ? document.metadata.lang
            : undefined) ??
        field.default ??
        "",
    ]),
  );
}

export function metadataErrors(
  preset: ResolvedPreset,
  values: Record<string, string>,
  format: OutputFormat,
): string[] {
  const errors: string[] = [];
  for (const field of preset.metadata) {
    const value = values[field.key] ?? "";
    if (
      value.length > 2000 ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value)
    )
      errors.push(
        `${field.label} is too long or contains unsupported control characters.`,
      );
    if (field.required && !value.trim())
      errors.push(`Enter ${field.label.toLowerCase()}.`);
  }
  if (
    format === "epub" &&
    !/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/u.test(
      values.language?.trim() ?? "",
    )
  )
    errors.push("Enter a publication language such as en, en-GB, or de.");
  return errors;
}

export function applyPreset(
  document: FoundryDocument,
  preset: ResolvedPreset,
  format: OutputFormat,
  values: Record<string, string>,
): FoundryDocument {
  const errors = metadataErrors(preset, values, format);
  if (errors.length) throw new Error(errors.join(" "));
  const output = preset.outputs[format];
  if (!output) throw new Error("The preset does not support this format.");
  const metadata = { ...document.metadata };
  for (const field of preset.metadata) {
    const value = values[field.key] ?? "";
    if (value.trim()) metadata[field.key] = value;
    else delete metadata[field.key];
  }
  if (format === "epub") metadata.language = (values.language ?? "").trim();
  return {
    ...document,
    metadata,
    title: metadata.title?.trim() || document.title,
    style: output.style,
  };
}
