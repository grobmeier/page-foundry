/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
export function inspectRuntime(source: string): {
  network: number;
  dynamicCode: number;
  browserBinaryCodecs: number;
};
