/*
 * Copyright 2026 Christian Grobmeier
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Notice, Plugin, type TFile } from "obsidian";
import { parseMarkdown } from "./core/markdown";
import type {
  DocxPresetId,
  FoundryDocument,
  PdfPresetId,
  PresetId,
  PublishedFile,
} from "./core/model";
import {
  applyPreset,
  choosePreset,
  initialMetadata,
  type PresetCatalog,
} from "./packs/model";
import { loadVaultPacks } from "./vault/packs";
import { safeOutputName } from "./core/naming";
import { TypstPdfRenderer } from "./pdf/renderer";
import {
  DEFAULT_SETTINGS,
  PageFoundrySettingTab,
  type PageFoundrySettings,
} from "./settings";
import { ExportModal, type ExportChoice } from "./ui/exportModal";
import { ResultModal } from "./ui/resultModal";
import { saveOutput } from "./vault/output";
import { reviewVaultImages } from "./vault/images";
import type { ImageReview } from "./core/images";
import { preflight } from "./core/preflight";
import { reviewVaultBook } from "./vault/books";
import { DEFAULT_PRINT_OPTIONS } from "./print/model";
import { CheatSheetModal } from "./ui/cheatSheetModal";
import { TemplateModal } from "./ui/templateModal";
import {
  cleanTemplateHistory,
  rankTemplates,
  rememberTemplate,
  templateLibrary,
} from "./templates/catalog";
import { isBookPlan } from "./books/manifest";
import { editableBook, newBookEntry } from "./books/editor";
import { BookModal } from "./ui/bookModal";
import { saveBookPlan } from "./vault/bookPlan";
import {
  NOTE_TEMPLATES,
  createNoteSource,
  noteProperties,
  updateNoteDetails,
  cleanNoteHistory,
  rememberNoteTemplate,
} from "./notes/model";
import { NoteModal, NoteTemplateModal } from "./ui/noteModal";
import { createNote, saveNoteDetails } from "./vault/notes";
import { loadNoteTemplates, confirmNoteTemplate } from "./vault/noteTemplates";
import { expandNoteTemplate } from "./notes/templates";
import { SaveTemplateModal } from "./ui/saveTemplateModal";
import { PresetEditorModal } from "./ui/presetEditorModal";
import { readEditablePack, saveEditablePack } from "./vault/presetEditor";
import { bookLivePreview } from "./ui/bookLivePreview";
import {
  cleanNoteLayouts,
  defaultLayout,
  noteLayoutKey,
  rememberNoteLayout,
} from "./templates/preferred";
import { letterWriting, convertLetterWriting } from "./notes/letter";
import { LetterWritingModal } from "./ui/letterWritingModal";

export default class PageFoundryPlugin extends Plugin {
  settings: PageFoundrySettings = { ...DEFAULT_SETTINGS };
  private readonly pdfRenderer = new TypstPdfRenderer();

  async onload(): Promise<void> {
    await this.loadSettings();
    this.registerEditorExtension(bookLivePreview());
    if (this.app.vault.on) {
      this.registerEvent(
        this.app.vault.on("rename", (file, oldPath) => {
          if (
            !("extension" in file) ||
            file.extension !== "md" ||
            !this.settings.noteLayouts.length
          )
            return;
          void (async () => {
            const oldKey = await noteLayoutKey(oldPath),
              key = await noteLayoutKey(file.path);
            if (
              !this.settings.noteLayouts.some((row) => row.noteKey === oldKey)
            )
              return;
            this.settings.noteLayouts = cleanNoteLayouts(
              this.settings.noteLayouts.map((row) =>
                row.noteKey === oldKey ? { ...row, noteKey: key } : row,
              ),
            );
            await this.saveSettings();
          })().catch(
            () =>
              new Notice(
                "Could not update this note's layout preference after renaming.",
              ),
          );
        }),
      );
      this.registerEvent(
        this.app.vault.on("delete", (file) => {
          if (
            !("extension" in file) ||
            file.extension !== "md" ||
            !this.settings.noteLayouts.length
          )
            return;
          void (async () => {
            const key = await noteLayoutKey(file.path);
            if (!this.settings.noteLayouts.some((row) => row.noteKey === key))
              return;
            this.settings.noteLayouts = this.settings.noteLayouts.filter(
              (row) => row.noteKey !== key,
            );
            await this.saveSettings();
          })().catch(
            () =>
              new Notice(
                "Could not clear the deleted note’s layout preference.",
              ),
          );
        }),
      );
    }
    this.addSettingTab(new PageFoundrySettingTab(this.app, this));
    this.addCommand({
      id: "set-up-book",
      name: "Set up book",
      callback: () => {
        void this.openBookSetup().catch(
          (error) =>
            new Notice(
              error instanceof Error
                ? error.message
                : "Could not open the book plan.",
            ),
        );
      },
    });
    for (const recent of [false, true])
      this.addCommand({
        id: recent ? "publish-recent" : "publish",
        name: recent ? "Publish recent" : "Publish",
        checkCallback: (checking) => {
          const file = this.app.workspace.getActiveFile();
          if (file?.extension !== "md") return false;
          if (!checking)
            void (
              recent
                ? this.openPublishPicker(file, true)
                : this.openPublish(file)
            ).catch(
              (error) =>
                new Notice(
                  error instanceof Error
                    ? error.message
                    : "Could not open templates.",
                ),
            );
          return true;
        },
      });
    for (const recent of [false, true])
      this.addCommand({
        id: recent ? "create-recent" : "create",
        name: recent ? "Create recent" : "Create new note",
        callback: () => {
          void this.openNewNote(recent).catch(
            (error) =>
              new Notice(
                error instanceof Error
                  ? error.message
                  : "Could not open note templates.",
              ),
          );
        },
      });
    this.addCommand({
      id: "move-letter-writing",
      name: "Move letter greeting and sign-off into writing",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (file?.extension !== "md") return false;
        if (!checking)
          void this.openLetterWriting(file).catch(
            (e) =>
              new Notice(
                e instanceof Error
                  ? e.message
                  : "Could not review this letter.",
              ),
          );
        return true;
      },
    });
    this.addCommand({
      id: "edit-document-details",
      name: "Edit document details",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (file?.extension !== "md") return false;
        if (!checking)
          void this.openNoteDetails(file).catch(
            (error) =>
              new Notice(
                error instanceof Error
                  ? error.message
                  : "Could not open document details.",
              ),
          );
        return true;
      },
    });
    this.addCommand({
      id: "convert-book-plan",
      name: "Convert to readable book plan",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (file?.extension !== "md") return false;
        if (!checking)
          void this.openBookSetup(true).catch(
            (error) =>
              new Notice(
                error instanceof Error
                  ? error.message
                  : "Could not convert this plan.",
              ),
          );
        return true;
      },
    });
    this.addCommand({
      id: "save-note-template",
      name: "Save as note template",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (file?.extension !== "md") return false;
        if (!checking)
          void this.openSaveTemplate(file).catch(
            (error) =>
              new Notice(
                error instanceof Error
                  ? error.message
                  : "Could not open template preview.",
              ),
          );
        return true;
      },
    });
    this.addCommand({
      id: "cheat-sheet",
      name: "Cheat Sheet",
      callback: () => new CheatSheetModal(this.app).open(),
    });
    this.addCommand({
      id: "start-here",
      name: "Start here",
      callback: () => new CheatSheetModal(this.app).open(),
    });
    this.addCommand({
      id: "manage-output-presets",
      name: "Manage output presets",
      callback: () => {
        void this.openPresetEditor().catch(
          (error) =>
            new Notice(
              error instanceof Error
                ? error.message
                : "Could not open output presets.",
            ),
        );
      },
    });
    this.addCommand({
      id: "publish-current-book",
      name: "Publish current book",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (file?.extension !== "md") return false;
        if (!checking)
          void this.openPublish(file, true).catch(
            (error) =>
              new Notice(
                error instanceof Error
                  ? error.message
                  : "Could not review the book.",
              ),
          );
        return true;
      },
    });

    this.addCommand({
      id: "publish-current-note",
      name: "Publish current note",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        const available = Boolean(file?.extension === "md");
        if (available && !checking && file) {
          void this.openPublish(file).catch(() => {
            console.error("Page Foundry could not read the active note");
            new Notice("Page Foundry could not read the active note.");
          });
        }
        return available;
      },
    });
  }

  async loadSettings(): Promise<void> {
    const stored = (await this.loadData()) as
      | (Partial<PageFoundrySettings> & { lastPreset?: PdfPresetId })
      | null;
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...stored,
      templateHistory: cleanTemplateHistory(stored?.templateHistory),
      noteTemplateHistory: cleanNoteHistory(stored?.noteTemplateHistory),
      noteLayouts: cleanNoteLayouts(stored?.noteLayouts),
      noteTemplatePaths: Array.isArray(stored?.noteTemplatePaths)
        ? stored.noteTemplatePaths
        : [],
      lastPdfPreset:
        stored?.lastPdfPreset ??
        stored?.lastPreset ??
        DEFAULT_SETTINGS.lastPdfPreset,
    };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  async openPresetEditor(): Promise<void> {
    const configuredPath = this.settings.packManifestPath.trim();
    const snapshot = configuredPath
      ? await readEditablePack(this.app.vault, configuredPath)
      : undefined;
    new PresetEditorModal(
      this.app,
      snapshot?.pack,
      configuredPath || "My output presets.json",
      async (path, source) => {
        if (this.settings.packManifestPath.trim() !== configuredPath)
          throw new Error(
            "The configured output pack changed. Reopen Manage output presets.",
          );
        await saveEditablePack(this.app.vault, path, source, snapshot);
        this.settings.packManifestPath = path.trim();
        try {
          await this.saveSettings();
          new Notice("Private output preset saved. Choose it in Publish.");
        } catch {
          new Notice(
            `Output preset saved at ${path}, but its configuration could not be saved. Set that pack path in settings.`,
          );
        }
      },
    ).open();
  }

  private async openNewNote(recent = false): Promise<void> {
    const custom = await loadNoteTemplates(
      this.app.vault,
      this.settings.noteTemplatePaths,
    );
    const history = this.settings.noteTemplateHistory;
    let templates = [...NOTE_TEMPLATES, ...custom.map((t) => t.template)].sort(
      (a, b) => {
        const aa = history.find((h) => h.key === a.id),
          bb = history.find((h) => h.key === b.id);
        return (
          (bb?.uses ?? 0) - (aa?.uses ?? 0) ||
          (bb?.lastUsed ?? 0) - (aa?.lastUsed ?? 0)
        );
      },
    );
    if (recent) {
      const filtered = templates.filter((t) =>
        history.some((h) => h.key === t.id),
      );
      if (filtered.length) templates = filtered;
      else new Notice("No recent note templates yet. Choose one to begin.");
    }
    const choose = (template: (typeof NOTE_TEMPLATES)[number]) => {
      if (template.id === "more") {
        new NoteTemplateModal(
          this.app,
          templates.filter((t) =>
            ["plain", "submission-letter"].includes(t.id),
          ),
          choose,
        ).open();
        return;
      }
      const title =
        template.defaults.title && !template.defaults.title.includes("{{")
          ? template.defaults.title
          : template.name;
      const fields = {
        title,
        author: template.defaults.author?.includes("{{")
          ? ""
          : (template.defaults.author ?? ""),
        language:
          template.defaults.language &&
          !template.defaults.language.includes("{{")
            ? template.defaults.language
            : this.settings.defaultLanguage,
        date:
          template.defaults.date && !template.defaults.date.includes("{{")
            ? template.defaults.date
            : new Date().toISOString().slice(0, 10),
      };
      const initial: Record<string, string> = {
        ...expandNoteTemplate(template, fields).defaults,
        ...fields,
      };
      if (template.kind.includes("letter")) {
        if (!Object.hasOwn(template.defaults, "author")) delete initial.author;
        if (!Object.hasOwn(template.defaults, "language"))
          initial.language = "";
      }
      if (
        !template.kind.includes("letter") &&
        !Object.hasOwn(template.defaults, "date")
      )
        delete initial.date;
      new NoteModal(
        this.app,
        template,
        initial,
        this.settings.noteFolder,
        template.kind === "book" ? "My Book.book.md" : `${template.name}.md`,
        false,
        async (path, values, folders) => {
          const selected = custom.find((t) => t.template.id === template.id);
          if (selected) {
            if (!this.settings.noteTemplatePaths.includes(selected.path))
              throw new Error(
                "This note template is no longer registered. Reopen Create new note.",
              );
            await confirmNoteTemplate(this.app.vault, selected);
          }
          const file = await createNote(
            this.app.vault,
            path,
            createNoteSource(
              expandNoteTemplate(template, {
                date: fields.date,
                ...values,
                language: values.language || fields.language,
              }),
              values,
            ),
            folders,
          );
          new Notice(
            `Note created: ${file.path}. Publish it when you are ready.`,
          );
          this.settings.noteTemplateHistory = rememberNoteTemplate(
            this.settings.noteTemplateHistory,
            template.id,
          );
          try {
            await this.saveSettings();
          } catch {
            new Notice(
              "The note was created, but its template history could not be saved.",
            );
          }
          try {
            await this.app.workspace.openLinkText(file.path, "");
          } catch {
            new Notice(`Open ${file.path} to continue writing.`);
          }
        },
      ).open();
    };
    const basics = templates.filter(
      (t) =>
        ["letter", "manuscript", "book"].includes(t.id) ||
        custom.some((c) => c.template.id === t.id),
    );
    new NoteTemplateModal(
      this.app,
      recent
        ? templates
        : [
            ...basics,
            {
              id: "more",
              kind: "more",
              name: "More starters…",
              body: "",
              defaults: {},
            },
          ],
      choose,
    ).open();
  }

  private async openSaveTemplate(file: TFile): Promise<void> {
    const originalPath = file.path,
      source = await this.app.vault.read(file);
    new SaveTemplateModal(
      this.app,
      source,
      `${file.basename} template.md`,
      async (path, templateSource) => {
        if (this.settings.noteTemplatePaths.length >= 30)
          throw new Error(
            "At most 30 note templates can be registered. Remove one in settings first.",
          );
        if (
          file.path !== originalPath ||
          this.app.vault.getAbstractFileByPath(originalPath) !== file ||
          (await this.app.vault.read(file)) !== source
        )
          throw new Error(
            "The source note changed. Reopen Save as note template to review its latest content.",
          );
        const template = await createNote(
          this.app.vault,
          path.trim(),
          templateSource,
        );
        this.settings.noteTemplatePaths = [
          ...this.settings.noteTemplatePaths,
          template.path,
        ];
        try {
          await this.saveSettings();
          new Notice(
            `Private note template saved and registered: ${template.path}. Edit that Markdown file to change it.`,
          );
        } catch {
          new Notice(
            `Template saved at ${template.path}, but registration could not be saved. Add its exact path in settings.`,
          );
        }
      },
    ).open();
  }

  private async openNoteDetails(file: TFile): Promise<void> {
    const path = file.path;
    const source = await this.app.vault.read(file);
    if (isBookPlan(source, file.basename)) {
      await this.openBookSetup(false, file);
      return;
    }
    const values = noteProperties(source);
    const kind =
      values.document ??
      (values.from || values.to || values.subject ? "letter" : "plain");
    const template =
      NOTE_TEMPLATES.find((t) => t.kind === kind) ?? NOTE_TEMPLATES.at(-1)!;
    if (
      values.document &&
      !NOTE_TEMPLATES.some((t) => t.kind === values.document)
    )
      throw new Error(
        "This note has an unsupported document type. Edit its document property explicitly before using this details form; publishing ordinary notes is still available.",
      );
    const legacyLetter =
      kind.includes("letter") && Boolean(values.from || values.to);
    if (legacyLetter)
      for (const [old, prefix] of [
        ["from", "sender"],
        ["to", "recipient"],
      ]) {
        if (
          values[old!] &&
          !Object.hasOwn(values, `${prefix}-name`) &&
          !Object.hasOwn(values, `${prefix}-address`)
        ) {
          const [name, ...address] = values[old!]!.split(/\r?\n/);
          values[`${prefix}-name`] = name!;
          values[`${prefix}-address`] = address.join("\n");
        }
      }
    new NoteModal(
      this.app,
      template,
      { ...values, title: values.title ?? file.basename },
      "",
      file.path,
      true,
      async (_path, details) => {
        await saveNoteDetails(
          this.app.vault,
          file,
          path,
          source,
          updateNoteDetails(source, template.kind, details, legacyLetter),
        );
        new Notice("Document details saved in your note.");
      },
      legacyLetter,
    ).open();
  }

  private async openLetterWriting(file: TFile): Promise<void> {
    const path = file.path,
      source = await this.app.vault.read(file);
    const properties = noteProperties(source);
    if (
      properties.document &&
      !["letter", "submission-letter"].includes(properties.document)
    )
      throw new Error(
        "Open a letter, not another document type, before converting.",
      );
    if (
      !["letter", "submission-letter"].includes(properties.document ?? "") &&
      !properties.from &&
      !properties.to &&
      !properties.closing
    )
      throw new Error(
        "Open a letter with greeting or closing properties first.",
      );
    new LetterWritingModal(this.app, letterWriting(source), async (writing) => {
      await saveNoteDetails(
        this.app.vault,
        file,
        path,
        source,
        convertLetterWriting(source, writing),
      );
      new Notice("Greeting and sign-off are now part of your writing.");
    }).open();
  }

  private async openPublish(file: TFile, expectedBook = false): Promise<void> {
    const source = await this.app.vault.cachedRead(file),
      book = isBookPlan(source, file.basename);
    if (expectedBook && !book)
      throw new Error("Open a book plan before using Publish current book.");
    const catalog = await loadVaultPacks(
      this.app,
      this.settings.packManifestPath,
    );
    const library = templateLibrary(catalog, book);
    let key: string | undefined;
    try {
      key = await noteLayoutKey(file.path);
    } catch {
      new Notice(
        "Saved layout choices are unavailable on this device. Review the default or choose Change layout.",
      );
    }
    const saved = this.settings.noteLayouts.find((row) => row.noteKey === key);
    let layout = saved
      ? library.find((t) => t.key === saved.layoutKey)
      : undefined;
    if (saved && !layout)
      new Notice(
        "This note's previous layout is unavailable. Review the default or choose Change layout.",
      );
    layout ??= defaultLayout(
      library,
      book ? "book" : (noteProperties(source).document ?? "plain"),
    );
    await this.openExport(
      file,
      {
        ...layout,
        outputName: file.basename,
        language: this.settings.defaultLanguage,
        destination: "vault",
      },
      book,
    );
  }

  private async openPublishPicker(file: TFile, recent = false): Promise<void> {
    const source = await this.app.vault.cachedRead(file);
    const book = isBookPlan(source, file.basename);
    const catalog = await loadVaultPacks(
      this.app,
      this.settings.packManifestPath,
    );
    const library = templateLibrary(catalog, book);
    let templates = rankTemplates(
      library,
      this.settings.templateHistory,
      recent,
    );
    if (!templates.length && recent) {
      new Notice(
        "No recent output presets for this note or book yet. Choose a preset to get started.",
      );
      templates = rankTemplates(library, this.settings.templateHistory);
    }
    new TemplateModal(
      this.app,
      templates,
      (template) => {
        void this.openExport(
          file,
          {
            format: template.format,
            preset: template.preset,
            profile: template.profile,
            printOptions: template.printOptions
              ? { ...template.printOptions }
              : undefined,
            outputName: file.basename,
            language: this.settings.defaultLanguage,
            destination: "vault",
          },
          book,
        ).catch(
          (error) =>
            new Notice(
              error instanceof Error
                ? error.message
                : "Could not open this template.",
            ),
        );
      },
      recent,
      book ? "book" : (noteProperties(source).document ?? "plain"),
    ).open();
  }

  private async openBookSetup(convert = false, target?: TFile): Promise<void> {
    const active = target ?? this.app.workspace.getActiveFile();
    const source =
      active?.extension === "md"
        ? await this.app.vault.read(active)
        : undefined;
    const editing = Boolean(
      source !== undefined && active && isBookPlan(source, active.basename),
    );
    const book = editableBook(editing ? source : undefined);
    if (convert && (!editing || !source?.includes("page-foundry-book:")))
      throw new Error("Open an existing YAML book plan before converting it.");
    if (!editing) {
      book.metadata.language = this.settings.defaultLanguage;
      if (active?.extension === "md")
        book.entries.push({ ...newBookEntry(), path: active.path });
    }
    const snapshot =
      editing && active && source !== undefined
        ? { file: active, source }
        : undefined;
    new BookModal(
      this.app,
      book,
      snapshot?.file.path ?? "My Book.book.md",
      editing,
      async (path, draft) => {
        const file = await saveBookPlan(
          this.app.vault,
          path,
          draft,
          snapshot,
          convert,
        );
        new Notice("Book plan saved. Use Page Foundry: Publish when ready.");
        try {
          await this.app.workspace.openLinkText(file.path, "");
        } catch {
          new Notice(
            `The book plan was saved at ${file.path}. Open it to continue.`,
          );
        }
      },
      convert,
    ).open();
  }

  private async openExport(
    file: TFile,
    previousChoice?: ExportChoice,
    book = false,
  ): Promise<void> {
    const format = this.settings.lastFormat;
    const preset: PresetId =
      format === "pdf"
        ? this.settings.lastPdfPreset
        : format === "docx"
          ? this.settings.lastDocxPreset
          : this.settings.lastEpubPreset;
    const markdown = book ? "" : await this.app.vault.cachedRead(file);
    const review = book
      ? await reviewVaultBook(this.app, file)
      : await reviewVaultImages(
          this.app,
          file,
          parseMarkdown(markdown, file.basename),
        );
    const document = review.document;
    const catalog = await loadVaultPacks(
      this.app,
      this.settings.packManifestPath,
    );
    const initial: ExportChoice = {
      format,
      preset,
      profile: this.settings.lastProfile,
      outputName: file.basename,
      language:
        document.metadata.language ??
        document.metadata.lang ??
        this.settings.defaultLanguage,
      destination: "vault",
    };
    if (previousChoice)
      choosePreset(catalog, previousChoice.preset, previousChoice.format);
    new ExportModal(
      this.app,
      previousChoice ?? initial,
      (choice) =>
        void this.publish(file, choice, review, markdown, catalog, book),
      review,
      (choice) => {
        void this.openExport(file, choice, book).catch(
          () => new Notice("Could not refresh the image review."),
        );
      },
      catalog,
      () => {
        void this.openPublishPicker(file).catch(
          (error) =>
            new Notice(
              error instanceof Error
                ? error.message
                : "Could not open templates.",
            ),
        );
      },
    ).open();
  }

  private async publish(
    file: TFile,
    choice: ExportChoice,
    reviewed: ImageReview,
    reviewedMarkdown: string,
    reviewedCatalog?: PresetCatalog,
    book = false,
  ): Promise<void> {
    const label = choice.format.toUpperCase();
    const progress = new Notice(`Creating ${label} on this device…`, 0);
    try {
      const catalog = await loadVaultPacks(
        this.app,
        this.settings.packManifestPath,
      );
      if (catalog.error) throw new Error(catalog.error);
      if (reviewedCatalog && catalog.signature !== reviewedCatalog.signature) {
        new Notice(
          "The preset pack changed. Review the updated layout before publishing.",
        );
        await this.openExport(file, choice, book);
        return;
      }
      const preset = choosePreset(catalog, choice.preset, choice.format);
      if (book && preset.outputs[choice.format]?.recipe === "letter")
        throw new Error("Letter layouts are not book presets.");
      const markdown = book ? "" : await this.app.vault.cachedRead(file);
      const fresh = book
        ? await reviewVaultBook(this.app, file)
        : await reviewVaultImages(
            this.app,
            file,
            parseMarkdown(markdown, file.basename),
          );
      if (
        markdown !== reviewedMarkdown ||
        fresh.signature !== reviewed.signature ||
        fresh.errors.length
      ) {
        new Notice(
          book
            ? "The book or its included files changed. Review them before publishing."
            : "The note or its images changed. Review the updated files before publishing.",
        );
        await this.openExport(file, choice, book);
        return;
      }
      const values = choice.metadata ?? {
        ...initialMetadata(fresh.document, preset),
        language: choice.language,
      };
      const report = preflight(fresh.document, {
        format: choice.format,
        profile: choice.profile,
        preset,
        metadata: values,
        resourceErrors: fresh.errors,
        resourceWarnings: fresh.warnings,
        printOptions: choice.printOptions,
      });
      const blockers = report.findings.filter(
        (finding) => finding.severity === "blocker",
      );
      if (blockers.length)
        throw new Error(blockers.map((finding) => finding.message).join(" "));
      const outputDocument = applyPreset(
        fresh.document,
        preset,
        choice.format,
        values,
      );
      const output = await this.render(outputDocument, {
        ...choice,
        preset: preset.outputs[choice.format]!.recipe,
        language: outputDocument.metadata.language ?? choice.language,
      });
      const filename = safeOutputName(choice.outputName, output.extension);

      const isPrint =
        preset.outputs[choice.format]?.recipe === "paperback-interior";
      if (choice.destination === "vault") {
        const path = await this.saveToVault(filename, output);
        await this.rememberPublishedNote(file, choice, isPrint);
        new ResultModal(
          this.app,
          filename,
          output,
          () => this.saveToVault(filename, output),
          path,
        ).open();
      } else {
        await this.rememberPublishedNote(file, choice, isPrint);
        new ResultModal(this.app, filename, output, () =>
          this.saveToVault(filename, output),
        ).open();
      }
    } catch (error) {
      console.error(`Page Foundry could not create the ${label}`);
      new Notice(
        error instanceof Error
          ? error.message
          : `Page Foundry could not create the ${label}.`,
      );
    } finally {
      progress.hide();
    }
  }

  private async rememberPublishedNote(
    file: TFile,
    choice: ExportChoice,
    isPrint: boolean,
  ): Promise<void> {
    try {
      this.rememberChoice(choice, isPrint);
      this.settings.noteLayouts = rememberNoteLayout(
        this.settings.noteLayouts,
        await noteLayoutKey(file.path),
        {
          ...choice,
          profile: choice.format === "epub" || isPrint ? "a4" : choice.profile,
          printOptions: isPrint ? choice.printOptions : undefined,
        },
      );
      await this.saveSettings();
    } catch {
      new Notice(
        "Output created, but its layout preference could not be saved.",
      );
    }
  }

  private rememberChoice(choice: ExportChoice, isPrint = false): void {
    // Check the selected recipe rather than retaining irrelevant default print controls.
    this.settings.templateHistory = rememberTemplate(
      this.settings.templateHistory,
      {
        format: choice.format,
        preset: choice.preset,
        profile: choice.format === "epub" || isPrint ? "a4" : choice.profile,
        printOptions: isPrint ? choice.printOptions : undefined,
      },
    );
    this.settings.lastFormat = choice.format;
    this.settings.lastProfile = choice.profile;
    if (choice.format === "pdf") {
      this.settings.lastPdfPreset = choice.preset;
    } else if (choice.format === "docx") {
      this.settings.lastDocxPreset = choice.preset;
    } else {
      this.settings.lastEpubPreset = choice.preset;
    }
  }

  private async render(
    document: FoundryDocument,
    choice: ExportChoice,
  ): Promise<PublishedFile> {
    switch (choice.format) {
      case "pdf":
        if (choice.preset === "paperback-interior")
          return this.pdfRenderer.renderPrint(
            document,
            choice.printOptions ?? DEFAULT_PRINT_OPTIONS,
          );
        return {
          bytes: await this.pdfRenderer.render(
            document,
            choice.preset as PdfPresetId,
            choice.profile,
          ),
          extension: "pdf",
          mediaType: "application/pdf",
        };
      case "epub": {
        const { EpubRenderer } = await import("./epub/renderer");
        return new EpubRenderer().render(document, {
          language: choice.language,
        });
      }
      case "docx": {
        const { DocxRenderer } = await import("./docx/renderer");
        return new DocxRenderer().render(
          document,
          choice.preset as DocxPresetId,
          choice.profile,
        );
      }
    }
  }

  private saveToVault(
    filename: string,
    output: PublishedFile,
  ): Promise<string> {
    return saveOutput(
      this.app.vault,
      this.settings.outputFolder,
      filename,
      output.extension,
      output.bytes,
    );
  }
}
