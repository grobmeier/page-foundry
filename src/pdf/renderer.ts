/*
 * Copyright 2026 Christian Grobmeier
 * Licensed under the Apache License, Version 2.0.
 */

import {
  CompileFormatEnum,
  createTypstCompiler,
  type TypstCompiler,
} from "@myriaddreamin/typst.ts/compiler";
import type { BeforeBuildFn } from "@myriaddreamin/typst.ts/options.init";
import compilerBinary from "@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm";
import fontBold from "@file-viewer/assets-typst/viewer/wasm/typst/fonts/LibertinusSerif-Bold.otf";
import fontBoldItalic from "@file-viewer/assets-typst/viewer/wasm/typst/fonts/LibertinusSerif-BoldItalic.otf";
import fontItalic from "@file-viewer/assets-typst/viewer/wasm/typst/fonts/LibertinusSerif-Italic.otf";
import fontRegular from "@file-viewer/assets-typst/viewer/wasm/typst/fonts/LibertinusSerif-Regular.otf";
import type {
  FoundryDocument,
  PageProfileId,
  PdfPresetId,
} from "../core/model";
import { decodeCompressedBase64 } from "./binary";
import { createTypstSource } from "./typstSource";

export class TypstPdfRenderer {
  private compilerPromise?: Promise<TypstCompiler>;

  async render(
    document: FoundryDocument,
    preset: PdfPresetId,
    profile: PageProfileId,
  ): Promise<Uint8Array> {
    const compiler = await (this.compilerPromise ??= this.createCompiler());
    compiler.addSource(
      "/main.typ",
      createTypstSource(document, preset, profile),
    );
    const result = await compiler.compile({
      mainFilePath: "/main.typ",
      format: CompileFormatEnum.pdf,
      diagnostics: "full",
    });
    if (!result.result) {
      const message = result.diagnostics
        ?.map((item) => item.message)
        .join("; ");
      throw new Error(message || "Typst did not return a PDF.");
    }
    return result.result;
  }

  private async createCompiler(): Promise<TypstCompiler> {
    const compiler = createTypstCompiler();
    const fonts = [fontRegular, fontItalic, fontBold, fontBoldItalic].map(
      decodeCompressedBase64,
    );
    await compiler.init({
      getModule: () =>
        ({
          module_or_path: decodeCompressedBase64(compilerBinary),
        }) as unknown as Uint8Array,
      beforeBuild: [loadLocalFonts(fonts)],
    });
    return compiler;
  }
}

function loadLocalFonts(fonts: Uint8Array[]): BeforeBuildFn {
  const loader = async (
    _stage: unknown,
    context: { builder: { add_raw_font: (font: Uint8Array) => Promise<void> } },
  ): Promise<void> => {
    for (const font of fonts) await context.builder.add_raw_font(font);
  };
  Object.assign(loader, {
    _kind: "fontLoader",
    _preloadRemoteFontOptions: { assets: false },
  });
  return loader as BeforeBuildFn;
}
