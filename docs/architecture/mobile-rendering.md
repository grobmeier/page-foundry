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
        |-- preset + page profile -> Typst WebAssembly -> PDF
        |-- ebook metadata + semantic XHTML -> EPUB 3 ZIP
        `-- editable/manuscript styles -> Office Open XML DOCX
                                                    |         |
                                                    v         v
                                             vault folder  share sheet
```

Only the selected note and its explicit resources belong in this flow. The
renderer performs no runtime network request.

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

This is browser-engine and desktop-rendering evidence, not physical-device
acceptance. A packaged plugin must still pass in Obsidian on iPad and iPhone,
including offline use, memory and duration observations, vault saving,
Files/iCloud Drive, and an installed cloud-provider share target.

## Known constraints

- The embedded compiler dominates the plugin size.
- Arbitrary Typst packages are not available: presets must carry their explicit
  local resources.
- PDF standard and accessibility options exposed by the browser compiler must be
  verified before claiming printer, archival, or accessibility compliance.
- EPUB is reflowable and semantic; DOCX remains editable. Neither is a
  conversion of the PDF, so exact visual identity across formats is not a goal.
- EPUBCheck and visual opening in mainstream readers/editors remain part of
  release validation rather than the mobile runtime.
