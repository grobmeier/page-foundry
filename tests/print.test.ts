/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import assert from "node:assert/strict";
import { it } from "node:test";
import {
  DEFAULT_PRINT_OPTIONS,
  minimumInsideIn,
  printProofText,
  readMeasurements,
  validatePrintOptions,
  PRINT_TRIMS,
} from "../src/print/model";
import { paginatePrint } from "../src/print/model";
import { createPrintSource } from "../src/pdf/printSource";
import { assembleBook } from "../src/books/assemble";
import { parseBookManifest } from "../src/books/manifest";
import { parseMarkdown } from "../src/core/markdown";
import { bookManifest, bookNotes } from "./fixtures/book";
import { CORE_CATALOG } from "../src/packs/core";
import { choosePreset } from "../src/packs/model";
import { preflight } from "../src/core/preflight";
const book = () =>
  assembleBook(
    parseBookManifest(bookManifest),
    new Map(
      Object.entries(bookNotes).map(([path, raw]) => [
        path,
        parseMarkdown(raw, path),
      ]),
    ),
  );
it("rebuilds with increasing gutters until measured pagination is stable", async () => {
  const calls: number[] = [];
  const counts = [301, 501, 701, 705];
  const result = await paginatePrint(DEFAULT_PRINT_OPTIONS, async (inside) => {
    calls.push(inside);
    return {
      bytes: new Uint8Array([calls.length]),
      measurements: {
        pages: counts[calls.length - 1],
        sections: [{ id: "one", role: "chapter", page: 3 }],
        blanks: [2],
      },
    };
  });
  assert.deepEqual(calls, [0.5, 0.625, 0.75, 0.875]);
  assert.equal(result.measurements.pages, 705);
  assert.equal(result.bytes[0], 4);
  await assert.rejects(
    () =>
      paginatePrint(DEFAULT_PRINT_OPTIONS, async () => ({
        bytes: new Uint8Array(),
        measurements: {
          pages: 5,
          sections: [{ id: "one", role: "chapter", page: 2 }],
          blanks: [],
        },
      })),
    /right-hand/,
  );
});
it("uses exact supported trim dimensions and rejects unknown print options", () => {
  assert.equal(PRINT_TRIMS["6x9"].widthIn * 72, 432);
  assert.equal(PRINT_TRIMS["5.5x8.5"].heightIn * 72, 612);
  validatePrintOptions(DEFAULT_PRINT_OPTIONS);
  for (const options of [
    { trim: "a4" },
    { paper: "color" },
    { recto: "yes" },
    { bleed: true },
  ])
    assert.throws(() =>
      validatePrintOptions({
        ...DEFAULT_PRINT_OPTIONS,
        ...options,
      } as typeof DEFAULT_PRINT_OPTIONS),
    );
});
it("tracks every KDP gutter boundary using physical page counts", () => {
  for (const [pages, expected] of [
    [24, 0.375],
    [150, 0.375],
    [151, 0.5],
    [300, 0.5],
    [301, 0.625],
    [500, 0.625],
    [501, 0.75],
    [700, 0.75],
    [701, 0.875],
    [828, 0.875],
  ])
    assert.equal(minimumInsideIn(pages!), expected);
  assert.throws(() => minimumInsideIn(0));
  assert.throws(() => minimumInsideIn(12.5));
});
it("reports actual page count and paper-specific ranges without certification", () => {
  const measurements = {
    pages: 8,
    sections: [{ id: "chapter", role: "chapter", page: 5 }],
    blanks: [4, 6],
  };
  const proof = printProofText(DEFAULT_PRINT_OPTIONS, 0.5, measurements);
  assert.match(proof, /Proof only/);
  assert.match(proof, /4, 6/);
  assert.match(proof, /physical page 5/);
  assert.match(proof, /not upload certification/);
  assert.match(
    printProofText({ ...DEFAULT_PRINT_OPTIONS, paper: "cream" }, 0.875, {
      pages: 777,
      sections: [],
      blanks: [],
    }),
    /outside.*24–776/,
  );
  assert.match(
    printProofText(DEFAULT_PRINT_OPTIONS, 0.875, {
      pages: 777,
      sections: [],
      blanks: [],
    }),
    /within.*24–828/,
  );
});
it("rejects missing, invalid and out-of-range renderer measurements", () => {
  for (const value of [
    undefined,
    {},
    { pages: 0, sections: [], blanks: [] },
    { pages: 4, sections: [], blanks: [5] },
    { pages: 4, sections: [{ id: "x", role: "chapter", page: 0 }], blanks: [] },
  ])
    assert.throws(() => readMeasurements(value));
});
it("generates mirrored geometry, unnumbered blanks and measured section markers", () => {
  const source = createPrintSource(book(), DEFAULT_PRINT_OPTIONS, 0.625);
  assert.match(source, /width: 6in, height: 9in/);
  assert.match(source, /inside: 0.625in, outside: 0.5in/);
  assert.match(source, /binding: left/);
  assert.match(source, /header: none, footer: none.*foundry-blank/);
  assert.match(source, /numbering\("i", physical - 1\)/);
  assert.match(source, /phase: "front"/);
  assert.match(source, /phase: "body"/);
  assert.match(source, /foundry-proof/);
  assert.equal((source.match(/calc.even/g) ?? []).length, 3);
  assert.doesNotMatch(
    createPrintSource(book(), { ...DEFAULT_PRINT_OPTIONS, recto: false }, 0.5),
    /foundry-blank>]/,
  );
  assert.throws(
    () =>
      createPrintSource(
        parseMarkdown("Hello", "Note"),
        DEFAULT_PRINT_OPTIONS,
        0.5,
      ),
    /ordered book/,
  );
});
it("preflight refuses non-book and invalid print inputs without claiming A4 geometry", () => {
  const preset = choosePreset(CORE_CATALOG, "paperback-interior", "pdf");
  const options = {
    format: "pdf" as const,
    profile: "a4" as const,
    preset,
    metadata: { title: "Neutral" },
  };
  assert.ok(
    preflight(parseMarkdown("Hello", "Note"), options).findings.some(
      (finding) => finding.code === "print-book",
    ),
  );
  const report = preflight(book(), options);
  assert.match(report.summary, /6 × 9/);
  assert.doesNotMatch(report.summary, /A4/);
});
it("bounds image dimensions against the actual print content area", () => {
  const document = book();
  document.images = {
    panel: {
      id: "panel",
      path: "Artwork/panel.png",
      bytes: new Uint8Array(),
      mediaType: "image/png",
      extension: "png",
      width: 4000,
      height: 5000,
    },
  };
  document.blocks.push({
    type: "paragraph",
    children: [
      {
        type: "image",
        url: "Artwork/panel.png",
        alt: "Neutral panel",
        resourceId: "panel",
        width: 2000,
      },
    ],
  });
  const source = createPrintSource(
    document,
    { ...DEFAULT_PRINT_OPTIONS, trim: "5x8" },
    0.875,
  );
  const image = /#image\([^\n]*width: ([\d.]+)pt, height: ([\d.]+)pt/.exec(
    source,
  )!;
  assert.ok(Number(image[1]) <= (5 - 0.875 - 0.5) * 72);
  assert.ok(Number(image[2]) <= (8 - 1.5) * 72);
});
