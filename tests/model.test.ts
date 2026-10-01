/*
 * Copyright 2026 Christian Grobmeier
 * Licensed under the Apache License, Version 2.0.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { defaultPreset, type OutputFormat } from "../src/core/model";
import { CORE_CATALOG } from "../src/packs/core";
import { choosePreset } from "../src/packs/model";

describe("format presets", () => {
  it("selects a compatible default for every output format", () => {
    for (const format of ["pdf", "epub", "docx"] satisfies OutputFormat[]) {
      assert.ok(choosePreset(CORE_CATALOG, defaultPreset(format), format));
    }
  });

  it("rejects presets from a different output format", () => {
    assert.throws(() => choosePreset(CORE_CATALOG, "letter", "epub"));
    assert.throws(() => choosePreset(CORE_CATALOG, "reflowable-ebook", "docx"));
    assert.ok(choosePreset(CORE_CATALOG, "general-manuscript", "pdf"));
  });
});
