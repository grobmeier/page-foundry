/*
 * Copyright 2026 Christian Grobmeier
 * Licensed under the Apache License, Version 2.0.
 */

import { readFile } from "node:fs/promises";
import { gzipSync } from "fflate";

export const compressedBinaryPlugin = {
  name: "compressed-binary",
  setup(build) {
    build.onLoad({ filter: /\.(?:otf|ttf|wasm|woff2)$/ }, async ({ path }) => {
      const bytes = await readFile(path);
      const compressed = gzipSync(bytes, { level: 9, mtime: 0 });
      return {
        contents: `export default ${JSON.stringify(Buffer.from(compressed).toString("base64"))};`,
        loader: "js",
      };
    });
  },
};
