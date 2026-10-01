# Mobile rendering architecture

## Decision

Page Foundry creates PDF, EPUB, and DOCX files on the user's device. It does not
invoke Docker, Pandoc, LaTeX, Node.js, a native executable, an account, or a
rendering server.

The shared publishing path contains a portable Markdown document model and
format-neutral output result. The PDF adapter contains:

1. a portable Markdown document model;
2. a Typst source generator;
3. the Typst WebAssembly compiler; and
4. the Libertinus Serif OpenType faces required by the initial presets.

The compiler and fonts are compressed during the build and encoded inside the
single `main.js` file accepted by Obsidian's community-plugin installation. They
remain encoded until the author requests a PDF. Normal plugin start-up does not
initialise WebAssembly or decode font binaries.

## Data flow

```text
active Markdown note
        |
        v
portable document model
        |-- explicit vault images -> validation + review + byte snapshot
        |-- configured pack JSON -> strict schema + metadata + layout review
        |-- preset + page profile -> Typst WebAssembly -> PDF
        |-- ebook metadata + semantic XHTML -> EPUB 3 ZIP
        `-- editable/manuscript styles -> Office Open XML DOCX
                                                    |         |
                                                    v         v
                                             vault folder  share sheet
```

Only the selected note and its explicit resources belong in this flow. The
renderer performs no runtime network request.

## Referenced image resources

The Markdown model preserves image references, per-occurrence alt text and
optional Obsidian width aliases. A Markdown parser extension recognises wiki
embeds without scanning escaped text or code. A pure resolver/validator works
through a narrow host interface; the Obsidian adapter uses link resolution and
binary reads only for explicitly referenced vault files.

PNG/JPEG byte signatures, dimensions, decodeability and bounded source sizes are
checked before rendering. Parent traversal, remote resources, unsupported media
and HTML images block export. Unique resolved paths are deduplicated. The
publish dialog lists assets and warnings. Immediately before publishing, the
plugin rereads the note and images and compares the source and SHA-256 resource
signature; changes return the author to review. Exporters consume the fresh
in-memory snapshot, not vault paths.

EPUB receives local image parts and manifest entries, DOCX receives internal
image relationships and alt descriptions, and Typst receives generated safe
asset paths in its in-memory filesystem. PDF compilation is serialised, with
shadow assets reset before and after each build, including failures. Styles
preserve proportions, avoid upscaling and bound physical-page image dimensions.
No new runtime dependency or desktop requirement was introduced.

## Preset pack boundary

The bundled core pack and an optional explicitly configured vault JSON file
share one strict schema. Pack and preset IDs, engine compatibility, format
recipes, metadata fields and bounded style values are validated before the
dialog opens. Invalid configured packs block creation. Private pack IDs are
namespaced and cannot override the bundled pack. The vault adapter reads only
the configured file, at most 128 KiB; there is no folder enumeration.

Metadata forms copy original note values and pack defaults into an export-only
selection. Preset changes reset those fields to prevent cross-preset leakage. No
entered metadata is stored in plugin settings. The review is a resolved layout
summary, not live pagination. Before rendering, the configured pack is read
again and its exact source/path compared with the reviewed snapshot; changes
reopen review. Pack contents never become executable source: only allow-listed
recipes and numeric/colour/font values reach the renderers.

Schema v1 has no code, arbitrary stylesheets, fonts, asset paths, hooks or
remote resources. Fonts/artwork in richer private design packs require a later
schema extension. The existing selected-note image pipeline stays independent.

## Why sharing is a second action

Mobile operating systems require file sharing to begin from a fresh user
gesture. Document generation is asynchronous and may outlive the gesture that
started the export. Page Foundry therefore displays a result dialog after the
file is ready. The author then taps **Share or save elsewhere**, directly
opening the platform share sheet with the completed file. The action is shown
only when both sharing APIs exist and the host confirms support for the
generated file. Unsupported desktop hosts retain vault saving and the available
system open/reveal actions.

## Current evidence

Every export, including a vault save, opens the completed-file dialog. It keeps
the actual saved path and shares the collision-resolved filename. The optional
desktop file-actions adapter loads Electron only after verifying a desktop
filesystem host. It offers the system's open/reveal actions when available.
Rendering, vault saving, and mobile sharing do not depend on Electron. Result
tests cover mobile isolation, desktop paths, unavailable or rejected sharing,
duplicate-save prevention, and retry after a failed save; physical-device
verification remains pending.

- The production-style single-file browser bundle is approximately 15 MB.
- A WebKit run at a phone-sized viewport generated a tagged, one-page A4 PDF.
- A mobile-emulated WebKit run generated PDF, EPUB, and DOCX in one session,
  opened the two ZIP-based formats in memory, and found their required package
  documents. Its only requests were the local test page and JavaScript bundle.
- The generated EPUB passes EPUBCheck 5.4.0 with no errors or warnings.
- The generated General manuscript DOCX passes structural tests and renders as a
  clean A4 title page plus a numbered manuscript page with a running header.
- The generated PDF was visually rendered and contained the expected heading,
  paragraph, bold text, and embedded font.
- Browser request inspection showed only the local HTML and bundle requests; PDF
  generation made no additional request.
- The local-image milestone passes 41 automated tests, including review UI and
  mocked-Obsidian review/export changes, resource limits, JPEG/PNG bytes, native
  packaging, and parser escapes/reference images.
- A phone-sized WebKit session generated PDF, EPUB and DOCX with landscape PNG,
  portrait JPEG and repeated/sized images, then repeated generation offline. A
  later image-free PDF succeeded with the same compiler. There were no browser
  console errors; requests were only the loopback page and bundle.
- The image-enabled EPUB passes EPUBCheck 5.4.0 with zero messages. The PDF and
  manuscript DOCX were rendered for visual inspection of image proportions, page
  fit, title/header/page numbering, and heading placement.
- The preset-pack milestone passes 54 automated tests and the production build,
  including strict pack validation, metadata isolation, native style output,
  explicit vault reads, invalid-pack blocking and changed-pack re-review.
- WebKit at 390 × 844 generated manuscript/submission-letter PDFs and neutral
  custom PDF/DOCX/EPUB styles offline, alongside the image regression outputs
  and later image-free PDF. Requests were only the loopback page and bundle;
  there were no browser warnings or errors. The custom EPUB passes EPUBCheck
  with zero messages. Manuscript title/body pages, letter opening/closing and
  custom PDF/DOCX layouts were rendered and inspected visually.

This is browser-engine and desktop-rendering evidence, not physical-device
acceptance. A packaged plugin must still pass in Obsidian on iPad and iPhone,
including offline use, memory and duration observations, vault saving,
Files/iCloud Drive, and an installed cloud-provider share target.

## Known constraints

- The embedded compiler dominates the plugin size.
- Arbitrary Typst packages are not available. Schema-v1 preset packs cannot
  introduce font/asset files; the engine carries its approved fonts and the
  note's selected images use the separate resource resolver.
- PDF standard and accessibility options exposed by the browser compiler must be
  verified before claiming printer, archival, or accessibility compliance.
- EPUB is reflowable and semantic; DOCX remains editable. Neither is a
  conversion of the PDF, so exact visual identity across formats is not a goal.
- EPUBCheck and visual opening in mainstream readers/editors remain part of
  release validation rather than the mobile runtime.
