/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname } from "node:path";

const reviewed = {
  "wasm-pack-shim.mjs":
    "0023261749a0ad3276dc7718d163d9967d9e5cf8b882a4ea60173e5cd8cac921",
  "init.mjs":
    "c5d8390f2cb1a91b29b6f2d539ea5b19ed67247aa41ba35b76d14bc5244926f3",
  "options.init.mjs":
    "980a5ddd6f022c379264d23140346b6248fec3bc7df4a17e6931598f97920ed2",
  "typst_ts_web_compiler.mjs":
    "96735c6da3dd220255ba368e34c695227fc67e0b4104e7a8e039dd9bc2fc5312",
};

/** An actual capability reduction, not a scanner exception or string rename. */
export function offlineTypstSource(name, source) {
  if (createHash("sha256").update(source).digest("hex") !== reviewed[name])
    throw new Error(
      `Review the updated Typst ${name} before applying offline restrictions.`,
    );
  if (name === "wasm-pack-shim.mjs")
    return `
    export * from './typst_ts_web_compiler.mjs';
    export { default } from './typst_ts_web_compiler.mjs';
  `;
  if (name === "init.mjs")
    return `
    export async function buildComponent(options, module, Builder, hooks) {
      await module.init(options?.getModule?.());
      const builder = new Builder();
      const context = { builder, hooks, ref: {
        async loadFonts(target, fonts) {
          for (const font of fonts) {
            if (!(font instanceof Uint8Array)) throw new Error("Only local font bytes are supported.");
            await target.add_raw_font(font);
          }
        },
        setFetcher() { throw new Error("Network font loaders are disabled."); },
      } };
      for (const before of options?.beforeBuild ?? []) await before(undefined, context);
      if (hooks.latelyBuild) hooks.latelyBuild(context);
      return await builder.build();
    }
    export function loadFontSync() { throw new Error("Remote fonts are disabled."); }
  `;
  if (name === "options.init.mjs")
    return `
    export function loadFonts(fonts, options) {
      if (options?.assets !== false) throw new Error("Remote font assets are disabled.");
      const loader = async (_, context) => context.ref.loadFonts(context.builder, fonts);
      loader._kind = "fontLoader";
      loader._preloadRemoteFontOptions = { assets: false };
      return loader;
    }
  `;
  const one =
    "const ret = new Function(getStringFromWasm0(arg0, arg1));\n        return addHeapObject(ret);";
  const two =
    "const ret = new Function(getStringFromWasm0(arg0, arg1), getStringFromWasm0(arg2, arg3));\n        return addHeapObject(ret);";
  const defaultModule =
    "module_or_path = importWasmModule('typst_ts_web_compiler_bg.wasm', import.meta.url);";
  const networkModule = "module_or_path = fetch(module_or_path);";
  for (const expected of [one, two, defaultModule, networkModule]) {
    if (source.split(expected).length !== 2)
      throw new Error(
        "Expected Typst capability boundary is missing or ambiguous.",
      );
    source = source.replace(
      expected,
      expected === one
        ? `const text = getStringFromWasm0(arg0, arg1);
         if (text === "return this") return addHeapObject(function() { return globalThis; });
         if (text === "return 0") return addHeapObject(function() { return 0; });
         if (text === "return true") return addHeapObject(function() { return true; });
         if (text === "throw new Error('Dummy AccessModel, please initialize compiler with withAccessModel()')") return addHeapObject(function() { throw new Error("Local compiler access model is not initialised."); });
         if (text === "throw new Error('Dummy Registry, please initialize compiler with withPackageRegistry()')") return addHeapObject(function() { throw new Error("External compiler packages are disabled."); });
         throw new Error("Dynamic JavaScript is disabled in the offline PDF compiler.");`
        : expected === two
          ? 'if (getStringFromWasm0(arg0, arg1) !== "path" || getStringFromWasm0(arg2, arg3) !== "return path") throw new Error("Dynamic JavaScript is disabled in the offline PDF compiler."); return addHeapObject(function(path) { return path; });'
          : 'throw new Error("The PDF compiler requires embedded bytes; network loading is disabled.");',
    );
  }
  return source;
}

export const offlineTypstRuntime = {
  name: "offline-typst-runtime",
  setup(build) {
    build.onLoad(
      {
        filter:
          /[\\/]@myriaddreamin[\\/](?:typst\.ts[\\/]dist[\\/]esm[\\/](?:init|options\.init)\.mjs|typst-ts-web-compiler[\\/]pkg[\\/](?:typst_ts_web_compiler|wasm-pack-shim)\.mjs)$/,
      },
      async ({ path }) => ({
        contents: offlineTypstSource(
          path.split(/[\\/]/).at(-1),
          await readFile(path, "utf8"),
        ),
        loader: "js",
        resolveDir: dirname(path),
      }),
    );
  },
};
