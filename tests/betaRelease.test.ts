/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import assert from "node:assert/strict";
import { it } from "node:test";
import { betaVersion, prepareBeta } from "../scripts/prepare-beta.mjs";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  readdir,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

it("accepts only a matching numbered beta and rejects path-like release names", () => {
  assert.equal(betaVersion("0.1.0-beta.1", "0.1.0"), "0.1.0-beta.1");
  for (const name of [
    "0.1.0",
    "0.1.0-beta.0",
    "0.1.0-beta.01",
    "0.2.0-beta.1",
    "../beta",
    "0.1.0-beta.1/extra",
  ])
    assert.throws(() => betaVersion(name, "0.1.0"), /Use/);
});

it("stages only explicit beta assets, retains the root manifest and refuses replacement", async () => {
  const root = await mkdtemp(join(tmpdir(), "page-foundry-beta-test-"));
  try {
    await mkdir(join(root, "licenses"));
    const manifest = {
      id: "page-foundry",
      version: "0.1.0",
      isDesktopOnly: false,
    };
    const fixtures = {
      "manifest.json": JSON.stringify(manifest),
      "package.json": JSON.stringify({ version: "0.1.0" }),
      "package-lock.json": JSON.stringify({ version: "0.1.0", packages: {} }),
      "main.js": "module.exports = class Plugin {};",
      "styles.css": ".test {}",
      LICENSE: "Fixture licence",
      NOTICE: "Fixture notice",
      "THIRD_PARTY_NOTICES.md": "Fixture dependency notice",
      "licenses/Libertinus-OFL.txt": "Fixture font licence",
      "private-template.md": "This must never be included",
    };
    for (const [path, bytes] of Object.entries(fixtures))
      await writeFile(join(root, path), bytes);
    const destination = await prepareBeta(root, "0.1.0-beta.1");
    assert.deepEqual(
      (await readdir(destination)).sort(),
      [
        "LICENSE",
        "NOTICE",
        "SHA256SUMS",
        "THIRD_PARTY_LICENSES.txt",
        "THIRD_PARTY_NOTICES.md",
        "main.js",
        "manifest.json",
        "styles.css",
      ].sort(),
    );
    assert.equal(
      JSON.parse(await readFile(join(destination, "manifest.json"), "utf8"))
        .version,
      "0.1.0-beta.1",
    );
    assert.equal(
      JSON.parse(await readFile(join(root, "manifest.json"), "utf8")).version,
      "0.1.0",
    );
    assert.match(
      await readFile(join(destination, "main.js"), "utf8"),
      /Fixture font licence/,
    );
    for (const line of (await readFile(join(destination, "SHA256SUMS"), "utf8"))
      .trim()
      .split("\n")) {
      const [hash, name] = line.split("  ");
      assert.equal(
        createHash("sha256")
          .update(await readFile(join(destination, name!)))
          .digest("hex"),
        hash,
      );
    }
    await assert.rejects(prepareBeta(root, "0.1.0-beta.1"), /EEXIST/);
    await writeFile(join(root, "main.js"), "//# sourceMappingURL=private.map");
    await assert.rejects(
      prepareBeta(root, "0.1.0-beta.2"),
      /without source maps/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
