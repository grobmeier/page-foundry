/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const reviewed = {
  browser: "ad5b0407d199dda7bc4fbacaee90d2a2a99540c8ced44c13bdf6974cb6dc3ef1",
  node: "15d7b0b8516c8190b191ec9a0adaab16808d09751ef534d7829512944072011f",
};

/** Preserve unknown binary properties, without offering a binary-data codec. */
export function opaqueYamlBinarySource(kind, source, version) {
  if (
    version !== "2.9.1" ||
    !Object.hasOwn(reviewed, kind) ||
    createHash("sha256").update(source).digest("hex") !== reviewed[kind]
  )
    throw new Error(
      "Review the updated YAML binary tag before applying opaque preservation.",
    );
  return `
    import { stringifyString } from '../../stringify/stringifyString.js';

    class OpaqueBinary {
      #text;
      constructor(text) { this.#text = text; Object.freeze(this); }
      get text() { return this.#text; }
    }

    // Match the browser tag's accepted base64 syntax, but never decode it.
    // A linear scan also handles long properties without regex backtracking.
    function validBinaryText(text) {
      let digits = 0, padding = 0;
      for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        if (code === 9 || code === 10 || code === 12 || code === 13 || code === 32) continue;
        if (code === 61) {
          if (++padding > 2) return false;
        } else {
          if (padding || !((code >= 65 && code <= 90) || (code >= 97 && code <= 122) ||
              (code >= 48 && code <= 57) || code === 43 || code === 47)) return false;
          digits++;
        }
      }
      return padding ? (digits + padding) % 4 === 0 && digits % 4 === 4 - padding : digits % 4 !== 1;
    }

    export const binary = {
      tag: 'tag:yaml.org,2002:binary',
      default: false,
      identify: value => value instanceof OpaqueBinary,
      resolve(text, onError) {
        if (!validBinaryText(text)) onError('Invalid binary-tag text.');
        return new OpaqueBinary(text);
      },
      stringify(node, ctx, onComment, onChompKeep) {
        return stringifyString({ ...node, value: node.value.text }, ctx, onComment, onChompKeep);
      }
    };
  `;
}

export const opaqueYamlRuntime = {
  name: "opaque-yaml-runtime",
  setup(build) {
    build.onLoad(
      {
        filter:
          /[\\/]yaml[\\/](?:browser[\\/])?dist[\\/]schema[\\/]yaml-1\.1[\\/]binary\.js$/,
      },
      async ({ path }) => {
        const browser = /[\\/]yaml[\\/]browser[\\/]dist[\\/]/.test(path);
        const root = resolve(
          dirname(path),
          browser ? "../../../.." : "../../..",
        );
        const metadata = JSON.parse(
          await readFile(resolve(root, "package.json"), "utf8"),
        );
        return {
          contents: opaqueYamlBinarySource(
            browser ? "browser" : "node",
            await readFile(path, "utf8"),
            metadata.version,
          ),
          resolveDir: dirname(path),
          loader: "js",
        };
      },
    );
  },
};
