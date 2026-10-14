/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import { writeFile, copyFile, readFile } from "node:fs/promises";
import { constants } from "node:fs";
export async function writeMissing(path, bytes) {
  try {
    await writeFile(path, bytes, { flag: "wx" });
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
}
export async function copyMissing(source, destination) {
  try {
    await copyFile(source, destination, constants.COPYFILE_EXCL);
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
}
export async function enableFoundry(path) {
  let source;
  try {
    source = await readFile(path, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const plugins = source === undefined ? [] : JSON.parse(source);
  if (!Array.isArray(plugins) || !plugins.every((p) => typeof p === "string"))
    throw new Error("Check the enabled-plugin list; it was not changed.");
  if (plugins.includes("page-foundry")) return;
  if (source === undefined)
    return writeMissing(
      path,
      JSON.stringify([...plugins, "page-foundry"]) + "\n",
    );
  if ((await readFile(path, "utf8")) !== source)
    throw new Error(
      "The enabled-plugin list changed during installation. Try again.",
    );
  await writeFile(path, JSON.stringify([...plugins, "page-foundry"]) + "\n");
}
