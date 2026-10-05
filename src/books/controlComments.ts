/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
export function bookControlComments(
  source: string,
): { from: number; to: number }[] {
  if (source.length > 128 * 1024) return [];
  const front = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source);
  if (!front || !/^document:\s*(?:book|"book"|'book')\s*$/m.test(front[1]!))
    return [];
  const body = source.slice(front[0].length);
  const result: { from: number; to: number }[] = [];
  let offset = front[0].length,
    fence: string | undefined;
  for (const line of body.split(/(?<=\n)/)) {
    const code = /^\s*(`{3,}|~{3,})/.exec(line);
    if (code) {
      if (!fence) fence = code[1]![0];
      else if (fence === code[1]![0]) fence = undefined;
    } else if (!fence) {
      for (const match of line.matchAll(
        /%% (?:page-foundry:book-order:(?:start|end)|foundry-section: [a-z][a-z0-9-]{0,63}) %%/g,
      ))
        result.push({
          from: offset + match.index!,
          to: offset + match.index! + match[0].length,
        });
    }
    offset += line.length;
  }
  return result;
}
