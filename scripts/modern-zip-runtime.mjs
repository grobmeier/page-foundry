/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";

const scheduler = fileURLToPath(
  new URL("../src/runtime/zipScheduler.ts", import.meta.url),
);
const jszipSource = fileURLToPath(
  new URL("../node_modules/jszip/lib/index.js", import.meta.url),
);

/** Replace JSZip's obsolete browser fallbacks with supported runtime APIs. */
export const modernZipRuntime = {
  name: "modern-zip-runtime",
  setup(build) {
    // JSZip's browser entry is prebundled too; explicitly resolve its modular
    // implementation so the obsolete fallback modules can actually be omitted.
    build.onResolve({ filter: /^jszip$/ }, () => ({ path: jszipSource }));
    // Page Foundry uses Blob/Uint8Array ZIPs, never JSZip's Node stream API.
    // Do not introduce a Node builtin dependency into the mobile bundle.
    build.onResolve({ filter: /^(stream|readable-stream)$/ }, ({ importer }) =>
      importer.replaceAll("\\", "/").includes("/jszip/lib/")
        ? { path: "no-node-streams", namespace: "foundry-zip-runtime" }
        : undefined,
    );
    // docx embeds a prebundled JSZip, so dependency aliases alone cannot remove
    // its legacy fallback modules. Use the SAME locked JSZip version as modular
    // source instead. A changed upstream bundle requires explicit review.
    build.onLoad(
      { filter: /[\\/]docx[\\/]dist[\\/]index\.mjs$/ },
      async ({ path }) => {
        const source = await readFile(path, "utf8");
        const zipPackage = JSON.parse(
          await readFile(
            new URL("../node_modules/jszip/package.json", import.meta.url),
            "utf8",
          ),
        );
        if (zipPackage.version !== "3.10.2")
          throw new Error(
            "Review the updated modular JSZip version before bundling.",
          );
        if (
          createHash("sha256").update(source).digest("hex") !==
          "4ba859836773eb7bddbe003a43f74d9eb80ff97fd41c69702b8f7c57d717badd"
        )
          throw new Error(
            "Review the updated docx distribution before adapting its ZIP runtime.",
          );
        const marker = "//#region node_modules/jszip/dist/jszip.min.js";
        const start = source.indexOf(marker);
        const end = source.indexOf("//#endregion", start);
        if (start < 0 || end < 0 || source.indexOf(marker, start + 1) >= 0)
          throw new Error(
            "The expected vendored JSZip region is missing or ambiguous.",
          );
        return {
          loader: "js",
          resolveDir: dirname(path),
          contents:
            source.slice(0, start) +
            'import FoundryJSZip from "jszip";\nvar require_jszip_min = () => FoundryJSZip;\n' +
            source.slice(end + "//#endregion".length),
        };
      },
    );
    build.onResolve(
      { filter: /^(setimmediate|lie)$/ },
      ({ path, importer }) => {
        // Fail closed if a future dependency attempts to use a different contract.
        const expected = path === "setimmediate" ? "utils" : "external";
        if (
          !importer.replaceAll("\\", "/").endsWith(`/jszip/lib/${expected}.js`)
        )
          return {
            errors: [
              { text: `Review the new ${path} consumer before bundling.` },
            ],
          };
        return { path, namespace: "foundry-zip-runtime" };
      },
    );
    build.onLoad(
      { filter: /.*/, namespace: "foundry-zip-runtime" },
      ({ path }) => ({
        loader: "js",
        resolveDir: dirname(scheduler),
        contents:
          path === "lie"
            ? "module.exports = globalThis.Promise;"
            : path === "no-node-streams"
              ? "module.exports = {};"
              : `import { installZipScheduler } from ${JSON.stringify(scheduler)}; installZipScheduler(globalThis);`,
      }),
    );
    build.onEnd(async (result) => {
      if (result.errors.length) return;
      const outputs = result.outputFiles
        ? result.outputFiles
            .filter(
              (file) =>
                /\.(?:js|mjs)$/.test(file.path) || file.path === "<stdout>",
            )
            .map((file) => file.text)
        : build.initialOptions.outfile
          ? [await readFile(resolve(build.initialOptions.outfile), "utf8")]
          : [];
      if (
        outputs.some((source) =>
          /createElement\s*\(\s*["']script["']\s*\)/.test(source),
        )
      )
        return {
          errors: [
            {
              text: "Distributed code must not create script elements; review the ZIP runtime adaptation.",
            },
          ],
        };
    });
  },
};
