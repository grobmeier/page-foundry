/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { it } from "node:test";
import { runInNewContext } from "node:vm";
import { build } from "esbuild";
import {
  opaqueYamlBinarySource,
  opaqueYamlRuntime,
} from "../scripts/opaque-yaml-runtime.mjs";
import { inspectRuntime } from "../scripts/check-runtime.mjs";

type Api = Pick<
  typeof import("yaml"),
  "parseDocument" | "parse" | "stringify"
> &
  Pick<
    typeof import("../src/notes/model"),
    | "updateNoteDetails"
    | "noteProperties"
    | "createNoteSource"
    | "NOTE_TEMPLATES"
  > &
  Pick<
    typeof import("../src/books/editor"),
    "editableBook" | "serializeBookPlan"
  > &
  Pick<typeof import("../src/books/manifest"), "parseBookManifest"> &
  Pick<typeof import("../src/core/markdown"), "parseMarkdown">;

async function bundle(browser: boolean, adapted: boolean) {
  const result = await build({
    stdin: {
      contents: `
        export {parseDocument, parse, stringify} from 'yaml';
        export {updateNoteDetails, noteProperties, createNoteSource, NOTE_TEMPLATES} from './src/notes/model';
        export {editableBook, serializeBookPlan} from './src/books/editor';
        export {parseBookManifest} from './src/books/manifest';
        export {parseMarkdown} from './src/core/markdown';
      `,
      resolveDir: process.cwd(),
      loader: "ts",
    },
    write: false,
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "es2021",
    plugins: [
      ...(browser
        ? [
            {
              name: "browser-yaml-fixture",
              setup(builder: import("esbuild").PluginBuild) {
                builder.onResolve({ filter: /^yaml$/ }, () => ({
                  path: resolve("node_modules/yaml/browser/index.js"),
                }));
              },
            },
          ]
        : []),
      ...(adapted ? [opaqueYamlRuntime] : []),
    ],
  });
  const code = result.outputFiles[0]!.text;
  const module = { exports: {} };
  const forbiddenCodec = () => {
    throw new Error("YAML must not call a browser binary codec.");
  };
  const require = createRequire(import.meta.url);
  runInNewContext(code, {
    module,
    exports: module.exports,
    require: (name: string) =>
      name === "process" ? { ...process, emitWarning() {} } : require(name),
    // Unknown custom tags deliberately emit YAML warnings in these fixtures.
    console: { ...console, warn() {} },
    Buffer,
    TextEncoder,
    Uint8Array,
    Date,
    atob: adapted ? forbiddenCodec : globalThis.atob,
    btoa: adapted ? forbiddenCodec : globalThis.btoa,
  });
  return { api: module.exports as Api, code };
}

const runtimes = Promise.all([
  bundle(true, false),
  bundle(true, true),
  bundle(false, true),
]);
const note = (yaml: string) => `---\n${yaml}\n---\nUnchanged **writing**.\n`;
const plain = (value: unknown): unknown => JSON.parse(JSON.stringify(value));
const body = "Unchanged **writing**.\n";

it("guards the exact browser and Node YAML binary modules and package version", async () => {
  for (const kind of ["browser", "node"] as const) {
    const source = await readFile(
      `node_modules/yaml/${kind === "browser" ? "browser/" : ""}dist/schema/yaml-1.1/binary.js`,
      "utf8",
    );
    const adapted = opaqueYamlBinarySource(kind, source, "2.9.1");
    assert.deepEqual(inspectRuntime(adapted), {
      network: 0,
      dynamicCode: 0,
      browserBinaryCodecs: 0,
    });
    assert.throws(
      () => opaqueYamlBinarySource(kind, source + "\n", "2.9.1"),
      /Review the updated YAML/,
    );
    assert.throws(
      () => opaqueYamlBinarySource(kind, source, "2.9.2"),
      /Review the updated YAML/,
    );
  }
  for (const { code } of (await runtimes).slice(1))
    assert.deepEqual(inspectRuntime(code), {
      network: 0,
      dynamicCode: 0,
      browserBinaryCodecs: 0,
    });
});

it("keeps ordinary properties, comments, aliases, dates, unknown tags and starters unchanged", async () => {
  const [baseline, ...candidates] = await runtimes;
  for (const { api } of candidates) {
    for (const yaml of [
      "title: Original\ncustom: 42\ntags: [draft, work]",
      '# Keep this comment\ntitle: Original # title comment\ncustom: "quoted: text"',
      "title: Original\ncustom: |-\n  One line\n  Another line",
      "title: Original\ncustom: &a [one, two]\nother: *a",
      "title: Original\ncustom: !!timestamp 2026-10-20",
      "title: Original\ncustom: !example preserve-this",
    ]) {
      const source = note(yaml);
      assert.deepEqual(
        plain(api.noteProperties(source)),
        plain(baseline!.api.noteProperties(source)),
      );
      assert.deepEqual(
        plain(api.parseMarkdown(source, "Fallback")),
        plain(baseline!.api.parseMarkdown(source, "Fallback")),
      );
      assert.equal(
        api.updateNoteDetails(source, "plain", { title: "Changed" }),
        baseline!.api.updateNoteDetails(source, "plain", { title: "Changed" }),
      );
    }
    for (const template of baseline!.api.NOTE_TEMPLATES)
      assert.equal(
        api.createNoteSource(template, {
          title: "Neutral Example",
          author: "Alex Example",
          "sender-address": "One Example Road\nExample Town",
        }),
        baseline!.api.createNoteSource(template, {
          title: "Neutral Example",
          author: "Alex Example",
          "sender-address": "One Example Road\nExample Town",
        }),
      );
    const yaml11 =
      "%YAML 1.1\n---\ncustom: yes\ndate: 2026-10-20\nbinary: !!binary SGVsbG8=";
    const doc = api.parseDocument(yaml11);
    assert.equal(doc.errors.length, 0);
    const before = baseline!.api.parse(doc.toString()) as {
      custom: boolean;
      date: Date;
      binary: Uint8Array;
    };
    assert.equal(before.custom, true);
    assert.equal(before.date.toISOString(), "2026-10-20T00:00:00.000Z");
    assert.equal(Buffer.from(before.binary).toString(), "Hello");
    const unknown = api.parseDocument("custom: !example preserve-this");
    assert.equal(unknown.warnings[0]?.code, "TAG_RESOLVE_FAILED");
    assert.match(unknown.toString(), /!example preserve-this/);
  }
});

it("matches browser binary-tag syntax across deterministic edge-case combinations", async () => {
  const [baseline, ...candidates] = await runtimes;
  const alphabet = "Az09+/= -_!\t\n\r\f\v";
  let seed = 12345;
  const values = new Set(["", "AA==", "AAA=", "AAAA", "Zh==", "Zm9=", "AA= ="]);
  for (let sample = 0; sample < 1500; sample++) {
    let value = "";
    for (let i = 0; i < sample % 17; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      value += alphabet[seed % alphabet.length];
    }
    values.add(value);
  }
  for (const value of values) {
    const yaml = `custom: !!binary ${JSON.stringify(value)}`;
    const valid = baseline!.api.parseDocument(yaml).errors.length === 0;
    for (const { api } of candidates)
      assert.equal(
        api.parseDocument(yaml).errors.length === 0,
        valid,
        JSON.stringify(value),
      );
  }
});

it("round-trips valid binary-tag text and its aliases without decoding or exposing metadata", async () => {
  const [baseline, ...candidates] = await runtimes;
  for (const { api } of candidates) {
    for (const value of [
      "SGVsbG8=",
      "SGVsbG8",
      "AA==",
      "AAA=",
      "AAAA",
      "AA",
      "AAA",
      "Zh==",
      '""',
      '"SGVs bG8="',
      '" SGVs\\tbG8=\\n\\r\\f"',
      "|-\n  SGVs\n  bG8=",
      ">\n  SGVs\n  bG8=",
      "1234",
      "true",
    ]) {
      const yaml = `title: Original\ncustom: &payload !!binary ${value}\nother: *payload # Keep alias`;
      const original = note(yaml);
      const doc = api.parseDocument(yaml);
      assert.equal(doc.errors.length, 0, value);
      const root = doc.toJS() as Record<string, unknown>;
      assert.equal(typeof root.custom, "object");
      assert.equal(root.custom instanceof Uint8Array, false);
      assert.deepEqual(Object.keys(root.custom!), []);
      assert.equal(root.other, root.custom);
      assert.deepEqual(plain(api.noteProperties(original)), {
        title: "Original",
      });
      const edited = api.updateNoteDetails(original, "plain", {
        title: "Changed",
      });
      assert.ok(edited.endsWith(body));
      assert.match(edited, /Keep alias/);
      assert.match(edited, /!!binary/);
      assert.match(edited, /\*payload/);
      // Only the unmodified baseline parser decodes bytes to prove preservation.
      const before = baseline!.api.parseDocument(yaml).toJS() as {
        custom: Uint8Array;
      };
      const after = baseline!.api
        .parseDocument(edited.split("---\n")[1]!)
        .toJS() as { custom: Uint8Array; other: Uint8Array };
      assert.deepEqual(
        Buffer.from(after.custom),
        Buffer.from(before.custom),
        value,
      );
      assert.equal(after.custom, after.other);
    }
    for (const field of ["title", "author", "document", "custom"])
      assert.equal(
        api.noteProperties(note(`${field}: !!binary SGVsbG8=`))[field],
        undefined,
      );
    const published = api.parseMarkdown(
      note("title: &payload !!binary SGVsbG8=\nauthor: *payload"),
      "Fallback",
    );
    assert.equal(published.title, "Fallback");
    assert.deepEqual(plain(published.metadata), {});
    assert.deepEqual(
      plain(api.parseMarkdown(note("!!binary SGVsbG8="), "Fallback").metadata),
      {},
    );
  }
});

it("rejects malformed binary text instead of promoting it to author metadata", async () => {
  for (const { api } of (await runtimes).slice(1)) {
    for (const value of [
      "A",
      "A===",
      "====",
      "AA=A",
      "AA==AA",
      "AAA==",
      "AAAA=",
      "A=",
      '"💥=="',
      '"AA-_"',
      '"AA\\v=="',
      "|\n  !! not valid",
    ]) {
      const yaml = `custom: !!binary ${value}`;
      const doc = api.parseDocument(yaml);
      assert.ok(doc.errors.length, value);
      assert.throws(() => doc.toString());
      assert.throws(
        () => api.noteProperties(note(yaml)),
        /Check the note's YAML/,
      );
      assert.throws(
        () => api.updateNoteDetails(note(yaml), "plain", { title: "Changed" }),
        /Check the note's YAML/,
      );
      assert.throws(() => api.parseMarkdown(note(yaml), "Fallback"));
    }
  }
});

it("retains binary properties through book editing but rejects binary titles and paths", async () => {
  const [baseline, ...candidates] = await runtimes;
  const source =
    note(
      "document: book\ntitle: Neutral Book\ncustom: &payload !!binary |-\n  SGVsbG8=\nother: *payload\n# Keep book comment",
    ) + "\n## Chapter: Arrival\n- [[Chapters/One.md]]\n";
  for (const { api } of candidates) {
    const book = api.editableBook(source);
    book.metadata.title = "Changed";
    const edited = api.serializeBookPlan(book, source);
    assert.match(edited, /Keep book comment/);
    assert.match(edited, /!!binary/);
    assert.match(edited, /\*payload/);
    const restored = baseline!.api
      .parseDocument(edited.split("---\n")[1]!)
      .toJS() as { custom: Uint8Array; other: Uint8Array };
    assert.equal(Buffer.from(restored.custom).toString(), "Hello");
    assert.equal(restored.custom, restored.other);
    assert.throws(
      () =>
        api.parseBookManifest(
          source.replace("title: Neutral Book", "title: !!binary SGVsbG8="),
        ),
      /Book title/,
    );
    assert.throws(() =>
      api.parseBookManifest(
        note(
          "page-foundry-book: 1\ntitle: Book\nentries:\n- id: one\n  role: chapter\n  path: !!binary SGVsbG8=",
        ),
      ),
    );
    assert.deepEqual(plain(api.parseBookManifest(edited)), plain(book));
  }
});

it("enforces mapping roots, duplicate-key checks and alias limits", async () => {
  for (const { api } of (await runtimes).slice(1)) {
    for (const yaml of [
      "!!binary SGVsbG8=",
      "!!timestamp 2026-10-20",
      "[one, two]",
      "plain text",
      "null",
    ])
      assert.throws(() => api.noteProperties(note(yaml)), /YAML mapping/);
    for (const yaml of [
      "title: One\ntitle: Two",
      "custom: *missing",
      "a: &a [one, two]\nb: &b [*a, *a, *a, *a]\nc: &c [*b, *b, *b, *b]\nd: [*c, *c, *c, *c]",
    ])
      assert.throws(() => api.noteProperties(note(yaml)));
  }
});

it("handles large tagged values without recursive validation or changing note limits", async () => {
  for (const { api } of (await runtimes).slice(1)) {
    const payload = "A".repeat(120 * 1024);
    const source = note(`title: Original\ncustom: !!binary ${payload}`);
    assert.ok(
      api
        .updateNoteDetails(source, "plain", { title: "Changed" })
        .endsWith(body),
    );
    assert.equal(
      api.parseDocument(`custom: !!binary ${"A".repeat(1024 * 1024)}`).errors
        .length,
      0,
    );
    assert.ok(api.parseDocument(`custom: !!binary ${payload}=`).errors.length);
    assert.throws(
      () =>
        api.noteProperties(note(`custom: !!binary ${"A".repeat(129 * 1024)}`)),
      /128 KiB/,
    );
  }
});
