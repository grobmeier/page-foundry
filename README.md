# Page Foundry

Page Foundry is an author-focused publishing companion for Obsidian. It will
turn ordinary Markdown notes and ordered manuscript projects into professional
documents using explicit, reusable publishing presets.

The project is in active feasibility development. Its current milestone
publishes the active Obsidian note as PDF, reflowable EPUB, or editable DOCX on
desktop and mobile without changing the source note.

## Direction

Page Foundry is intended to support:

- standard manuscript submissions;
- letters and simple printable documents;
- print interiors for services such as KDP;
- reflowable EPUB ebooks;
- editable DOCX exports, including a neutral general manuscript preset; and
- locally installed custom template packs.

The planned renderer runs inside Obsidian using portable browser technologies
and WebAssembly. It must not require Docker, Pandoc, LaTeX, Node.js, a native
executable, an account, or a rendering server. The Obsidian plugin provides the
author workflow, resolves vault content, validates the selected preset, and
presents build results.

## Privacy

Publishing is local by default. Page Foundry does not require an account,
telemetry, or a cloud manuscript service.

The public repository contains only neutral examples and public template packs.
Personal manuscripts, private brands, private fonts, and private design packs do
not belong in this repository. Custom packs are loaded from locations the user
explicitly configures.

## Status

Page Foundry is private while its foundations are developed, with the intention
of becoming an open source project. Its source is licensed under the Apache
License 2.0.

No production-ready plugin has been released yet.

## Current feasibility build

The development build currently provides:

- `Publish current note` in the Obsidian command palette;
- PDF, EPUB, and DOCX output selected in one dialog;
- plain-document and letter PDF presets;
- a semantic reflowable EPUB with package metadata and heading navigation;
- plain editable and general manuscript DOCX presets;
- A4 and US Letter page profiles;
- an embedded, lazily initialised Typst WebAssembly compiler;
- a configurable vault-relative output folder with collision-safe names; and
- a system-share action for mobile Files and installed storage providers.

Every export opens a persistent result showing its filename and, after a vault
save, its exact vault-relative path. Saved EPUB and DOCX files may be hidden in
Obsidian's sidebar. Use **Show in folder** or **Open in default app** on a
supported desktop host, or **Share or save elsewhere** on a host with file
sharing. The sharing button is hidden when the host cannot share the generated
file; on desktop, use **Show in folder** to access it through your file manager.
Saving from this dialog updates the result without making another copy.

Automated parsing and package-structure tests, the production build, and a
mobile-sized WebKit PDF smoke test pass. Physical iPad and iPhone acceptance
remains mandatory before mobile support is claimed. The first EPUB/DOCX slice
deliberately represents local images by their alt text until an explicit,
mobile-safe resource resolver is available.

## Development

Requirements: Node.js 22.12 or later and npm.

```sh
npm install
npm run verify
npm run test-vault
```

`npm run test-vault` creates an ignored, disposable vault at `.test-vault/`.
Open that folder as a separate Obsidian vault and never use a personal vault for
development tests. See
[`docs/architecture/mobile-rendering.md`](docs/architecture/mobile-rendering.md)
for the renderer boundary and current evidence.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), and
[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Licence

Copyright 2026 Christian Grobmeier

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE).
