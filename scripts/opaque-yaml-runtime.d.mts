/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import type { Plugin } from "esbuild";
export const opaqueYamlRuntime: Plugin;
export function opaqueYamlBinarySource(
  kind: "browser" | "node",
  source: string,
  version: string,
): string;
