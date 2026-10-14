/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import assert from "node:assert/strict";
import { it } from "node:test";
import {
  NOTE_TEMPLATES,
  createNoteSource,
  updateNoteDetails,
  noteProperties,
} from "../src/notes/model";
import { expandNoteTemplate } from "../src/notes/templates";
import { letterWriting, convertLetterWriting } from "../src/notes/letter";
import { parseMarkdown } from "../src/core/markdown";
import { createTypstSource } from "../src/pdf/typstSource";
import { CORE_CATALOG } from "../src/packs/core";
import { applyPreset, choosePreset, initialMetadata } from "../src/packs/model";
import { templateLibrary } from "../src/templates/catalog";
import {
  noteLayoutKey,
  cleanNoteLayouts,
  rememberNoteLayout,
  defaultLayout,
} from "../src/templates/preferred";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  writeMissing,
  copyMissing,
  enableFoundry,
} from "../scripts/test-vault-files.mjs";

it("creates a body-only letter without duplicated signature properties or empty fields", () => {
  const values = {
    title: "An enquiry",
    "sender-name": "Alex Example",
    "sender-address": "12 Sample Street\nExample Town",
    language: "",
    subject: "",
  };
  const source = createNoteSource(
    expandNoteTemplate(NOTE_TEMPLATES[0]!, values),
    values,
  );
  const properties = noteProperties(source);
  for (const key of ["author", "language", "salutation", "closing", "subject"])
    assert.equal(properties[key], undefined);
  const document = parseMarkdown(source, "Letter"),
    preset = choosePreset(CORE_CATALOG, "letter", "pdf");
  const output = applyPreset(
    document,
    preset,
    "pdf",
    initialMetadata(document, preset),
  );
  const typst = createTypstSource(output, "letter", "a4");
  assert.equal((typst.match(/Yours sincerely,/g) ?? []).length, 1);
  assert.equal((typst.match(/Dear …,/g) ?? []).length, 1);
  assert.equal((typst.match(/Alex Example/g) ?? []).length, 2); // Address and body signature only.
  assert.ok(!typst.includes("{{sender-name}}"));
});
it("keeps explicit blank legacy sign-offs and default legacy address-block output when editing details", () => {
  const source =
    "---\ndocument: letter\nclosing: ''\nsalutation: Dear Jamie,\nauthor: Alex Example\n---\nExisting writing.";
  const edited = updateNoteDetails(source, "letter", {
    ...noteProperties(source),
    "sender-address": "A changed address",
  });
  assert.equal(noteProperties(edited).closing, "");
  const preset = choosePreset(CORE_CATALOG, "letter", "pdf");
  const document = parseMarkdown(edited, "Letter");
  assert.ok(
    !createTypstSource(
      applyPreset(document, preset, "pdf", initialMetadata(document, preset)),
      "letter",
      "a4",
    ).includes("Yours sincerely,"),
  );
  const old =
    "---\nfrom: Alex Example\nto: Jamie Example\n---\nExisting writing.";
  const converted = updateNoteDetails(
    old,
    "letter",
    { "sender-name": "Alex Example", "recipient-name": "Jamie Example" },
    true,
  );
  assert.equal(noteProperties(converted).closing, "Yours sincerely,");
  assert.equal(noteProperties(converted).author, "Alex Example");
  assert.ok(converted.endsWith("Existing writing."));
});
it("previews and explicitly converts legacy writing while retaining addresses and unrelated metadata", () => {
  const original =
    "---\ndocument: submission-letter\nsalutation: Dear Jamie,\nclosing: Kind regards,\nauthor: Alex Example\nfrom: |\n  Alex Example\n  12 Sample Street\nto: Jamie Example\ncustom: retained\n---\nThe original writing.\n";
  const writing = letterWriting(original);
  assert.match(
    writing,
    /Dear Jamie,\n\nThe original writing\.\n\nKind regards,\n\nAlex Example/,
  );
  const converted = convertLetterWriting(original, writing),
    values = noteProperties(converted);
  assert.equal(values.document, "submission-letter");
  assert.equal(values.custom, "retained");
  assert.equal(values["sender-address"], "12 Sample Street\n");
  assert.equal(values.salutation, undefined);
  assert.equal(values.author, undefined);
  assert.throws(() => letterWriting(converted), /already keeps/);
  assert.throws(
    () =>
      convertLetterWriting(
        "---\nfrom: 42\nclosing: Regards\n---\nBody.",
        "Reviewed writing.",
      ),
    /plain text/,
  );
  assert.equal(
    (
      createTypstSource(
        parseMarkdown(converted, "Letter"),
        "letter",
        "a4",
      ).match(/Kind regards,/g) ?? []
    ).length,
    1,
  );
});
it("preserves legacy automatic greeting and sign-off without requiring conversion", () => {
  const document = parseMarkdown(
    "---\ndocument: letter\nsalutation: Dear Jamie,\nclosing: Kind regards,\nauthor: Alex Example\n---\nOnly the body.",
    "Letter",
  );
  const preset = choosePreset(CORE_CATALOG, "letter", "pdf");
  const typst = createTypstSource(
    applyPreset(document, preset, "pdf", initialMetadata(document, preset)),
    "letter",
    "a4",
  );
  assert.equal((typst.match(/Dear Jamie,/g) ?? []).length, 1);
  assert.equal((typst.match(/Kind regards,/g) ?? []).length, 1);
  const old = parseMarkdown(
    "---\nfrom: Alex Example\nto: Jamie Example\n---\nOld writing.",
    "Letter",
  );
  assert.ok(
    createTypstSource(
      applyPreset(old, preset, "pdf", initialMetadata(old, preset)),
      "letter",
      "a4",
    ).includes("Yours sincerely,"),
  );
});
it("chooses kind-aware defaults and retains bounded opaque per-note choices", async () => {
  const library = templateLibrary(CORE_CATALOG, false);
  assert.equal(defaultLayout(library, "letter").preset, "letter");
  assert.equal(
    defaultLayout(library, "manuscript").preset,
    "general-manuscript",
  );
  assert.equal(
    defaultLayout(templateLibrary(CORE_CATALOG, true), "book").preset,
    "plain-document",
  );
  const a = await noteLayoutKey("Drafts/A.md"),
    b = await noteLayoutKey("Drafts/B.md");
  assert.notEqual(a, b);
  const saved = rememberNoteLayout([], a, defaultLayout(library, "letter"));
  assert.ok(!JSON.stringify(saved).includes("Drafts"));
  assert.deepEqual(
    cleanNoteLayouts([
      ...saved,
      { noteKey: "private-path", layoutKey: "invalid" },
    ]),
    saved,
  );
  assert.equal(
    rememberNoteLayout(saved, a, defaultLayout(library, "manuscript")).length,
    1,
  );
});
it("adds fixtures and enabled plugins without replacing edited notes, packs or BRAT", async () => {
  const root = await mkdtemp(join(tmpdir(), "foundry-additive-"));
  try {
    const note = join(root, "Note.md"),
      copy = join(root, "Copy.md"),
      plugins = join(root, "community-plugins.json");
    await writeFile(note, "Owner writing");
    await writeFile(copy, "Owner template");
    await writeFile(plugins, '["obsidian42-brat","another-plugin"]');
    await writeMissing(note, "Fixture");
    await copyMissing(note, copy);
    await enableFoundry(plugins);
    assert.equal(await readFile(note, "utf8"), "Owner writing");
    assert.equal(await readFile(copy, "utf8"), "Owner template");
    assert.deepEqual(JSON.parse(await readFile(plugins, "utf8")), [
      "obsidian42-brat",
      "another-plugin",
      "page-foundry",
    ]);
    await enableFoundry(plugins);
    assert.equal(JSON.parse(await readFile(plugins, "utf8")).length, 3);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
