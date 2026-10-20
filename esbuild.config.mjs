/*
 * Copyright 2026 Christian Grobmeier
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import esbuild from "esbuild";
import { builtinModules } from "node:module";
import process from "node:process";
import { compressedBinaryPlugin } from "./scripts/compressed-binary-plugin.mjs";
import { modernZipRuntime } from "./scripts/modern-zip-runtime.mjs";
import { offlineTypstRuntime } from "./scripts/offline-typst-runtime.mjs";
import { opaqueYamlRuntime } from "./scripts/opaque-yaml-runtime.mjs";
import {
  thirdPartyLicences,
  licenceFooter,
} from "./scripts/third-party-licences.mjs";
import { fileURLToPath } from "node:url";

const production = process.argv[2] === "production";

const context = await esbuild.context({
  footer: production
    ? {
        js: licenceFooter(
          await thirdPartyLicences(
            fileURLToPath(new URL("./", import.meta.url)),
          ),
        ),
      }
    : undefined,
  banner: {
    js: `/*!
 * Copyright 2026 Christian Grobmeier
 * Licensed under the Apache License, Version 2.0.
 * Includes third-party software documented in THIRD_PARTY_NOTICES.md.
 */`,
  },
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: [
    "obsidian",
    "electron",
    "@codemirror/autocomplete",
    "@codemirror/collab",
    "@codemirror/commands",
    "@codemirror/language",
    "@codemirror/lint",
    "@codemirror/search",
    "@codemirror/state",
    "@codemirror/view",
    "@lezer/common",
    "@lezer/highlight",
    "@lezer/lr",
    ...builtinModules,
  ],
  format: "cjs",
  supported: { "dynamic-import": false },
  target: "es2021",
  logLevel: "info",
  minify: production,
  outfile: "main.js",
  plugins: [
    compressedBinaryPlugin,
    modernZipRuntime,
    offlineTypstRuntime,
    opaqueYamlRuntime,
  ],
  sourcemap: production ? false : "inline",
  treeShaking: true,
});

if (production) {
  await context.rebuild();
  await context.dispose();
} else {
  await context.watch();
}
