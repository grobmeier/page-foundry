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
        let source = await readFile(path, "utf8");
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
        // Supported hosts have native bind and generator syntax. Remove the
        // obsolete string-code feature-detection/polyfill paths, not just new().
        const bindMarker =
          "//#region node_modules/function-bind/implementation.js";
        const bindStart = source.indexOf(bindMarker);
        const bindEnd = source.indexOf("//#endregion", bindStart);
        const generatorProbe = 'return Function("return function*() {}")();';
        if (
          bindStart < 0 ||
          bindEnd < 0 ||
          source.split(generatorProbe).length !== 2
        )
          throw new Error("Review the changed DOCX native-runtime boundaries.");
        source = (
          source.slice(0, bindStart) +
          "var require_implementation = () => Function.prototype.bind;\n" +
          source.slice(bindEnd + "//#endregion".length)
        ).replace(generatorProbe, "return function*() {};");
        const intrinsicProbe = source.match(
          /return \$Function\([^\n]+\)\(\);/,
        )?.[0];
        if (!intrinsicProbe || source.split(intrinsicProbe).length !== 2)
          throw new Error(
            "Review the changed DOCX intrinsic-constructor probe.",
          );
        source = source.replace(
          intrinsicProbe,
          `
          if (expressionSyntax === "async function () {}") return Object.getPrototypeOf(async function() {}).constructor;
          if (expressionSyntax === "function* () {}") return Object.getPrototypeOf(function*() {}).constructor;
          if (expressionSyntax === "async function* () {}") return Object.getPrototypeOf(async function*() {}).constructor;
          throw new Error("Unsupported intrinsic syntax in the native DOCX runtime.");
        `,
        );
        const marker = "//#region node_modules/jszip/dist/jszip.min.js";
        const imageStringDecoder =
          'return new Uint8Array(atob(dataURI.substring(base64IndexWithOffset)).split("").map((c) => c.charCodeAt(0)));';
        if (source.split(imageStringDecoder).length !== 2)
          throw new Error("Review the changed docx image-input boundary.");
        const start = source.indexOf(marker);
        const end = source.indexOf("//#endregion", start);
        if (start < 0 || end < 0 || source.indexOf(marker, start + 1) >= 0)
          throw new Error(
            "The expected vendored JSZip region is missing or ambiguous.",
          );
        return {
          loader: "js",
          resolveDir: dirname(path),
          contents: (
            source.slice(0, start) +
            'import FoundryJSZip from "jszip";\nvar require_jszip_min = () => FoundryJSZip;\n' +
            source.slice(end + "//#endregion".length)
          ).replace(
            imageStringDecoder,
            'throw new Error("DOCX image inputs must be validated local bytes, not data URLs.");',
          ),
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
