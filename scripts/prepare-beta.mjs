/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function betaVersion(value, base) {
  if (
    !/^\d+\.\d+\.\d+-beta\.[1-9]\d*$/.test(value ?? "") ||
    value.split("-beta.")[0] !== base
  )
    throw new Error(`Use ${base}-beta.N, where N is a positive integer.`);
  return value;
}

export async function prepareBeta(root, version) {
  const json = async (path) =>
    JSON.parse(await readFile(resolve(root, path), "utf8"));
  const manifest = await json("manifest.json");
  const pkg = await json("package.json");
  const lock = await json("package-lock.json");
  if (
    manifest.id !== "page-foundry" ||
    manifest.version !== pkg.version ||
    pkg.version !== lock.version
  )
    throw new Error("Plugin, package and lockfile versions must match.");
  betaVersion(version, manifest.version);

  // Installed public dependency files only; never inspect any vault/template directory.
  const licences = [
    await readFile(resolve(root, "licenses/Libertinus-OFL.txt"), "utf8"),
    await readFile(resolve(root, "licenses/DejaVu-LICENSE.txt"), "utf8"),
  ];
  for (const [path, dependency] of Object.entries(lock.packages).sort()) {
    if (!path || dependency.dev) continue;
    if (
      !/^node_modules\/(?:@[a-z0-9_.-]+\/)?[a-z0-9_.-]+(?:\/node_modules\/(?:@[a-z0-9_.-]+\/)?[a-z0-9_.-]+)*$/.test(
        path,
      )
    )
      throw new Error(`Unexpected dependency path: ${path}`);
    const directory = resolve(root, path);
    const names = await readdir(directory);
    let selected = names.filter((name) =>
      /^(license|copying|notice)(\.|$)/i.test(name),
    );
    if (!selected.length)
      selected = names.filter((name) => /^readme(?:\.md)?$/i.test(name));
    if (!selected.length) throw new Error(`No licence source for ${path}.`);
    licences.push(`\n## ${path} ${dependency.version}\n`);
    for (const name of selected)
      licences.push(await readFile(resolve(directory, name), "utf8"));
    if (path === "node_modules/@myriaddreamin/typst-ts-web-compiler")
      licences.push(
        await readFile(
          resolve(root, "node_modules/@myriaddreamin/typst.ts/LICENSE"),
          "utf8",
        ),
      );
  }
  const licenceText = licences.join("\n\n");
  const bundle = await readFile(resolve(root, "main.js"), "utf8");
  if (!bundle.trim() || bundle.includes("sourceMappingURL="))
    throw new Error("Build a production plugin without source maps first.");
  const assets = new Map([
    ["main.js", `${bundle}\n/*!\n${licenceText.replaceAll("*/", "* /")}\n*/\n`],
    ["manifest.json", `${JSON.stringify({ ...manifest, version }, null, 2)}\n`],
    ["styles.css", await readFile(resolve(root, "styles.css"), "utf8")],
    ["THIRD_PARTY_LICENSES.txt", licenceText],
  ]);
  for (const name of ["LICENSE", "NOTICE", "THIRD_PARTY_NOTICES.md"])
    assets.set(name, await readFile(resolve(root, name), "utf8"));
  assets.set(
    "SHA256SUMS",
    [...assets]
      .map(
        ([name, bytes]) =>
          `${createHash("sha256").update(bytes).digest("hex")}  ${name}`,
      )
      .join("\n") + "\n",
  );
  await mkdir(resolve(root, "dist"), { recursive: true });
  const destination = resolve(root, "dist", version);
  // A release package is immutable: never silently replace an earlier package.
  await mkdir(destination);
  for (const [name, bytes] of assets)
    await writeFile(resolve(destination, name), bytes, { flag: "wx" });
  return destination;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const root = fileURLToPath(new URL("../", import.meta.url));
  console.log(await prepareBeta(root, process.argv[2]));
}
