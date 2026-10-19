/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import assert from "node:assert/strict";
import { it } from "node:test";
import { changeReviewLayout } from "../src/templates/review";
import { CORE_CATALOG } from "../src/packs/core";
import { parseMarkdown } from "../src/core/markdown";
import { templateLibrary } from "../src/templates/catalog";

it("keeps compatible explicit blanks, initializes new details and takes the chosen print defaults", () => {
  const layout = templateLibrary(CORE_CATALOG, true).find(
    (t) => t.printOptions?.trim === "5x8" && t.printOptions.paper === "cream",
  )!;
  assert.ok(layout);
  const before = {
    format: "pdf" as const,
    preset: "manuscript",
    profile: "us-letter" as const,
    outputName: "Proof",
    destination: "share" as const,
    language: "de",
    metadata: { title: "", language: "de", surname: "Discard" },
  };
  const next = changeReviewLayout(
    before,
    layout,
    parseMarkdown("---\nauthor: Alex Example\n---\n\nBody", "Draft"),
    CORE_CATALOG,
  );
  assert.equal(next.metadata!.title, "");
  assert.equal(next.metadata!.author, "Alex Example");
  assert.equal(next.metadata!.surname, undefined);
  assert.equal(next.metadata!.language, "de");
  assert.equal(next.profile, layout.profile);
  assert.deepEqual(next.printOptions, layout.printOptions);
  assert.notEqual(next.printOptions, layout.printOptions);
  assert.equal(before.metadata.surname, "Discard");
});
