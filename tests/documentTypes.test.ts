/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import assert from "node:assert/strict";
import { it } from "node:test";
import {
  documentKind,
  noteProperties,
  splitNote,
  updateDocumentDetails,
} from "../src/notes/model";

it("changes individual types in both directions without altering body bytes or former properties", () => {
  const source =
    "---\n# Keep this\ndocument: letter\nsender-address: |\n  12 Example Road\n  Example Town\nclosing: ''\nauthor: ''\ncustom: [one, two]\n---\n\r\nDear reader,\r\n\r\nOriginal **writing**.\r\n";
  const manuscript = updateDocumentDetails(source, "manuscript", {
    surname: "Example",
  });
  assert.equal(splitNote(manuscript).body, splitNote(source).body);
  assert.equal(
    noteProperties(manuscript)["sender-address"],
    noteProperties(source)["sender-address"],
  );
  assert.equal(noteProperties(manuscript).closing, "");
  assert.equal(noteProperties(manuscript).author, "");
  assert.match(manuscript, /# Keep this/);
  assert.match(manuscript, /custom: \[\s*one, two\s*\]/);
  const letter = updateDocumentDetails(manuscript, "submission-letter", {
    subject: "Submission",
  });
  assert.equal(noteProperties(letter).surname, "Example");
  assert.equal(splitNote(letter).body, splitNote(source).body);
  assert.equal(documentKind(letter), "submission-letter");
});
it("infers old letters consistently and allows explicit correction of unknown and invalid types", () => {
  assert.equal(documentKind("Body"), "plain");
  assert.equal(documentKind("---\nfrom: Example\n---\nBody"), "letter");
  assert.equal(documentKind("---\nsender-name: Example\n---\nBody"), "letter");
  for (const type of ["unknown", "null", "[letter]", "{kind: letter}", "''"]) {
    const source = `---\ndocument: ${type}\n---\nBody`;
    assert.ok(
      !["plain", "letter", "manuscript"].includes(documentKind(source)),
    );
    assert.equal(
      documentKind(updateDocumentDetails(source, "plain", {})),
      "plain",
    );
  }
  assert.throws(() => updateDocumentDetails("Body", "unknown", {}), /Choose/);
});
it("keeps book plans outside the individual type selector", () => {
  for (const source of [
    "---\ndocument: book\n---\n## Chapter: One\n",
    "---\npage-foundry-book: 1\nentries: []\n---\nPlan",
  ])
    assert.throws(
      () => updateDocumentDetails(source, "plain", {}),
      /reading order/,
    );
});
it("retains edits made to fields before switching to another type", () => {
  const changed = updateDocumentDetails("Untouched prose", "plain", {
    "sender-address": "12 Example Road\nExample Town",
    surname: "Example",
    title: "New title",
  });
  assert.equal(
    noteProperties(changed)["sender-address"],
    "12 Example Road\nExample Town",
  );
  assert.equal(noteProperties(changed).surname, "Example");
  assert.equal(splitNote(changed).body, "Untouched prose");
});
