/*
 * Copyright 2026 Christian Grobmeier
 * Licensed under the Apache License, Version 2.0.
 */

import { readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";

export const compressedBinaryPlugin = {
  name: "compressed-binary",
  setup(build) {
    build.onLoad({ filter: /\.(?:otf|wasm|woff2)$/ }, async ({ path }) => {
      const bytes = await readFile(path);
      const compressed = gzipSync(bytes, { level: 9 });
      return {
        contents: `export default ${JSON.stringify(compressed.toString("base64"))};`,
        loader: "js",
      };
    });
  },
};
