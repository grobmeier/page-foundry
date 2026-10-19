/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import assert from "node:assert/strict";
import { it } from "node:test";
import { createHash } from "node:crypto";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  rm,
  readdir,
  symlink,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  refreshTestGuide,
  PREVIOUS_GUIDE_HASHES,
} from "../scripts/refresh-test-guide";
import { authorTestExamples } from "../scripts/author-test-examples";

const original = "# Neutral generated fixture\r\n\r\nUnchanged bytes.\r\n";
const known = new Set([createHash("sha256").update(original).digest("hex")]);
async function fixture() {
  const base = await mkdtemp(join(tmpdir(), "foundry-guide-"));
  const vault = join(base, "checkout", ".test-vault");
  const recovery = join(base, "private-recovery");
  await mkdir(vault, { recursive: true });
  const guide = join(vault, "Start here.md");
  await writeFile(guide, original);
  return { base, vault, recovery, guide };
}
it("backs up exact recognised guide bytes, changes only the guide, and is idempotent", async () => {
  const f = await fixture();
  try {
    await writeFile(join(f.vault, "Writing.md"), "Keep every byte.");
    await mkdir(join(f.vault, ".obsidian"));
    await writeFile(
      join(f.vault, ".obsidian", "settings.json"),
      "Keep BRAT and designs.",
    );
    const result = await refreshTestGuide(f.vault, f.recovery, known);
    assert.equal(result.changed, true);
    assert.ok(result.backup);
    assert.equal(
      await readFile(join(result.backup, "Start here.md"), "utf8"),
      original,
    );
    assert.equal(
      await readFile(f.guide, "utf8"),
      (await authorTestExamples()).get("Start here.md"),
    );
    assert.equal(
      await readFile(join(f.vault, "Writing.md"), "utf8"),
      "Keep every byte.",
    );
    assert.equal(
      await readFile(join(f.vault, ".obsidian", "settings.json"), "utf8"),
      "Keep BRAT and designs.",
    );
    assert.deepEqual(await refreshTestGuide(f.vault, f.recovery), {
      changed: false,
    });
    assert.equal((await readdir(f.recovery)).length, 1);
    assert.deepEqual((await readdir(f.vault)).sort(), [
      ".obsidian",
      "Start here.md",
      "Writing.md",
    ]);
  } finally {
    await rm(f.base, { recursive: true, force: true });
  }
});
it("refuses unknown or edited guides without creating a recovery or touching the note", async () => {
  const f = await fixture();
  try {
    await assert.rejects(
      () => refreshTestGuide(f.vault, f.recovery),
      /edits|recognised/,
    );
    await writeFile(f.guide, `${original}Owner edit`);
    await assert.rejects(
      () => refreshTestGuide(f.vault, f.recovery, known),
      /edits|recognised/,
    );
    assert.equal(await readFile(f.guide, "utf8"), `${original}Owner edit`);
    await assert.rejects(() => readdir(f.recovery), /ENOENT/);
    assert.equal(PREVIOUS_GUIDE_HASHES.size, 2);
    assert.ok(
      PREVIOUS_GUIDE_HASHES.has(
        "3bb535a7686fccc4eb04d6159e1e3708160acbfdc904bafaf8801607c3a81eaf",
      ),
    );
  } finally {
    await rm(f.base, { recursive: true, force: true });
  }
});
it("refuses linked guides/vaults and recovery paths in the checkout, including aliases", async () => {
  const f = await fixture();
  try {
    await assert.rejects(
      () =>
        refreshTestGuide(f.vault, join(f.base, "checkout", "backup"), known),
      /outside/,
    );
    const alias = join(f.base, "alias");
    await symlink(join(f.base, "checkout"), alias);
    await assert.rejects(
      () => refreshTestGuide(f.vault, join(alias, "backup"), known),
      /outside/,
    );
    await assert.rejects(
      () => readdir(join(f.base, "checkout", "backup")),
      /ENOENT/,
    );
    const linkedVault = join(f.base, "other", ".test-vault");
    await mkdir(join(f.base, "other"));
    await symlink(f.vault, linkedVault);
    await assert.rejects(
      () => refreshTestGuide(linkedVault, f.recovery, known),
      /ordinary/,
    );
    await rm(f.guide);
    await writeFile(join(f.base, "outside.md"), original);
    await symlink(join(f.base, "outside.md"), f.guide);
    await assert.rejects(
      () => refreshTestGuide(f.vault, f.recovery, known),
      /ordinary/,
    );
    assert.equal(await readFile(join(f.base, "outside.md"), "utf8"), original);
  } finally {
    await rm(f.base, { recursive: true, force: true });
  }
});
