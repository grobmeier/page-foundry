/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import assert from "node:assert/strict";
import { it } from "node:test";
import { newNotePath, suggestedNoteFilename } from "../src/notes/model";

it("suggests portable filenames while leaving titles separate and book recognition deliberate", () => {
  for (const [title, kind, expected] of [
    ["A / title: with? symbols#", "plain", "A title with symbols.md"],
    ["Grüße aus Zürich", "letter", "Grüße aus Zürich.md"],
    ["...", "plain", "Untitled.md"],
    ["", "book", "My Book.book.md"],
    ["Valley.book.md", "book", "Valley.book.md"],
    ["Valley.book.md", "plain", "Valley.md"],
    ["CON", "plain", "_CON.md"],
    ["A\nnew\tday", "manuscript", "A new day.md"],
  ]) {
    const name = suggestedNoteFilename(title!, kind!);
    assert.equal(name, expected);
    assert.equal(newNotePath("Writing", name), `Writing/${name}`);
  }
  assert.ok(suggestedNoteFilename("a".repeat(1000), "book").length <= 108);
});
