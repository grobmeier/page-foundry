/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import assert from "node:assert/strict";
import { it } from "node:test";
import { runInNewContext } from "node:vm";
import { build } from "esbuild";
import { strFromU8, unzipSync } from "fflate";
import {
  installZipScheduler,
  type ZipSchedulerHost,
} from "../src/runtime/zipScheduler";
import { modernZipRuntime } from "../scripts/modern-zip-runtime.mjs";
import { parseMarkdown } from "../src/core/markdown";
import { fixturePng } from "./fixtures/images";

it("yields ZIP tasks, forwards arguments, supports cancellation and rejects code strings", async () => {
  const host: ZipSchedulerHost = {
    setTimeout: (task, delay) => setTimeout(task, delay),
    clearTimeout: (handle) =>
      clearTimeout(handle as ReturnType<typeof setTimeout>),
  };
  installZipScheduler(host);
  const seen: unknown[] = [];
  host.setImmediate!((...args) => seen.push(...args), "one", 2);
  const cancelled = host.setImmediate!(() => seen.push("cancelled"));
  host.clearImmediate!(cancelled);
  assert.deepEqual(seen, []);
  // Deliberately model an untyped dependency supplying string code.
  assert.throws(
    () => Reflect.apply(host.setImmediate!, host, ["throw 1"]),
    /functions/,
  );
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.deepEqual(seen, ["one", 2]);
  const native = () => 1;
  const existing = { ...host, setImmediate: native };
  installZipScheduler(existing);
  assert.equal(existing.setImmediate, native);
});

it("bundles and repeatedly exports DOCX without legacy script schedulers or DOM/network access", async () => {
  const document = parseMarkdown(
    "# Chapter\n\n**Neutral writing**\n\n| Name | Value |\n| --- | --- |\n| Sample | 42 |",
    "Scheduler proof",
  );
  document.book = {
    entries: [{ id: "one", role: "chapter", title: "Chapter" }],
  };
  document.images = {
    panel: {
      id: "panel",
      path: "panel.png",
      bytes: fixturePng(120, 60),
      mediaType: "image/png",
      extension: "png",
      width: 120,
      height: 60,
    },
  };
  document.blocks.push({
    type: "paragraph",
    children: [
      {
        type: "image",
        url: "panel.png",
        resourceId: "panel",
        alt: "Neutral panel",
      },
    ],
  });
  const result = await build({
    stdin: {
      contents: `import { DocxRenderer } from './src/docx/renderer';
        globalThis.exportProof = async () => {
          const doc = ${JSON.stringify(document)};
          for (const image of Object.values(doc.images)) image.bytes = Uint8Array.from(Object.values(image.bytes));
          return (await new DocxRenderer().render(doc, 'plain-editable', 'a4')).bytes;
        };`,
      resolveDir: process.cwd(),
    },
    bundle: true,
    platform: "browser",
    format: "iife",
    target: "safari16.4",
    write: false,
    plugins: [modernZipRuntime],
    metafile: true,
  });
  const code = result.outputFiles[0]!.text;
  const forbidden =
    /createElement\(["']script["']\)|onreadystatechange|\bFunction\s*\(|\b(?:atob|btoa)\s*\(/.exec(
      code,
    );
  assert.equal(
    forbidden?.[0],
    undefined,
    `Unexpected legacy ZIP code: ${forbidden ? code.slice(forbidden.index - 80, forbidden.index + 100) : "none"}`,
  );
  assert.ok(
    !Object.keys(result.metafile!.inputs).some((p) =>
      /node_modules\/(immediate|setimmediate|lie)\//.test(p),
    ),
  );
  const environment = {
    Blob,
    TextEncoder,
    TextDecoder,
    setTimeout,
    clearTimeout,
    fetch() {
      throw new Error("Unexpected network access");
    },
    exportProof: undefined as undefined | (() => Promise<Uint8Array>),
  };
  runInNewContext(code, environment, { timeout: 10_000 });
  const before = Date.now();
  for (let i = 0; i < 3; i++) {
    const bytes = await environment.exportProof!();
    const files = unzipSync(bytes);
    assert.match(strFromU8(files["word/document.xml"]!), /Neutral writing/);
    assert.match(strFromU8(files["word/document.xml"]!), /<w:tbl>/);
    assert.ok(
      Object.keys(files).some((path) => path.startsWith("word/media/")),
    );
  }
  assert.ok(
    Date.now() - before < 10_000,
    "Small repeated exports must remain responsive",
  );
});

it("fails the build for script creation and unexpected legacy-polyfill consumers", async () => {
  for (const [contents, message] of [
    ['document.createElement("script");', /must not create script/],
    ['require("lie");', /Review the new lie consumer/],
  ] as const) {
    await assert.rejects(
      build({
        stdin: { contents, resolveDir: process.cwd() },
        bundle: true,
        write: false,
        logLevel: "silent",
        plugins: [modernZipRuntime],
      }),
      message,
    );
  }
});
