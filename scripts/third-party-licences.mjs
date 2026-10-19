/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

/** Deterministic, installed public dependencies only. Never read vault files. */
export async function thirdPartyLicences(root) {
  const lock = JSON.parse(
    await readFile(resolve(root, "package-lock.json"), "utf8"),
  );
  const licences = [];
  for (const path of [
    "LICENSE",
    "NOTICE",
    "THIRD_PARTY_NOTICES.md",
    "licenses/Libertinus-OFL.txt",
    "licenses/DejaVu-LICENSE.txt",
  ])
    licences.push(await readFile(resolve(root, path), "utf8"));
  for (const [path, dependency] of Object.entries(lock.packages).sort()) {
    if (!path || dependency.dev) continue;
    if (
      !/^node_modules\/(?:@[a-z0-9_.-]+\/)?[a-z0-9_.-]+(?:\/node_modules\/(?:@[a-z0-9_.-]+\/)?[a-z0-9_.-]+)*$/.test(
        path,
      )
    )
      throw new Error(`Unexpected dependency path: ${path}`);
    const directory = resolve(root, path);
    const names = (await readdir(directory)).sort();
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
  return licences.join("\n\n");
}

export function licenceFooter(text) {
  return `/*! Page Foundry bundled licences and notices\n${text.replaceAll("*/", "* /")}\n*/`;
}
