# Obsidian publishing plugin landscape

**Reviewed:** 30 September 2026

**Roadmap:** approved by the user on 30 September 2026. Implement the
recommended sequence below through the repository's specification process.

Page Foundry enters an established category. Exporting Markdown to PDF, EPUB, or
DOCX is not by itself a differentiator. Its strongest direction is a portable,
preset-driven production tool for authors: one that produces and checks
submission, ebook, and print files consistently on desktop and mobile.

## Relevant plugins

| Plugin              | Strongest capability                                                                  | Runtime and platform boundary                                | Relationship to Page Foundry                                                                       |
| ------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Pandoc Plugin       | Very broad format support and the mature Pandoc ecosystem                             | Desktop only; requires Pandoc                                | Establishes the familiar export workflow, but not the installation-free mobile goal                |
| Pandoc GUI          | A detailed interface over Pandoc, templates, filters, and many formats                | Desktop executables or optional Pandoc WebAssembly on mobile | Competes on breadth and configurability; Page Foundry should not chase its format count            |
| Document Exporter   | Single-note and batch export to PDF, DOCX, EPUB, Markdown, and HTML, including assets | Mobile EPUB/DOCX; PDF is desktop only                        | The closest general-purpose exporter; already covers basic multi-format conversion well            |
| Manuscript Compiler | Reviewed multi-note book structure and native EPUB/DOCX/ODT/HTML/Markdown/XML         | Fully offline, mobile, and no external executable            | The closest author-specific competitor; already has an excellent book-assembly workflow            |
| Book Exporter       | Manifest-driven multi-note EPUB and PDF                                               | Desktop only; requires Pandoc and a PDF engine               | Similar book goal with a heavier runtime boundary                                                  |
| Longform            | Scene ordering, drafts, writing goals, and configurable compilation                   | Desktop and mobile                                           | Better treated as an authoring/project source Page Foundry can interoperate with, not replace      |
| Academic Export     | Strict named academic styles with PDF and DOCX                                        | Embedded libraries, desktop and mobile                       | Demonstrates the value of verified purpose-specific presets rather than generic conversion         |
| Mobile PDF Exporter | High-fidelity export of rendered Obsidian content on phones                           | Desktop and mobile                                           | Strong for “what you see” documents; different from semantic books and controlled print production |

## Defensible product position

Page Foundry should not present itself as another universal export menu. A more
useful promise is:

> Create verified author deliverables from the same Markdown source, using
> portable publishing presets that work on desktop and mobile.

The distinctive combination is:

1. **Print-quality mobile PDF.** The embedded Typst WebAssembly renderer can
   produce fixed-page output on mobile where several competitors omit PDF or
   depend on desktop software.
2. **Purpose before format.** Authors choose Letter, General manuscript,
   Reflowable ebook, or a future KDP interior rather than configuring a generic
   converter every time.
3. **One declarative pack contract.** Public and private designs use the same
   non-executable, versioned preset/profile mechanism without putting private
   designs in the public repository.
4. **Proof and preflight.** A preset can explain missing metadata, unsupported
   constructs, page geometry, accessibility, and target-specific risks before
   the file leaves Obsidian.
5. **Cross-format intent.** PDF, EPUB, and DOCX share document semantics while
   each format receives native output instead of being converted from another
   format.
6. **Reproducibility.** Bundled, pinned compilers, fonts, styles, and validation
   rules can make the same source and pack produce predictable output offline.

## Recommended roadmap

### Completed on desktop. Make exported files easy to find and use

Implemented and accepted on Mac. Sharing is capability-checked; hosts without
file-sharing support do not show that action. Physical-device acceptance remains
part of milestone 1 below.

The first EPUB trial revealed that a successful save can be invisible in
Obsidian's file sidebar. Treat export-result discoverability as the immediate
step before physical-device acceptance and richer publishing features.

- Show a persistent result dialog after every successful export, including Save
  in vault, with the actual saved filename and vault-relative path.
- Use the final collision-resolved filename, including any numbered suffix.
- Explain when a saved EPUB or DOCX may be hidden by Obsidian's file view.
- Offer Share or save elsewhere from the completed result on every platform that
  exposes file sharing, even when the file was already saved in the vault.
- Offer Open and Show in folder only where supported by the host. Desktop
  reveal/open integration must remain isolated from the portable publishing
  core; mobile must retain a useful share/save fallback.
- Preserve the completed result when an open or share action is unavailable,
  cancelled, or fails; do not require the author to export again.
- Check the full sequence in the disposable vault: export, locate the numbered
  file, open it in a suitable reader/editor, and share/save it elsewhere.
- Keep vault display settings under the author's control.

### 1. Finish the portable proof

- Test PDF, EPUB, and DOCX generation in physical iPad and iPhone Obsidian.
- Confirm vault saving, Files/iCloud Drive, an installed share target, offline
  behaviour, peak memory, and acceptable generation time.
- Add representative Android acceptance before a public compatibility claim.

### 2. Resolve local resources safely

- Add an explicit resolver for referenced local images and later fonts.
- Show every resource that will be included before publishing.
- Reject traversal, remote fetches, unsupported media, and oversized resources
  predictably.
- Reuse the resolver for EPUB packaging, DOCX embedding, and PDF assets.

### 3. Make presets the product

- Complete and document the versioned pack schema.
- Add metadata forms, required-field validation, compatibility ranges, and
  format-specific styles.
- Ship strong neutral presets: standard manuscript, submission letter, paperback
  proof, reflowable ebook, and accessible plain document.
- Add a safe preview and validation report before export.

### 4. Add author preflight

- EPUB: metadata, navigation, language, image alt text, broken internal links,
  and accessibility checks.
- DOCX manuscript: page size, margins, font, spacing, title page, header, page
  numbering, and required recipient metadata.
- Print PDF: trim size, margins, gutter, bleed, embedded fonts, blank pages,
  recto/verso rules, and estimated page count.
- Present warnings in plain language and distinguish blockers from advice.

### 5. Add books without becoming a writing suite

- Introduce an explicit project manifest with ordered notes and roles for front
  matter, parts, chapters, scenes, and back matter.
- Provide an inclusion/order review before publishing.
- Import or adapt Longform ordering where practical rather than duplicating its
  writing goals, drafts, and project-management interface.
- Keep research notes and unrelated vault files excluded by default.

### 6. Target KDP and professional handoff

- Add verified trim profiles, gutters, mirrored margins, front-matter page
  numbering, recto chapter starts, and blank-page handling.
- Produce a proof report alongside the interior PDF.
- Add publisher-specific manuscript packs only when their requirements can be
  sourced, versioned, and tested.

## What not to optimise for

- The largest possible list of output formats; Pandoc-based plugins already win
  that contest.
- Reproducing every visual Obsidian plugin in exported output; preview-rendering
  exporters are better positioned for that purpose.
- Writing goals, scene management, and draft tracking; Longform and dedicated
  authoring tools already serve that workflow.
- Academic citation-style breadth before the core author and book workflow is
  reliable.
- Direct cloud or KDP upload before local output, preflight, and recovery are
  trustworthy.

## Sources

- [Pandoc Plugin](https://community.obsidian.md/plugins/obsidian-pandoc)
- [Pandoc GUI](https://community.obsidian.md/plugins/pandoc-gui)
- [Document Exporter](https://community.obsidian.md/plugins/document-exporter)
- [Manuscript Compiler](https://community.obsidian.md/plugins/manuscript-compiler)
- [Book Exporter](https://community.obsidian.md/plugins/book-exporter)
- [Longform](https://community.obsidian.md/plugins/longform)
- [Academic Export](https://community.obsidian.md/plugins/academic-export)
- [Mobile PDF Exporter](https://community.obsidian.md/plugins/mobile-pdf-exporter)
