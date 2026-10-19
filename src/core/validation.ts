/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
/** Narrow untrusted YAML/JSON/storage data before accessing its properties. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Paths reject every ASCII control; multiline text permits tab, LF and CR. */
export function hasControlCharacters(
  value: string,
  multiline = false,
): boolean {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 && !(multiline && [9, 10, 13].includes(code));
  });
}

export function replaceControlCharacters(
  value: string,
  replacement: string,
  includeDelete = false,
): string {
  return [...value]
    .map((character) =>
      character.charCodeAt(0) < 32 ||
      (includeDelete && character.charCodeAt(0) === 127)
        ? replacement
        : character,
    )
    .join("");
}
