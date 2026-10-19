/*
 * Copyright 2026 Christian Grobmeier
 * Licensed under the Apache License, Version 2.0.
 */

import { gunzipSync } from "fflate";

/** Decode embedded bytes without browser-specific runtime conversion APIs. */
export function decodeBase64(value: string): Uint8Array {
  if (value.length % 4 !== 0)
    throw new Error("Invalid embedded binary length.");
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  const output = new Uint8Array((value.length / 4) * 3 - padding);
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const codes = new Int16Array(128).fill(-1);
  for (let index = 0; index < alphabet.length; index++)
    codes[alphabet.charCodeAt(index)] = index;
  let accumulator = 0,
    bits = 0,
    position = 0;
  for (let index = 0; index < value.length - padding; index++) {
    const digit = codes[value.charCodeAt(index)] ?? -1;
    if (digit < 0) throw new Error("Invalid embedded binary encoding.");
    accumulator = (accumulator << 6) | digit;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output[position++] = (accumulator >>> bits) & 255;
    }
  }
  if ((accumulator & ((1 << bits) - 1)) !== 0)
    throw new Error("Invalid embedded binary padding.");
  return output;
}

export function decodeCompressedBase64(value: string): Uint8Array {
  return gunzipSync(decodeBase64(value));
}
