/*
 * Copyright 2026 Christian Grobmeier
 * Licensed under the Apache License, Version 2.0.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  defaultPreset,
  presetSupportsFormat,
  type OutputFormat,
} from "../src/core/model";

describe("format presets", () => {
  it("selects a compatible default for every output format", () => {
    for (const format of ["pdf", "epub", "docx"] satisfies OutputFormat[]) {
      assert.equal(presetSupportsFormat(defaultPreset(format), format), true);
    }
  });

  it("rejects presets from a different output format", () => {
    assert.equal(presetSupportsFormat("letter", "epub"), false);
    assert.equal(presetSupportsFormat("reflowable-ebook", "docx"), false);
    assert.equal(presetSupportsFormat("general-manuscript", "pdf"), false);
  });
});
