/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { thirdPartyLicences, licenceFooter } from "./third-party-licences.mjs";

export function releaseVersion(value, base) {
  if (
    !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(base) ||
    (value !== base &&
      (!/^\d+\.\d+\.\d+-beta\.[1-9]\d*$/.test(value ?? "") ||
        value.split("-beta.")[0] !== base))
  )
    throw new Error(
      `Use ${base} or ${base}-beta.N, where N is a positive integer.`,
    );
  return value;
}

export async function prepareRelease(root, version) {
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
  releaseVersion(version, manifest.version);

  const licenceText = await thirdPartyLicences(root);
  const bundle = await readFile(resolve(root, "main.js"), "utf8");
  if (!bundle.trim() || bundle.includes("sourceMappingURL="))
    throw new Error("Build a production plugin without source maps first.");
  if (!bundle.endsWith(`${licenceFooter(licenceText)}\n`))
    throw new Error("Rebuild: production licence footer is missing or stale.");
  const assets = new Map([
    ["main.js", bundle],
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
  console.log(await prepareRelease(root, process.argv[2]));
}
