/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import type { FoundryDocument } from "../core/model";
import type { ExportChoice } from "../ui/exportModal";
import type { TemplateLayout } from "./catalog";
import {
  choosePreset,
  initialMetadata,
  type PresetCatalog,
} from "../packs/model";

/** A design changes appearance; compatible, unsaved author choices stay local. */
export function changeReviewLayout(
  previous: ExportChoice,
  layout: TemplateLayout,
  document: FoundryDocument,
  catalog: PresetCatalog,
): ExportChoice {
  const preset = choosePreset(catalog, layout.preset, layout.format);
  const metadata = initialMetadata(document, preset);
  const keys = new Set(preset.metadata.map((field) => field.key));
  keys.add("language");
  for (const key of keys)
    if (Object.hasOwn(previous.metadata ?? {}, key))
      metadata[key] = previous.metadata![key]!;
  metadata.language = previous.metadata?.language ?? previous.language;
  return {
    ...layout,
    outputName: previous.outputName,
    destination: previous.destination,
    language: previous.language,
    metadata,
    printOptions: layout.printOptions ? { ...layout.printOptions } : undefined,
  };
}
