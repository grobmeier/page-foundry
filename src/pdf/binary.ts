/*
 * Copyright 2026 Christian Grobmeier
 * Licensed under the Apache License, Version 2.0.
 */

import { gunzipSync } from "fflate";

export function decodeCompressedBase64(value: string): Uint8Array {
  const decoded = globalThis.atob(value);
  const compressed = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index += 1) {
    compressed[index] = decoded.charCodeAt(index);
  }
  return gunzipSync(compressed);
}
