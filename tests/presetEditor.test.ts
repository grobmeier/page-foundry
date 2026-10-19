/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import assert from "node:assert/strict";
import { it } from "node:test";
import type { TFile, Vault } from "obsidian";
import { CORE_PACK } from "../src/packs/core";
import { editablePreset, updatedPack } from "../src/packs/editor";
import { parsePack } from "../src/packs/model";
import type * as PresetEditorModule from "../src/vault/presetEditor";
import { vaultModule, TestVaultFile } from "./helpers/vaultModule";
const { readEditablePack, saveEditablePack, editablePackPath } = vaultModule<
  typeof PresetEditorModule
>("src/vault/presetEditor.ts");
it("creates validated local presets and applies only format-compatible overrides", () => {
  const base = CORE_PACK.presets.find((p) => p.id === "readable-plain")!;
  const before = structuredClone(base);
  const preset = editablePreset(base, "neutral", {
    name: "Neutral layout",
    bodySizePt: 13,
    lineSpacing: 1.7,
    fonts: { docx: "Arial", epub: "serif" },
  });
  const pack = parsePack(updatedPack(undefined, preset));
  assert.equal(pack.presets[0]!.outputs.pdf!.style!.bodySizePt, 13);
  assert.equal(pack.presets[0]!.outputs.docx!.style!.font, "Arial");
  assert.equal(pack.presets[0]!.outputs.epub!.style!.bodySizePt, undefined);
  assert.deepEqual(base, before);
  assert.throws(
    () =>
      updatedPack(
        undefined,
        editablePreset(base, "neutral", { name: "Bad", bodySizePt: 99 }),
      ),
    /range/,
  );
  assert.throws(() => updatedPack(CORE_PACK, preset), /Core/);
  const extended = parsePack(
    updatedPack(pack, { ...preset, id: "second", name: "Second layout" }),
  );
  const edited = parsePack(
    updatedPack(extended, { ...preset, name: "Changed" }),
  );
  assert.equal(edited.presets.length, 2);
  assert.equal(edited.version, "1.0.2");
  assert.equal(edited.presets[1]!.name, "Second layout");
});
it("guards output pack saves against existing, stale, moved and incompatible files", async () => {
  const preset = editablePreset(CORE_PACK.presets[0]!, "neutral", {
    name: "Neutral",
  });
  let source = updatedPack(undefined, preset);
  const file = Object.assign(new TestVaultFile(), {
    path: "Neutral.json",
    extension: "json",
    stat: { size: source.length },
  }) as TFile;
  const files = new Map<string, TFile>([[file.path, file]]);
  let writes = 0;
  const vault = {
    getAbstractFileByPath: (p: string) => files.get(p) ?? null,
    read: async () => source,
    create: async () => {
      writes++;
      return file;
    },
    process: async (_f: TFile, fn: (s: string) => string) => {
      source = fn(source);
      writes++;
      return source;
    },
  } as Pick<Vault, "getAbstractFileByPath" | "read" | "create" | "process">;
  await assert.rejects(
    () => saveEditablePack(vault, file.path, source),
    /already exists/,
  );
  const snapshot = await readEditablePack(vault, file.path);
  source += " ";
  await assert.rejects(
    () => saveEditablePack(vault, file.path, snapshot.source, snapshot),
    /nothing was overwritten/,
  );
  assert.equal(writes, 0);
  source = snapshot.source;
  await saveEditablePack(vault, file.path, source, snapshot);
  assert.equal(writes, 1);
  await assert.rejects(
    () => saveEditablePack(vault, "Changed.json", source, snapshot),
    /configured pack changed/,
  );
  file.path = "Moved.json";
  await assert.rejects(
    () => saveEditablePack(vault, snapshot.path, source, snapshot),
    /moved/,
  );
  for (const path of [
    "../outside.json",
    "https://bad.json",
    "bad.md",
    "Pack/%2e.json",
  ])
    assert.throws(() => editablePackPath(path));
});
