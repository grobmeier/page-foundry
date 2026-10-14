/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import type { PublishRequest } from "../core/model";
import type { PresetCatalog } from "../packs/model";
import { PRINT_TRIMS } from "../print/model";

export type TemplateLayout = Pick<
  PublishRequest,
  "format" | "preset" | "profile" | "printOptions"
>;
export interface Template extends TemplateLayout {
  key: string;
  name: string;
  search: string;
}
export interface TemplateUse {
  key: string;
  uses: number;
  lastUsed: number;
}
export const MAX_TEMPLATE_HISTORY = 50;

export function templateKey(layout: TemplateLayout): string {
  return [
    layout.preset,
    layout.format,
    layout.profile,
    layout.printOptions?.trim ?? "-",
    layout.printOptions?.paper ?? "-",
    layout.printOptions ? String(layout.printOptions.recto) : "-",
  ].join("|");
}
export function templateLibrary(
  catalog: PresetCatalog,
  book: boolean,
): Template[] {
  if (catalog.error) throw new Error(catalog.error);
  const templates: Template[] = [];
  for (const preset of catalog.presets)
    for (const format of ["pdf", "epub", "docx"] as const) {
      const output = preset.outputs[format];
      if (
        !output ||
        (!book && (output.recipe === "paperback-interior" || output.book)) ||
        (book && output.recipe === "letter")
      )
        continue;
      const name =
        preset.packId === "core"
          ? ({
              "general-manuscript": "Manuscript",
              "reflowable-ebook": "Ebook",
              "paperback-interior": "Paperback",
            }[preset.id] ?? preset.name)
          : `${preset.name} · ${preset.packName}`;
      const add = (layout: TemplateLayout, suffix: string, extra = "") => {
        const label = `${name} · ${suffix} · ${format.toUpperCase()}`;
        templates.push({
          ...layout,
          key: templateKey(layout),
          name: label,
          search: `${label} ${preset.packName} ${extra}`.toLowerCase(),
        });
      };
      if (output.recipe === "paperback-interior") {
        if (output.book?.printDefaults) {
          const defaults = output.book.printDefaults;
          add(
            {
              format,
              preset: preset.selectionId,
              profile: "a4",
              printOptions: { ...defaults },
            },
            `${PRINT_TRIMS[defaults.trim].label} · ${defaults.paper}${defaults.recto ? "" : " · next-page chapters"}`,
          );
          continue;
        }
        for (const trim of Object.keys(
          PRINT_TRIMS,
        ) as (keyof typeof PRINT_TRIMS)[])
          for (const paper of ["white", "cream"] as const)
            for (const recto of [true, false])
              add(
                {
                  format,
                  preset: preset.selectionId,
                  profile: "a4",
                  printOptions: { trim, paper, recto },
                },
                `${PRINT_TRIMS[trim].label} · ${paper}${recto ? "" : " · next-page chapters"}`,
                `Amazon KDP proof ${trim}`,
              );
      } else if (format === "epub")
        add(
          { format, preset: preset.selectionId, profile: "a4" },
          "reflowable",
        );
      else
        for (const profile of ["a4", "us-letter"] as const)
          add(
            { format, preset: preset.selectionId, profile },
            profile === "a4" ? "A4" : "US Letter",
          );
    }
  return templates;
}

/** Discard unknown fields, unsafe values and unbounded stored history. */
export function cleanTemplateHistory(value: unknown): TemplateUse[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: TemplateUse[] = [];
  for (const row of value.slice(0, 500)) {
    if (!row || typeof row !== "object") continue;
    const { key, uses, lastUsed } = row;
    if (
      typeof key !== "string" ||
      key.length > 250 ||
      !/^[a-z][a-z0-9:-]*\|(pdf|epub|docx)\|(a4|us-letter)\|(-|5x8|5\.5x8\.5|6x9)\|(-|white|cream)\|(-|true|false)$/.test(
        key,
      ) ||
      seen.has(key) ||
      !Number.isSafeInteger(uses) ||
      uses < 1 ||
      !Number.isSafeInteger(lastUsed) ||
      lastUsed < 0
    )
      continue;
    seen.add(key);
    result.push({ key, uses: Math.min(uses, 1_000_000), lastUsed });
  }
  return result
    .sort((a, b) => b.lastUsed - a.lastUsed || a.key.localeCompare(b.key))
    .slice(0, MAX_TEMPLATE_HISTORY);
}
export function rememberTemplate(
  value: unknown,
  layout: TemplateLayout,
  now = Date.now(),
): TemplateUse[] {
  const history = cleanTemplateHistory(value);
  const key = templateKey(layout);
  const previous = history.find((row) => row.key === key);
  return cleanTemplateHistory([
    {
      key,
      uses: Math.min(1_000_000, (previous?.uses ?? 0) + 1),
      lastUsed: now,
    },
    ...history.filter((row) => row.key !== key),
  ]);
}
export function rankTemplates(
  templates: Template[],
  history: unknown,
  recent = false,
): Template[] {
  const usage = new Map(
    cleanTemplateHistory(history).map((row) => [row.key, row]),
  );
  return templates
    .filter((template) => !recent || usage.has(template.key))
    .sort((a, b) => {
      const left = usage.get(a.key),
        right = usage.get(b.key);
      return (
        (!recent ? (right?.uses ?? 0) - (left?.uses ?? 0) : 0) ||
        (right?.lastUsed ?? 0) - (left?.lastUsed ?? 0) ||
        a.name
          .replace(" · next-page chapters", "")
          .localeCompare(b.name.replace(" · next-page chapters", "")) ||
        Number(b.printOptions?.recto ?? true) -
          Number(a.printOptions?.recto ?? true) ||
        a.key.localeCompare(b.key)
      );
    });
}
export function searchTemplates(
  templates: Template[],
  query: string,
): Template[] {
  const words = searchWords(query);
  return templates.filter((template) =>
    words.every((word) =>
      ["pdf", "epub", "docx"].includes(word)
        ? template.format === word
        : searchWords(template.search).some((token) => token.startsWith(word)),
    ),
  );
}

function searchWords(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/us[-\s]+letter/g, "usletter")
    .replace(/(\d)\s*[x×]\s*(\d)/g, "$1x$2")
    .split(/[^\p{L}\p{N}.-]+/u)
    .filter(Boolean);
}
