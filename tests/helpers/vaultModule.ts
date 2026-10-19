/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import { buildSync } from "esbuild";
import { runInNewContext } from "node:vm";
import { createRequire } from "node:module";

export class TestVaultFile {}

/** Exercise host class narrowing without importing Obsidian in the test runner. */
export function vaultModule<T>(entry: string): T {
  const code = buildSync({
    entryPoints: [entry],
    bundle: true,
    format: "cjs",
    platform: "node",
    write: false,
    external: ["obsidian"],
  }).outputFiles[0]!.text;
  const module = { exports: {} };
  runInNewContext(code, {
    module,
    exports: module.exports,
    TextEncoder,
    TextDecoder,
    crypto,
    require(name: string) {
      if (name === "obsidian") return { TFile: TestVaultFile };
      return createRequire(import.meta.url)(name);
    },
  });
  return module.exports as T;
}
