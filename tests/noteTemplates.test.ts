/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import assert from "node:assert/strict";
import { it } from "node:test";
import type { TFile, Vault } from "obsidian";
import {
  configuredTemplates,
  parseNoteTemplate,
  expandNoteTemplate,
  privateTemplateSource,
} from "../src/notes/templates";
import { createNoteSource, noteProperties } from "../src/notes/model";
import {
  loadNoteTemplates,
  confirmNoteTemplate,
} from "../src/vault/noteTemplates";
const raw =
  "---\ndocument: manuscript\ntitle: '{{title}}'\nauthor: '{{author}}'\nlanguage: '{{language}}'\ncustom: 42\n---\n# {{title}}\n\nBy {{author}} on {{date}}.\n";
it("expands bounded Markdown templates as text, with safely serialised properties", () => {
  const template = parseNoteTemplate(raw, "neutral", "Neutral template");
  const fields = {
    title: "A: [title]",
    author: "Alex *Example*",
    language: "en-GB",
    date: "2026-10-05",
  };
  const source = createNoteSource(expandNoteTemplate(template, fields), fields);
  assert.equal(noteProperties(source).title, fields.title);
  assert.equal(noteProperties(source).custom, "42");
  assert.match(source, /# A: \\\[title\\\]/);
  assert.match(source, /Alex \\\*Example\\\*/);
  assert.throws(
    () =>
      parseNoteTemplate(
        raw.replace("{{title}}", "{{execute()}}"),
        "neutral",
        "Bad",
      ),
    /Unsupported/,
  );
  assert.throws(
    () =>
      parseNoteTemplate(
        raw.replace("custom: 42", "custom: { nested: value }"),
        "neutral",
        "Bad",
      ),
    /scalar/,
  );
  assert.throws(
    () => parseNoteTemplate("x".repeat(128 * 1024 + 1), "neutral", "Bad"),
    /128 KiB/,
  );
});
it("clears personal properties only after an explicit choice, leaving the body visible for review", () => {
  const source =
    "---\ndocument: letter\nauthor: Alex Example\nsender-address: Secret street\nsubject: Private subject\nsalutation: Dear Alex,\n---\nBody still contains Alex Example.\n";
  const cleared = privateTemplateSource(source, true);
  assert.equal(noteProperties(cleared).author, "");
  assert.equal(noteProperties(cleared)["sender-address"], "");
  assert.equal(noteProperties(cleared).salutation, "");
  assert.ok(cleared.includes("Body still contains Alex Example."));
  assert.ok(privateTemplateSource(source, false).includes("Secret street"));
});
it("loads only exact registered template files and rejects missing, changed or oversized templates", async () => {
  const file = {
    path: "Private/Neutral.md",
    basename: "Neutral",
    extension: "md",
    stat: { size: raw.length },
  } as TFile;
  let source = raw;
  const lookups: string[] = [],
    reads: string[] = [];
  const vault = {
    getAbstractFileByPath(path: string) {
      lookups.push(path);
      return path === file.path ? file : null;
    },
    async read(f: TFile) {
      reads.push(f.path);
      return source;
    },
  } as Pick<Vault, "getAbstractFileByPath" | "read">;
  const [loaded] = await loadNoteTemplates(vault, [file.path]);
  assert.deepEqual(lookups, [file.path]);
  assert.deepEqual(reads, [file.path]);
  assert.match(loaded!.template.id, /^custom-[a-f0-9]+$/);
  assert.ok(!loaded!.template.id.includes("Private"));
  await confirmNoteTemplate(vault, loaded!);
  source += "Changed";
  await assert.rejects(() => confirmNoteTemplate(vault, loaded!), /changed/);
  await assert.rejects(
    () => loadNoteTemplates(vault, ["Missing.md"]),
    /not found/,
  );
  for (const paths of [
    ["../outside.md"],
    [file.path, file.path],
    Array(31).fill("same.md"),
  ])
    assert.throws(() => configuredTemplates(paths));
});
