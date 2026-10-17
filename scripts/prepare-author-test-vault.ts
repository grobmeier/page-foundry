/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  lstat,
  rename,
  writeFile,
  chmod,
} from "node:fs/promises";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { fileURLToPath } from "node:url";
import { authorTestExamples } from "./author-test-examples";
import { parseMarkdown } from "../src/core/markdown";
import { imageNodes, localImagePath } from "../src/core/images";

type Snapshot = Record<string, string>;
async function snapshot(path: string, prefix = ""): Promise<Snapshot> {
  const stat = await lstat(path);
  if (stat.isSymbolicLink())
    throw new Error(
      "The test vault contains a symbolic link; review it before resetting.",
    );
  if (stat.isDirectory()) {
    const result: Snapshot = {};
    for (const name of (await readdir(path)).sort())
      Object.assign(
        result,
        await snapshot(join(path, name), `${prefix}${name}/`),
      );
    return result;
  }
  if (!stat.isFile())
    throw new Error("Only ordinary files and folders can be archived.");
  return {
    [prefix.replace(/\/$/u, "")]: createHash("sha256")
      .update(await readFile(path))
      .digest("hex"),
  };
}
function equal(a: Snapshot, b: Snapshot): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
async function settings(path: string): Promise<Record<string, unknown>> {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
}
function protectedRoot(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return;
  const path = value.trim();
  if (
    isAbsolute(path) ||
    /[\\:\u0000-\u001f]/u.test(path) ||
    path.split("/").some((p) => !p || p === "." || p === "..")
  )
    throw new Error(
      "Review configured template/design paths before resetting the test vault.",
    );
  return path.split("/")[0];
}

/** Explicit, recoverable content reset. Never installs a plugin or changes settings. */
export async function prepareAuthorTestVault(
  vaultInput: string,
  recoveryInput: string,
) {
  const vault = resolve(vaultInput),
    recoveryRoot = resolve(recoveryInput);
  if (
    basename(vault) !== ".test-vault" ||
    (await lstat(vault)).isSymbolicLink()
  )
    throw new Error("Select the dedicated .test-vault, not a personal vault.");
  const repository = dirname(vault);
  const outside = relative(repository, recoveryRoot);
  if (!outside.startsWith(`..${sep}`) || recoveryRoot === dirname(repository))
    throw new Error(
      "Choose a dedicated private recovery directory outside the checkout.",
    );
  await snapshot(join(vault, ".obsidian")); // Reject links before reading configuration through it.
  const config = await settings(
    join(vault, ".obsidian/plugins/page-foundry/data.json"),
  );
  const retained = new Set([".obsidian", "Designs", "Artwork"]);
  for (const value of [
    config.packManifestPath,
    ...(Array.isArray(config.noteTemplatePaths)
      ? config.noteTemplatePaths
      : []),
  ]) {
    const root = protectedRoot(value);
    if (root) retained.add(root);
  }
  for (const path of Array.isArray(config.noteTemplatePaths)
    ? config.noteTemplatePaths
    : []) {
    if (typeof path !== "string") continue;
    // Only explicitly configured templates and their explicit local image roots.
    await snapshot(join(vault, protectedRoot(path)!));
    const template = parseMarkdown(
      await readFile(join(vault, path), "utf8"),
      "Configured template",
    );
    for (const node of imageNodes(template)) {
      try {
        const root = protectedRoot(localImagePath(node.url));
        if (root) retained.add(root);
      } catch {
        /* Invalid/remote references remain unchanged, never fetched. */
      }
    }
  }
  const folder = retained.has("Examples")
    ? "Page Foundry Examples"
    : "Examples";
  if (retained.has(folder) || retained.has("Start here.md"))
    throw new Error(
      "A configured template occupies the new walkthrough path. Review its location first.",
    );
  const entries = (await readdir(vault)).sort();
  const names = entries.filter((name) => !retained.has(name));
  const originals = new Map<string, Snapshot>();
  for (const name of names)
    originals.set(name, await snapshot(join(vault, name)));
  // Validate protected trees too; never follow a resource out of the selected vault.
  const protectedBefore = new Map<string, Snapshot>();
  for (const name of entries.filter((n) => retained.has(n))) {
    // Obsidian may update workspace state while its watcher handles the new notes.
    if (name === ".obsidian") {
      for (const file of ["plugins", "community-plugins.json"]) {
        try {
          protectedBefore.set(
            `.obsidian/${file}`,
            await snapshot(join(vault, ".obsidian", file)),
          );
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
      }
    } else protectedBefore.set(name, await snapshot(join(vault, name)));
  }
  const examples = await authorTestExamples(folder);
  await mkdir(recoveryRoot, { recursive: true, mode: 0o700 });
  if ((await lstat(recoveryRoot)).isSymbolicLink())
    throw new Error("Recovery directory cannot be a symbolic link.");
  await chmod(recoveryRoot, 0o700);
  const recovery = await mkdtemp(
    join(recoveryRoot, `${new Date().toISOString().slice(0, 10)}-`),
  );
  const old = join(recovery, "previous-vault"),
    fresh = join(recovery, "new-examples");
  await mkdir(old);
  await mkdir(fresh);
  for (const [path, value] of examples) {
    await mkdir(dirname(join(fresh, path)), { recursive: true });
    await writeFile(join(fresh, path), value, { flag: "wx", mode: 0o600 });
  }
  const manifest = {
    vault,
    status: "prepared",
    retained: [...retained],
    moved: [] as string[],
    previous: Object.fromEntries(originals),
    created: [...examples.keys()],
    restore:
      "Close Obsidian. Move the fresh Start here.md and example folder aside; move each previous-vault top-level entry back to the original vault path. Do not replace .obsidian or retained designs/templates. Keep this recovery copy until acceptance.",
  };
  const record = () =>
    writeFile(
      join(recovery, "recovery.json"),
      JSON.stringify(manifest, null, 2) + "\n",
      { mode: 0o600 },
    );
  await record();
  for (const [path, hash] of protectedBefore)
    if (!equal(hash, await snapshot(join(vault, path))))
      throw new Error("Protected settings changed; no content was moved.");
  for (const name of names)
    if (!equal(originals.get(name)!, await snapshot(join(vault, name))))
      throw new Error(
        "A note changed; no content was moved. Retry after saving it.",
      );
  try {
    for (const name of names) {
      await rename(join(vault, name), join(old, name));
      manifest.moved.push(name);
      await record();
      if (!equal(originals.get(name)!, await snapshot(join(old, name))))
        throw new Error("Recovery checksum did not match.");
    }
    // No overwrite: the two targets must be absent after the reviewed moves.
    for (const name of ["Start here.md", folder]) {
      try {
        await lstat(join(vault, name));
        throw new Error(
          "An example target appeared during cleanup; nothing was replaced.",
        );
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
    await rename(join(fresh, folder), join(vault, folder));
    await rename(join(fresh, "Start here.md"), join(vault, "Start here.md"));
    for (const [path, hash] of protectedBefore)
      if (!equal(hash, await snapshot(join(vault, path))))
        throw new Error(
          "Protected settings changed externally; recovery and all old content remain available.",
        );
    for (const [path, value] of examples)
      if (
        !Buffer.from(await readFile(join(vault, path))).equals(
          Buffer.from(value),
        )
      )
        throw new Error("An installed example changed during setup.");
    manifest.status = "complete";
    await record();
    return {
      recovery,
      exampleFolder: folder,
      movedEntries: names.length,
      files: examples.size,
    };
  } catch (error) {
    manifest.status =
      "incomplete - preserve recovery and inspect before retrying";
    await record();
    // Never remove or overwrite a file that appeared after moving an original.
    throw new Error(
      `Setup stopped. All moved originals are recoverable in ${recovery}. ${error instanceof Error ? error.message : "Review recovery.json."}`,
    );
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  if (process.argv.slice(2).join(" ") !== "--reset-selected-test-vault")
    throw new Error(
      "An explicit --reset-selected-test-vault is required. This moves existing test content to private recovery storage.",
    );
  const root = fileURLToPath(new URL("../", import.meta.url));
  const result = await prepareAuthorTestVault(
    join(root, ".test-vault"),
    join(dirname(root), "page-foundry-test-vault-recovery"),
  );
  console.log(JSON.stringify(result, null, 2));
}
