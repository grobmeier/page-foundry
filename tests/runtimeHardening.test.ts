/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import assert from "node:assert/strict";
import { it } from "node:test";
import { readFile } from "node:fs/promises";
import { transformSync } from "esbuild";
import { runInNewContext } from "node:vm";
import { gzipSync } from "fflate";
import { decodeBase64, decodeCompressedBase64 } from "../src/pdf/binary";
import {
  hasControlCharacters,
  replaceControlCharacters,
  isRecord,
} from "../src/core/validation";
import { parseBookManifest } from "../src/books/manifest";
import { offlineTypstSource } from "../scripts/offline-typst-runtime.mjs";
import { inspectRuntime } from "../scripts/check-runtime.mjs";

it("detects executable capability regressions without mistaking text for calls", () => {
  assert.equal(
    inspectRuntime('const execute = Function; execute("return 1");')
      .dynamicCode,
    1,
  );
  assert.deepEqual(
    inspectRuntime('const text = "fetch(); new Function()"; /* eval() */'),
    { network: 0, dynamicCode: 0, browserBinaryCodecs: 0 },
  );
  assert.deepEqual(
    inspectRuntime(
      'fetch("x"); window.fetch("x"); new XMLHttpRequest(); eval("x"); new Function("x"); atob("AA==");',
    ),
    { network: 3, dynamicCode: 2, browserBinaryCodecs: 1 },
  );
});

it("preserves control-character rejection without control regexes", () => {
  for (let code = 0; code < 128; code++) {
    const character = String.fromCharCode(code);
    assert.equal(hasControlCharacters(character), code < 32);
    assert.equal(
      hasControlCharacters(character, true),
      code < 32 && ![9, 10, 13].includes(code),
    );
    assert.equal(
      replaceControlCharacters(character, "-", true),
      code < 32 || code === 127 ? "-" : character,
    );
  }
  assert.equal(replaceControlCharacters("A 🌿 journey", "-"), "A 🌿 journey");
  for (const value of [null, undefined, [], "text", 42])
    assert.equal(isRecord(value), false);
  assert.equal(isRecord({ field: "value" }), true);
  assert.throws(
    () =>
      parseBookManifest(
        "---\npage-foundry-book: 1\ntitle: Example\nentries:\n- id: one\n  role: [chapter]\n  path: Chapter.md\n---\n",
      ),
    /Invalid role/,
  );
});

it("decodes embedded binary bytes independently of browser base64 APIs", () => {
  for (const size of [0, 1, 2, 3, 255, 4096]) {
    const bytes = Uint8Array.from({ length: size }, (_, index) => index % 256);
    assert.deepEqual(
      decodeBase64(Buffer.from(bytes).toString("base64")),
      bytes,
    );
    const compressed = gzipSync(bytes, { mtime: 0 });
    assert.deepEqual(
      decodeCompressedBase64(Buffer.from(compressed).toString("base64")),
      bytes,
    );
  }
  for (const invalid of ["A", "A===", "====", "AA=A", "Zh==", "💥==", "AA\n="])
    assert.throws(() => decodeBase64(invalid), /Invalid embedded/);
});

it("disables dynamic JavaScript and URL loading in the pinned compiler glue", async () => {
  const original = await readFile(
    "node_modules/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler.mjs",
    "utf8",
  );
  const adapted = offlineTypstSource("typst_ts_web_compiler.mjs", original);
  assert.doesNotMatch(adapted, /new Function\s*\(|\bfetch\s*\(/);
  assert.throws(
    () => offlineTypstSource("typst_ts_web_compiler.mjs", original + "\n"),
    /Review the updated/,
  );
  const code = transformSync(
    adapted +
      `
    export function probe(text) {
      getStringFromWasm0 = () => text;
      const bindings = __wbg_get_imports().wbg;
      return getObject(bindings.__wbg_new_no_args_cb138f77cf6151ee(0, 0))();
    }
  `,
    { format: "cjs" },
  ).code;
  const module = {
    exports: {} as {
      probe(text: string): unknown;
      default(value?: unknown): Promise<unknown>;
    },
  };
  runInNewContext(code, {
    module,
    exports: module.exports,
    TextEncoder,
    TextDecoder,
    console: { warn() {} },
  });
  assert.equal(typeof module.exports.probe("return this"), "object");
  assert.equal(module.exports.probe("return 0"), 0);
  assert.equal(module.exports.probe("return true"), true);
  for (const text of ["return process", "return this;", "alert('no')"])
    assert.throws(
      () => module.exports.probe(text),
      /Dynamic JavaScript is disabled/,
    );
  await assert.rejects(
    module.exports.default("https://example.invalid/compiler.wasm"),
    /network loading is disabled/,
  );
  await assert.rejects(module.exports.default(), /network loading is disabled/);
});
