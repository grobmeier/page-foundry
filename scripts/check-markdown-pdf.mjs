/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import { build } from "esbuild";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { compressedBinaryPlugin } from "./compressed-binary-plugin.mjs";
import { offlineTypstRuntime } from "./offline-typst-runtime.mjs";
import { opaqueYamlRuntime } from "./opaque-yaml-runtime.mjs";
const output = await mkdtemp(join(tmpdir(), "foundry-markdown-proofs-"));
await build({
  entryPoints: ["tests/markdown-pdf-proofs.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  banner: {
    js: 'import { createRequire as foundryCreateRequire } from "node:module"; const require = foundryCreateRequire(import.meta.url);',
  },
  outfile: join(output, "check.mjs"),
  plugins: [compressedBinaryPlugin, offlineTypstRuntime, opaqueYamlRuntime],
});
const run = spawnSync(process.execPath, [join(output, "check.mjs"), output], {
  stdio: "inherit",
});
process.exitCode = run.status ?? 1;
