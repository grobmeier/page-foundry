/*
 * Copyright 2026 Christian Grobmeier
 * Licensed under the Apache License, Version 2.0.
 */

import esbuild from "esbuild";
import { cp, mkdir } from "node:fs/promises";
import { compressedBinaryPlugin } from "./compressed-binary-plugin.mjs";

await mkdir(".test-browser", { recursive: true });
await cp("tests/browser-smoke.html", ".test-browser/index.html");
await esbuild.build({
  entryPoints: ["tests/browser-smoke.ts"],
  bundle: true,
  format: "iife",
  outfile: ".test-browser/bundle.js",
  platform: "browser",
  plugins: [compressedBinaryPlugin],
  target: "safari16.4",
});
