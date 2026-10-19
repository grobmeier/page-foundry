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
import fontMono from "@file-viewer/assets-typst/viewer/wasm/typst/fonts/DejaVuSansMono.ttf";
import type {
  FoundryDocument,
  PageProfileId,
  PdfPresetId,
  PublishedFile,
} from "../core/model";
import { decodeCompressedBase64 } from "./binary";
import { createTypstSource } from "./typstSource";
import { createPrintSource } from "./printSource";
import { paginatePrint, type PrintOptions } from "../print/model";

export class TypstPdfRenderer {
  private compilerPromise?: Promise<TypstCompiler>;
  private queue: Promise<unknown> = Promise.resolve();
  async renderPrint(
    document: FoundryDocument,
    options: PrintOptions,
  ): Promise<PublishedFile> {
    const pending = this.queue.then(async () => {
      const result = await paginatePrint(options, (inside) =>
        this.compileSource(
          document,
          createPrintSource(document, options, inside),
          true,
        ),
      );
      const included = document.book!.entries;
      if (
        result.measurements.sections.length !== included.length ||
        result.measurements.sections.some(
          (section, index) =>
            section.id !== included[index]!.id ||
            section.role !== included[index]!.role,
        )
      )
        throw new Error(
          "The proof's measured sections do not match the included book.",
        );
      return {
        bytes: result.bytes,
        extension: "pdf" as const,
        mediaType: "application/pdf",
        proofReport: result.proofReport,
      };
    });
    this.queue = pending.catch(() => undefined);
    return pending;
  }

  async render(
    document: FoundryDocument,
    preset: PdfPresetId,
    profile: PageProfileId,
  ): Promise<Uint8Array> {
    const pending = this.queue.then(() =>
      this.compile(document, preset, profile),
    );
    this.queue = pending.catch(() => undefined);
    return pending;
  }

  private async compile(
    document: FoundryDocument,
    preset: PdfPresetId,
    profile: PageProfileId,
  ): Promise<Uint8Array> {
    if (preset === "paperback-interior")
      throw new Error(
        "Paperback publishing requires print options and a measured proof.",
      );
    return (
      await this.compileSource(
        document,
        createTypstSource(document, preset, profile),
      )
    ).bytes;
  }
  private async compileSource(
    document: FoundryDocument,
    source: string,
    proof = false,
  ): Promise<{ bytes: Uint8Array; measurements?: unknown }> {
    const compiler = await (this.compilerPromise ??= this.createCompiler());
    compiler.resetShadow();
    try {
      for (const image of Object.values(document.images ?? {}))
        compiler.mapShadow(
          `/assets/${image.id}.${image.extension}`,
          image.bytes,
        );
      compiler.addSource("/main.typ", source);
      if (proof) {
        const measured = await compiler.runWithWorld(
          { mainFilePath: "/main.typ" },
          async (world) => {
            // Return errors from the callback so the library always frees its world.
            try {
              const compilation = await world.compile({ diagnostics: "full" });
              if (compilation.hasError)
                return {
                  error:
                    compilation.diagnostics
                      ?.map((item) => item.message)
                      .join("; ") || "Could not paginate the paperback.",
                };
              const artifact = await world.pdf({ diagnostics: "full" });
              if (!artifact.result)
                return { error: "Typst did not return a paperback PDF." };
              const query: unknown = await world.query({
                selector: "<foundry-proof>",
                field: "value",
              });
              const measurements: unknown =
                Array.isArray(query) && query.length === 1
                  ? query[0]
                  : undefined;
              return {
                bytes: artifact.result,
                measurements,
              };
            } catch (error) {
              return {
                error:
                  error instanceof Error
                    ? error.message
                    : "Could not measure the paperback.",
              };
            }
          },
        );
        if (measured.error || !measured.bytes)
          throw new Error(measured.error || "Could not measure the paperback.");
        return { bytes: measured.bytes, measurements: measured.measurements };
      }
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
      return { bytes: result.result };
    } finally {
      compiler.resetShadow();
    }
  }

  private async createCompiler(): Promise<TypstCompiler> {
    const compiler = createTypstCompiler();
    const fonts = [
      fontRegular,
      fontItalic,
      fontBold,
      fontBoldItalic,
      fontMono,
    ].map(decodeCompressedBase64);
    await compiler.init({
      getModule: () => ({
        module_or_path: decodeCompressedBase64(compilerBinary),
      }),
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
