/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import { createHash, randomUUID } from "node:crypto";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { authorTestExamples } from "./author-test-examples";

// Exact, unchanged neutral guides from the published beta.6 and beta.7 sources.
export const PREVIOUS_GUIDE_HASHES = new Set([
  "3bb535a7686fccc4eb04d6159e1e3708160acbfdc904bafaf8801607c3a81eaf",
  "b9a2ff4670ad1b7c5be87a944d1a118d4666d4c022e1a2b52993ce67804cc996",
]);
const hash = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");

/** Refresh only recognised generated guidance. Never install a plugin or reset notes. */
export async function refreshTestGuide(
  vaultInput: string,
  recoveryInput: string,
  recognisedHashes: ReadonlySet<string> = PREVIOUS_GUIDE_HASHES,
): Promise<{ changed: boolean; backup?: string }> {
  const selected = resolve(vaultInput);
  if (
    basename(selected) !== ".test-vault" ||
    !(await lstat(selected)).isDirectory() ||
    (await lstat(selected)).isSymbolicLink()
  )
    throw new Error("Select the dedicated ordinary .test-vault directory.");
  const vault = await realpath(selected);
  const target = join(vault, "Start here.md");
  const originalStat = await lstat(target);
  if (
    !originalStat.isFile() ||
    originalStat.isSymbolicLink() ||
    originalStat.nlink !== 1
  )
    throw new Error("The guide must be an ordinary, unlinked file.");
  const original = await readFile(target);
  const next = Buffer.from(
    String((await authorTestExamples()).get("Start here.md")),
  );
  if (original.equals(next)) return { changed: false };
  if (!recognisedHashes.has(hash(original)))
    throw new Error(
      "The guide has edits or is not a recognised generated version. Nothing was replaced.",
    );
  const recoverySelected = resolve(recoveryInput);
  // Check the selected and resolved recovery paths before writing a backup.
  const outside = relative(dirname(vault), recoverySelected);
  if (
    !outside.startsWith(`..${sep}`) ||
    recoverySelected === dirname(dirname(vault))
  )
    throw new Error(
      "Choose a dedicated private recovery folder outside the checkout.",
    );
  const prospective = join(
    await realpath(dirname(recoverySelected)),
    basename(recoverySelected),
  );
  if (!relative(dirname(vault), prospective).startsWith(`..${sep}`))
    throw new Error("Recovery must resolve outside the checkout.");
  await mkdir(recoverySelected, { recursive: true, mode: 0o700 });
  if ((await lstat(recoverySelected)).isSymbolicLink())
    throw new Error("Recovery folders cannot be symbolic links.");
  const recovery = await realpath(recoverySelected);
  if (!relative(dirname(vault), recovery).startsWith(`..${sep}`))
    throw new Error("Recovery must resolve outside the checkout.");
  const backup = await mkdtemp(join(recovery, "guide-refresh-"));
  await writeFile(join(backup, "Start here.md"), original, {
    flag: "wx",
    mode: 0o600,
  });
  if (!(await readFile(join(backup, "Start here.md"))).equals(original))
    throw new Error("The guide backup did not verify. Nothing was replaced.");
  const temporary = join(vault, `.page-foundry-guide-${randomUUID()}.tmp`);
  await writeFile(temporary, next, { flag: "wx", mode: 0o600 });
  try {
    const current = await lstat(target);
    if (
      !current.isFile() ||
      current.isSymbolicLink() ||
      current.ino !== originalStat.ino ||
      current.nlink !== 1 ||
      !(await readFile(target)).equals(original)
    )
      throw new Error(
        "The guide changed during refresh. Nothing was replaced; its original backup was retained.",
      );
    await rename(temporary, target);
  } finally {
    await unlink(temporary).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
  return { changed: true, backup };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  if (process.argv[2] !== "--refresh-generated-guide")
    throw new Error("Guide refresh must be explicitly requested.");
  const result = await refreshTestGuide(
    ".test-vault",
    "../page-foundry-test-vault-recovery",
  );
  console.log(
    result.changed
      ? `Guide refreshed; previous guide backed up at ${result.backup}.`
      : "The generated guide is already current.",
  );
  console.log(
    "Save pending edits, fully reload Obsidian (not just the plugin), then reopen Start here and check its example links. BRAT and plugin files were not changed.",
  );
}
