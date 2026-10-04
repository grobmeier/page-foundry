/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import assert from "node:assert/strict";
import { it } from "node:test";
import { CORE_CATALOG, CORE_PACK } from "../src/packs/core";
import { catalogue } from "../src/packs/model";
import {
  cleanTemplateHistory,
  rankTemplates,
  rememberTemplate,
  searchTemplates,
  templateLibrary,
  MAX_TEMPLATE_HISTORY,
} from "../src/templates/catalog";
import { isBookPlan } from "../src/books/manifest";

it("offers supported purpose-first variants and filters note/book layouts", () => {
  const notes = templateLibrary(CORE_CATALOG, false),
    books = templateLibrary(CORE_CATALOG, true);
  assert.equal(notes.length, 20);
  assert.equal(books.length, 28);
  assert.equal(new Set(books.map((t) => t.key)).size, books.length);
  assert.equal(
    notes.some((t) => t.printOptions),
    false,
  );
  assert.equal(
    books.some(
      (t) => t.preset === "letter" || t.preset === "submission-letter",
    ),
    false,
  );
  const print = books.filter((t) => t.printOptions);
  assert.equal(print.filter((t) => t.printOptions!.recto).length, 6);
  assert.equal(print.filter((t) => !t.printOptions!.recto).length, 6);
  assert.equal(searchTemplates(books, "amazon 6x9 cream").length, 2);
  assert.equal(searchTemplates(notes, "Manuscript US Letter DOCX").length, 1);
  assert.equal(searchTemplates(notes, "general-manuscript").length, 0);
  assert.equal(searchTemplates(notes, "no such template").length, 0);
});
it("ranks by usage then recency; recent excludes unavailable and incompatible templates", () => {
  const library = templateLibrary(CORE_CATALOG, false);
  const letter = library.find((t) => t.preset === "letter")!,
    manuscript = library.find((t) => t.preset === "general-manuscript")!;
  let history = rememberTemplate([], letter, 10);
  history = rememberTemplate(history, letter, 20);
  history = rememberTemplate(history, manuscript, 30);
  assert.equal(rankTemplates(library, history)[0]!.key, letter.key);
  assert.equal(rankTemplates(library, history, true)[0]!.key, manuscript.key);
  assert.equal(
    rankTemplates(templateLibrary(CORE_CATALOG, true), history, true).length,
    1,
  );
  assert.equal(rankTemplates(library, [], true).length, 0);
  assert.equal(
    rankTemplates(
      library,
      [{ key: "missing|pdf|a4|-|-|-", uses: 99, lastUsed: 50 }],
      true,
    ).length,
    0,
  );
  assert.deepEqual(
    history.map((entry) => Object.keys(entry).sort()),
    [
      ["key", "lastUsed", "uses"],
      ["key", "lastUsed", "uses"],
    ],
  );
  const privateCatalog = catalogue(
    [CORE_PACK, { ...CORE_PACK, id: "personal", name: "Personal designs" }],
    "test",
  );
  const custom = templateLibrary(privateCatalog, false).find(
    (t) => t.preset === "personal:plain-document",
  )!;
  const customHistory = rememberTemplate([], custom, 100);
  assert.equal(
    searchTemplates(templateLibrary(privateCatalog, false), "personal").length,
    20,
  );
  assert.equal(rankTemplates(library, customHistory, true).length, 0);
  assert.throws(
    () =>
      templateLibrary(
        { ...CORE_CATALOG, error: "Missing private pack" },
        false,
      ),
    /Missing private pack/,
  );
});
it("bounds history and discards malformed, duplicated and personal fields", () => {
  const rows = Array.from({ length: 100 }, (_, n) => ({
    key: `template-${n}|pdf|a4|-|-|-`,
    uses: 1,
    lastUsed: n,
    metadata: { author: "Not retained" },
    outputName: "Not retained",
  }));
  const cleaned = cleanTemplateHistory(rows);
  assert.equal(cleaned.length, MAX_TEMPLATE_HISTORY);
  assert.equal(cleaned[0]!.lastUsed, 99);
  assert.equal(JSON.stringify(cleaned).includes("Not retained"), false);
  for (const bad of [
    undefined,
    {},
    "old settings",
    [null],
    [{ key: "unsafe/path", uses: 1, lastUsed: 1 }],
    [{ ...rows[0], uses: -1 }],
    [{ ...rows[0], lastUsed: NaN }],
  ])
    assert.deepEqual(cleanTemplateHistory(bad), []);
  assert.equal(cleanTemplateHistory([rows[0], rows[0]]).length, 1);
});
it("recognises explicit book plans without scanning or misclassifying normal notes", () => {
  assert.equal(isBookPlan("# A chapter"), false);
  assert.equal(isBookPlan("---\ntitle: Normal\n---\nText"), false);
  assert.equal(isBookPlan("---\n'page-foundry-book': 1\n---\n"), true);
  assert.equal(isBookPlan("---\npage-foundry-book: invalid\n---\n"), true);
  assert.equal(isBookPlan("broken", "My Book.book"), true);
});
