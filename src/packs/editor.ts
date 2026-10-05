/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import { parsePack, type PackPreset, type PresetPack } from "./model";
import type { RenderStyle, OutputFormat } from "../core/model";
export interface PresetEdits {
  name: string;
  bodySizePt?: number;
  marginXmm?: number;
  marginYmm?: number;
  lineSpacing?: number;
  color?: string;
  fonts?: Partial<Record<OutputFormat, string>>;
}
export function editablePreset(
  base: PackPreset,
  id: string,
  edits: PresetEdits,
): PackPreset {
  const result: PackPreset = structuredClone({
    id,
    name: edits.name.trim(),
    description: base.description,
    outputs: base.outputs,
    metadata: base.metadata,
  });
  for (const format of ["pdf", "docx", "epub"] as const) {
    const output = result.outputs[format];
    if (!output) continue;
    const style: RenderStyle = { ...output.style };
    for (const key of [
      "bodySizePt",
      "marginXmm",
      "marginYmm",
      "lineSpacing",
      "color",
    ] as const) {
      if (format === "epub" && !["lineSpacing", "color"].includes(key))
        continue;
      const value = edits[key];
      if (value !== undefined) Object.assign(style, { [key]: value });
    }
    if (edits.fonts?.[format]) style.font = edits.fonts[format];
    output.style = style;
  }
  return result;
}
export function updatedPack(
  original: PresetPack | undefined,
  preset: PackPreset,
  packId = "local-designs",
): string {
  const pack: PresetPack = original
    ? structuredClone(original)
    : {
        schemaVersion: 1,
        id: packId,
        name: "My output presets",
        version: "1.0.0",
        compatibility: { minEngine: 1, maxEngine: 1 },
        presets: [],
      };
  if (pack.id === "core")
    throw new Error(
      "Core presets cannot be edited. Save a local custom pack instead.",
    );
  if (pack.compatibility.minEngine > 1 || pack.compatibility.maxEngine < 1)
    throw new Error(
      "This pack targets a different engine. Its contents were not changed.",
    );
  const index = pack.presets.findIndex((p) => p.id === preset.id);
  if (index === -1) pack.presets.push(preset);
  else pack.presets[index] = preset;
  if (original) {
    const [major, minor, patch] = pack.version.split(".").map(Number);
    pack.version = `${major}.${minor}.${patch! + 1}`;
  }
  const source = `${JSON.stringify(pack, null, 2)}\n`;
  parsePack(source);
  return source;
}
