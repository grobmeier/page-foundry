# Mobile rendering architecture

## Decision

Page Foundry creates PDFs on the user's device. It does not invoke Docker,
Pandoc, LaTeX, Node.js, a native executable, an account, or a rendering server.

The PDF adapter contains:

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
        |
        v
preset + page profile
        |
        v
Typst source -> embedded WebAssembly compiler -> PDF bytes
                                                |         |
                                                v         v
                                         vault folder  share sheet
```

Only the selected note and its explicit resources belong in this flow. The
renderer performs no runtime network request.

## Why sharing is a second action

Mobile operating systems require file sharing to begin from a fresh user
gesture. PDF compilation is asynchronous and may outlive the gesture that
started the export. Page Foundry therefore displays a result dialog after the
PDF is ready. The author then taps **Share or save elsewhere**, directly opening
the platform share sheet with the completed file.

## Current evidence

- The production-style single-file browser bundle is approximately 15 MB.
- A WebKit run at a phone-sized viewport generated a tagged, one-page A4 PDF.
- The generated PDF was visually rendered and contained the expected heading,
  paragraph, bold text, and embedded font.
- Browser request inspection showed only the local HTML and bundle requests; PDF
  generation made no additional request.

This is browser-engine evidence, not physical-device acceptance. A packaged
plugin must still pass in Obsidian on iPad and iPhone, including offline use,
memory and duration observations, vault saving, Files/iCloud Drive, and an
installed cloud-provider share target.

## Known constraints

- The embedded compiler dominates the plugin size.
- Arbitrary Typst packages are not available: presets must carry their explicit
  local resources.
- PDF standard and accessibility options exposed by the browser compiler must be
  verified before claiming printer, archival, or accessibility compliance.
- EPUB and DOCX require separate output adapters over the same document model;
  they are not conversions of the PDF.
