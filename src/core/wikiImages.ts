/*
 * Copyright 2026 Christian Grobmeier
 * Licensed under the Apache License, Version 2.0.
 */

import type { State, Tokenizer } from "micromark-util-types";
import type { Extension } from "mdast-util-from-markdown";
import type { Processor } from "unified";

declare module "mdast" {
  interface ImageData {
    foundryEmbed?: boolean;
  }
}

declare module "micromark-util-types" {
  interface TokenTypeMap {
    foundryEmbed: "foundryEmbed";
  }
}

// A parser extension, rather than replacing source text: escapes and code keep
// their Markdown meaning and cannot accidentally become resource requests.
const tokenize: Tokenizer = function (effects, ok, nok) {
  let closing = false;
  return start;
  function start(code: number | null) {
    effects.enter("foundryEmbed");
    effects.consume(code!);
    return first;
  }
  function first(code: number | null) {
    if (code !== 91) return nok(code);
    effects.consume(code);
    return second;
  }
  function second(code: number | null) {
    if (code !== 91) return nok(code);
    effects.consume(code);
    return inside;
  }
  function inside(code: number | null): ReturnType<State> {
    if (code === null || code < 0) return nok(code);
    if (closing) {
      if (code !== 93) return nok(code);
      effects.consume(code);
      effects.exit("foundryEmbed");
      return ok;
    }
    closing = code === 93;
    effects.consume(code);
    return inside;
  }
};

const mdast: Extension = {
  enter: {
    foundryEmbed(token) {
      this.enter(
        { type: "image", url: "", alt: "", data: { foundryEmbed: true } },
        token,
      );
    },
  },
  exit: {
    foundryEmbed(token) {
      const node = this.stack.at(-1);
      if (node?.type === "image")
        node.url = this.sliceSerialize(token)
          .slice(3, -2)
          .replace(/\\\|/gu, "|");
      this.exit(token);
    },
  },
};

export function wikiImages(this: Processor): void {
  const data = this.data();
  (data.micromarkExtensions ??= []).push({
    text: { 33: { name: "foundryEmbed", tokenize } },
  });
  (data.fromMarkdownExtensions ??= []).push(mdast);
}
