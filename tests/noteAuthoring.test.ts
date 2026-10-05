/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import assert from "node:assert/strict";
import { it } from "node:test";
import type { TFile, TFolder, Vault } from "obsidian";
import {
  createNoteSource,
  NOTE_TEMPLATES,
  newNotePath,
  noteProperties,
  updateNoteDetails,
  cleanNoteHistory,
  rememberNoteTemplate,
} from "../src/notes/model";
import { createNote, saveNoteDetails } from "../src/vault/notes";
import { parseMarkdown } from "../src/core/markdown";
import { createTypstSource } from "../src/pdf/typstSource";
it("creates a letter with persistent literal addresses and escaped scalar properties", () => {
  const source = createNoteSource(NOTE_TEMPLATES[0]!, {
    title: "A: letter",
    author: "Alex Example",
    "sender-name": "Alex Example",
    "sender-address": "12 Sample Street\nSample Town",
    "recipient-name": "Jamie Example",
    "recipient-address": "40 Example Road\nExample City",
    subject: "An enquiry",
    salutation: "Dear Jamie,",
  });
  assert.match(source, /sender-address: \|-/);
  const details = noteProperties(source);
  assert.equal(details["sender-address"], "12 Sample Street\nSample Town");
  const rendered = createTypstSource(
    parseMarkdown(source, "Letter"),
    "letter",
    "a4",
  );
  for (const value of [
    "12 Sample Street",
    "Sample Town",
    "40 Example Road",
    "Dear Jamie,",
  ])
    assert.ok(rendered.includes(value));
  assert.equal(details.document, "letter");
  assert.ok(
    rendered.includes('#text("Alex Example")\\\n#text("12 Sample Street")'),
  );
  assert.ok(!rendered.includes('#text("Alex Example")\\\\\n'));
});
it("updates known details while preserving comments, arbitrary properties and exact prose", () => {
  const source =
    "---\n# Keep my comment\ntags: [draft, work]\ncustom: 42\ntitle: Original\n---\n\nMy **unaltered** body.\n";
  const changed = updateNoteDetails(source, "plain", {
    title: "Changed",
    author: "",
    language: "en-GB",
  });
  assert.ok(changed.endsWith("\n\nMy **unaltered** body.\n"));
  assert.match(changed, /# Keep my comment/);
  assert.match(changed, /tags: \[\s*draft, work\s*\]/);
  assert.match(changed, /custom: 42/);
  assert.throws(
    () => updateNoteDetails("---\ntitle: a\ntitle: b\n---\nbody", "plain", {}),
    /YAML/,
  );
  assert.throws(
    () => updateNoteDetails(source, "plain", { title: "x".repeat(2001) }),
    /2000/,
  );
});
it("keeps note history separate, bounded and free of personal values", () => {
  const h = rememberNoteTemplate([], "letter", 123);
  assert.deepEqual(h, [{ key: "letter", uses: 1, lastUsed: 123 }]);
  assert.deepEqual(
    cleanNoteHistory([
      { ...h[0], address: "PRIVATE" },
      { key: "bad/path", uses: 1, lastUsed: 1 },
    ]),
    h,
  );
  assert.equal(rememberNoteTemplate(h, "letter", 124)[0]!.uses, 2);
});
it("converts legacy address blocks only on explicit details save", () => {
  const source =
    "---\nfrom: Alex Example\nto: Jamie Example\n---\nUnchanged body.\n";
  const values = {
    title: "Letter",
    "sender-name": "Alex Example",
    "sender-address": "12 Example Street",
    "recipient-name": "Jamie Example",
    "recipient-address": "40 Sample Road",
  };
  assert.equal(
    noteProperties(updateNoteDetails(source, "letter", values)).from,
    "Alex Example",
  );
  const converted = updateNoteDetails(source, "letter", values, true);
  assert.equal(noteProperties(converted).from, undefined);
  assert.equal(noteProperties(converted).to, undefined);
  assert.equal(
    noteProperties(converted)["sender-address"],
    "12 Example Street",
  );
  assert.ok(converted.endsWith("Unchanged body.\n"));
});
it("creates only the named note, requires explicit folders and guards stale or renamed saves", async () => {
  const files = new Map<string, any>(),
    writes: string[] = [];
  let content = "original";
  const vault = {
    getAbstractFileByPath: (path: string) => files.get(path) ?? null,
    createFolder: async (path: string) => {
      const folder = { path, children: [] } as unknown as TFolder;
      files.set(path, folder);
      return folder;
    },
    create: async (path: string, source: string) => {
      if (files.has(path)) throw new Error("Exists");
      const file = { path, extension: "md" } as TFile;
      files.set(path, file);
      writes.push(path);
      content = source;
      return file;
    },
    process: async (_file: TFile, fn: (s: string) => string) => {
      content = fn(content);
      return content;
    },
  } as Pick<
    Vault,
    "getAbstractFileByPath" | "createFolder" | "create" | "process"
  >;
  const path = newNotePath("Drafts", "New Letter");
  await assert.rejects(
    () => createNote(vault, path, "original"),
    /does not exist/,
  );
  const file = await createNote(vault, path, "original", true);
  assert.deepEqual(writes, [path]);
  await assert.rejects(
    () => createNote(vault, path, "replace", true),
    /already exists/,
  );
  await assert.rejects(
    () => saveNoteDetails(vault, file, path, "stale", "overwrite"),
    /nothing was overwritten/,
  );
  assert.equal(content, "original");
  file.path = "Moved.md";
  await assert.rejects(
    () => saveNoteDetails(vault, file, path, "original", "overwrite"),
    /moved/,
  );
  for (const name of ["../outside", "http:bad", "", "Folder/note"])
    assert.throws(() => newNotePath("", name));
});
