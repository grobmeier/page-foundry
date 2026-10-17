/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import assert from "node:assert/strict";
import { it } from "node:test";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  readdir,
  rm,
  symlink,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { authorTestExamples } from "../scripts/author-test-examples";
import { prepareAuthorTestVault } from "../scripts/prepare-author-test-vault";
import { parseBookManifest } from "../src/books/manifest";
import { parseMarkdown } from "../src/core/markdown";
import { imageNodes, localImagePath } from "../src/core/images";
import { parsePack } from "../src/packs/model";
import { parseNoteTemplate } from "../src/notes/templates";

it("provides all note types, book roles, valid packs and local image targets without old installation guides", async () => {
  const files = await authorTestExamples();
  for (const name of [
    "Letter",
    "Submission letter",
    "Manuscript",
    "Plain document",
  ])
    assert.ok(files.has(`Examples/Writing/${name}.md`));
  const book = parseBookManifest(
    String(files.get("Examples/Book/Reading order.book.md")),
  );
  assert.deepEqual(
    new Set(book.entries.map((e) => e.role)),
    new Set(["front-matter", "part", "chapter", "scene", "back-matter"]),
  );
  for (const entry of book.entries)
    if (entry.path) assert.ok(files.has(entry.path), entry.path);
  for (const [path, source] of files) {
    if (
      typeof source !== "string" ||
      !path.endsWith(".md") ||
      path.includes("Expected errors") ||
      path.includes("Customise")
    )
      continue;
    for (const node of imageNodes(parseMarkdown(source, path)))
      assert.ok(files.has(localImagePath(node.url)), node.url);
  }
  parseNoteTemplate(
    String(files.get("Examples/Customise/Letter starter.md")),
    "example",
    "Letter starter",
  );
  for (const name of ["Example output styles", "Example book design"])
    assert.ok(parsePack(String(files.get(`Examples/Customise/${name}.json`))));
  const guide = String(files.get("Start here.md"));
  for (const term of [
    "5 × 8",
    "5.5 × 8.5",
    "6 × 9",
    "white/cream",
    "DOCX",
    "EPUB",
    "A4",
    "US Letter",
    "Offline",
    "Expected errors",
  ])
    assert.ok(guide.toLowerCase().includes(term.toLowerCase()), term);
  assert.doesNotMatch(
    guide,
    /legacy installation|convert to readable book plan/iu,
  );
});

async function fixture() {
  const base = await mkdtemp(join(tmpdir(), "foundry-fresh-vault-"));
  const vault = join(base, "checkout", ".test-vault"),
    recovery = join(base, "private-recovery");
  const put = async (path: string, bytes: string) => {
    await mkdir(dirname(join(vault, path)), { recursive: true });
    await writeFile(join(vault, path), bytes);
  };
  await put(
    ".obsidian/plugins/page-foundry/data.json",
    JSON.stringify({
      packManifestPath: "Designs/keep.json",
      noteTemplatePaths: ["Designs/keep.md"],
    }),
  );
  await put(
    ".obsidian/plugins/page-foundry/manifest.json",
    '{"version":"0.1.0-beta.6"}',
  );
  await put(
    ".obsidian/plugins/obsidian42-brat/data.json",
    '{"fixture":"private settings stay byte-identical"}',
  );
  await put(
    ".obsidian/community-plugins.json",
    '["obsidian42-brat","page-foundry"]',
  );
  await put("Designs/keep.json", "{}");
  await put(
    "Designs/keep.md",
    "---\ndocument: letter\n---\n\nKeep my private starting text.",
  );
  await put("Edited.md", "Edited note, keep every byte.\r\n");
  await put("Archive/old/Report.txt", "Old recoverable report");
  await put("Page Foundry/old.pdf", "%PDF-fixture");
  return { base, vault, recovery, put };
}
it("archives old content outside the checkout while preserving installed BRAT, settings and templates", async () => {
  const f = await fixture();
  try {
    const paths = [
      ".obsidian/plugins/page-foundry/data.json",
      ".obsidian/plugins/page-foundry/manifest.json",
      ".obsidian/plugins/obsidian42-brat/data.json",
      ".obsidian/community-plugins.json",
      "Designs/keep.json",
      "Designs/keep.md",
    ];
    const before = await Promise.all(
      paths.map((p) => readFile(join(f.vault, p))),
    );
    const result = await prepareAuthorTestVault(f.vault, f.recovery);
    assert.deepEqual(await readdir(f.vault), [
      ".obsidian",
      "Designs",
      "Examples",
      "Start here.md",
    ]);
    for (let i = 0; i < paths.length; i++)
      assert.deepEqual(await readFile(join(f.vault, paths[i]!)), before[i]);
    assert.equal(
      await readFile(join(result.recovery, "previous-vault/Edited.md"), "utf8"),
      "Edited note, keep every byte.\r\n",
    );
    const manifest = JSON.parse(
      await readFile(join(result.recovery, "recovery.json"), "utf8"),
    );
    assert.equal(manifest.status, "complete");
    assert.equal(manifest.previous["Edited.md"][""].length, 64);
    assert.ok(!manifest.moved.includes(".obsidian"));
    assert.ok(!manifest.moved.includes("Designs"));
    // A second explicitly requested reset creates another recovery, never overwrites.
    const again = await prepareAuthorTestVault(f.vault, f.recovery);
    assert.notEqual(again.recovery, result.recovery);
    assert.equal(
      await readFile(join(result.recovery, "previous-vault/Edited.md"), "utf8"),
      "Edited note, keep every byte.\r\n",
    );
  } finally {
    await rm(f.base, { recursive: true, force: true });
  }
});

it("adds examples without reinstalling the plugin or overwriting edited example notes", async () => {
  const f = await fixture();
  try {
    await f.put("Examples/Writing/Letter.md", "My edited example must stay.");
    const plugin = await readFile(
      join(f.vault, ".obsidian/plugins/page-foundry/manifest.json"),
    );
    const brat = await readFile(
      join(f.vault, ".obsidian/plugins/obsidian42-brat/data.json"),
    );
    const run = spawnSync(
      process.execPath,
      [
        "--import",
        import.meta.resolve("tsx"),
        fileURLToPath(
          new URL("../scripts/install-test-vault.mjs", import.meta.url),
        ),
      ],
      { cwd: dirname(f.vault), encoding: "utf8" },
    );
    assert.equal(run.status, 0, run.stderr);
    assert.equal(
      await readFile(join(f.vault, "Examples/Writing/Letter.md"), "utf8"),
      "My edited example must stay.",
    );
    assert.deepEqual(
      await readFile(
        join(f.vault, ".obsidian/plugins/page-foundry/manifest.json"),
      ),
      plugin,
    );
    assert.deepEqual(
      await readFile(
        join(f.vault, ".obsidian/plugins/obsidian42-brat/data.json"),
      ),
      brat,
    );
  } finally {
    await rm(f.base, { recursive: true, force: true });
  }
});
it("retains registered templates in non-default folders and their image resources", async () => {
  const f = await fixture();
  try {
    await f.put(
      ".obsidian/plugins/page-foundry/data.json",
      JSON.stringify({ noteTemplatePaths: ["Examples/template.md"] }),
    );
    await f.put(
      "Examples/template.md",
      "---\ndocument: letter\n---\n\n![Artwork](Custom%20assets/panel.png)",
    );
    await f.put("Custom assets/panel.png", "Original resource bytes");
    const result = await prepareAuthorTestVault(f.vault, f.recovery);
    assert.equal(result.exampleFolder, "Page Foundry Examples");
    assert.equal(
      await readFile(join(f.vault, "Custom assets/panel.png"), "utf8"),
      "Original resource bytes",
    );
    assert.ok(
      (await readFile(join(f.vault, "Start here.md"), "utf8")).includes(
        "Page Foundry Examples/Book",
      ),
    );
  } finally {
    await rm(f.base, { recursive: true, force: true });
  }
});
it("rejects a personal vault, an in-checkout recovery target and symbolic links before moving content", async () => {
  const f = await fixture();
  try {
    await assert.rejects(
      prepareAuthorTestVault(join(f.base, "Personal"), f.recovery),
      /dedicated/,
    );
    await assert.rejects(
      prepareAuthorTestVault(f.vault, join(f.vault, "Archive")),
      /outside/,
    );
    await symlink(join(f.base, "outside"), join(f.vault, "linked"));
    await assert.rejects(
      prepareAuthorTestVault(f.vault, f.recovery),
      /symbolic/,
    );
    assert.equal(
      await readFile(join(f.vault, "Edited.md"), "utf8"),
      "Edited note, keep every byte.\r\n",
    );
  } finally {
    await rm(f.base, { recursive: true, force: true });
  }
});
