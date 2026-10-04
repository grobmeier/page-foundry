/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import assert from "node:assert/strict";
import { it } from "node:test";
import type { TFile, Vault } from "obsidian";
import {
  bookPlanPath,
  editableBook,
  moveBookEntry,
  newBookEntry,
  serializeBookPlan,
} from "../src/books/editor";
import { parseBookManifest } from "../src/books/manifest";
import { saveBookPlan } from "../src/vault/bookPlan";
import { bookManifest } from "./fixtures/book";

it("edits ordered sections without changing IDs, extra metadata or explanatory prose", () => {
  const book = editableBook(bookManifest);
  const original = structuredClone(book);
  book.metadata.identifier = "urn:example:retained";
  moveBookEntry(book, 1, 1);
  assert.equal(book.entries[2]!.id, original.entries[1]!.id);
  assert.equal(book.entries[1]!.id, original.entries[2]!.id);
  moveBookEntry(book, -1, 1);
  moveBookEntry(book, 0, -1);
  const serialized = serializeBookPlan(book, bookManifest);
  const restored = parseBookManifest(serialized);
  assert.deepEqual(restored, book);
  const body = bookManifest.replace(/^---\n[\s\S]*?\n---\n/, "");
  assert.ok(serialized.endsWith(body));
  assert.deepEqual(editableBook(bookManifest), original);
});
it("generates hidden stable IDs and validates author-editable book fields", () => {
  const book = editableBook();
  book.entries.push(
    { ...newBookEntry("part", "neutral-part"), title: "First Part" },
    { ...newBookEntry("chapter", "neutral-chapter"), path: "Book/One.md" },
  );
  assert.equal(
    parseBookManifest(serializeBookPlan(book)).entries[0]!.id,
    "section-neutral-part",
  );
  book.entries[1]!.path = "../outside.md";
  assert.throws(() => serializeBookPlan(book), /section 2/);
  assert.throws(() => serializeBookPlan(editableBook()), /between 1 and 50/);
  for (const path of [
    "../outside.md",
    "/book.md",
    "Book\\Plan.md",
    "https://example.com/plan.md",
    "",
    "book.pdf",
    "Book/%2e.md",
  ])
    assert.throws(() => bookPlanPath(path));
  assert.equal(bookPlanPath("Book/My Plan.book.md"), "Book/My Plan.book.md");
});
function host() {
  const plan = { path: "My Book.book.md", extension: "md" } as TFile;
  const chapter = { path: "Book/One.md", extension: "md" } as TFile;
  const files = new Map<string, TFile>([[chapter.path, chapter]]);
  const lookups: string[] = [],
    writes: string[] = [];
  let current = "original";
  const vault = {
    getAbstractFileByPath(path: string) {
      lookups.push(path);
      return files.get(path) ?? null;
    },
    async create(path: string, source: string) {
      if (files.has(path)) throw new Error("Exists");
      current = source;
      files.set(path, plan);
      writes.push(path);
      return plan;
    },
    async process(file: TFile, fn: (source: string) => string) {
      current = fn(current);
      writes.push(file.path);
      return current;
    },
  } as Pick<Vault, "getAbstractFileByPath" | "create" | "process">;
  const book = editableBook();
  book.entries = [
    { ...newBookEntry("chapter", "neutral"), path: chapter.path },
  ];
  return {
    vault,
    plan,
    book,
    files,
    lookups,
    writes,
    current: () => current,
    change: (source: string) => {
      current = source;
    },
  };
}
it("creates only the explicitly named plan, never replaces an existing file or scans the vault", async () => {
  const h = host();
  await saveBookPlan(h.vault, h.plan.path, h.book);
  assert.deepEqual(h.writes, [h.plan.path]);
  assert.deepEqual(h.lookups, ["Book/One.md", h.plan.path]);
  await assert.rejects(
    () => saveBookPlan(h.vault, h.plan.path, h.book),
    /already exists/,
  );
  h.book.entries[0]!.path = "Book/Missing.md";
  await assert.rejects(
    () => saveBookPlan(h.vault, "Other.book.md", h.book),
    /Note not found/,
  );
  assert.equal(h.writes.length, 1);
});
it("atomically rejects stale, removed, renamed and self-including plans", async () => {
  const h = host();
  h.files.set(h.plan.path, h.plan);
  const snapshot = { file: h.plan, source: "original" };
  h.change("changed elsewhere");
  await assert.rejects(
    () => saveBookPlan(h.vault, h.plan.path, h.book, snapshot),
    /nothing was overwritten/,
  );
  assert.equal(h.current(), "changed elsewhere");
  assert.equal(h.writes.length, 0);
  h.change("original");
  await saveBookPlan(h.vault, h.plan.path, h.book, snapshot);
  assert.equal(
    parseBookManifest(h.current()).entries[0]!.id,
    h.book.entries[0]!.id,
  );
  await assert.rejects(
    () => saveBookPlan(h.vault, "Other.book.md", h.book, snapshot),
    /moved or removed/,
  );
  h.files.delete(h.plan.path);
  await assert.rejects(
    () => saveBookPlan(h.vault, h.plan.path, h.book, snapshot),
    /moved or removed/,
  );
  h.book.entries[0]!.path = h.plan.path;
  await assert.rejects(
    () => saveBookPlan(h.vault, h.plan.path, h.book),
    /own book plan/,
  );
});
