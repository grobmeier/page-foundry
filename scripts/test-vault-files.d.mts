/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
export function writeMissing(
  path: string,
  bytes: string | Uint8Array,
): Promise<void>;
export function copyMissing(source: string, destination: string): Promise<void>;
export function enableFoundry(path: string): Promise<void>;
