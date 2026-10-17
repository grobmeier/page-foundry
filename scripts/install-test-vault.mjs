/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import { lstat, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { authorTestExamples } from "./author-test-examples.ts";
import { writeMissing } from "./test-vault-files.mjs";

// Add neutral content only. BRAT owns the plugin installation and version.
const root = resolve(".test-vault");
await mkdir(root, { recursive: true });
if ((await lstat(root)).isSymbolicLink())
  throw new Error("Use an ordinary test-vault directory.");
for (const [path, value] of await authorTestExamples()) {
  let directory = root;
  for (const segment of path.split("/").slice(0, -1)) {
    directory = resolve(directory, segment);
    await mkdir(directory, { recursive: true });
    if ((await lstat(directory)).isSymbolicLink())
      throw new Error("Example folders cannot be symbolic links.");
  }
  const destination = resolve(root, path);
  try {
    if ((await lstat(destination)).isSymbolicLink())
      throw new Error("An example target is a symbolic link.");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  await writeMissing(destination, value);
}
console.log(
  "Neutral examples added without replacing notes, BRAT, plugin files or settings. Open Start here.md.",
);
