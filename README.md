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
- plain-document, letter, submission-letter, manuscript and print-proof PDF
  presets;
- a semantic reflowable EPUB with package metadata and heading navigation;
- plain editable and general manuscript DOCX presets;
- versioned, opt-in JSON preset packs with bounded styles, export-only metadata
  forms, required-field validation and a layout review;
- local PNG/JPEG images in all three formats, with resource review and safety
  checks before export;
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
remains mandatory before mobile support is claimed. Local-image export also
passes an offline, phone-sized WebKit run and EPUBCheck; physical-device memory,
performance and sharing checks remain pending.

### Local images

Use Markdown images (`![Description](Artwork/panel.png)`), reference-style
images, or Obsidian embeds (`![[Artwork/panel.png|300]]`). A numeric embed alias
sets a maximum width in pixels; a text alias supplies alt text. Aspect ratio is
preserved and images are not upscaled. The publish dialog lists unique resolved
images and explains blocking errors or non-blocking alt-text advice.

Only referenced PNG/JPEG vault attachments are read. Remote URLs, absolute
filesystem paths, parent traversal, HTML images and other media types are
rejected. Limits are 5 MiB per image, 20 MiB total, 50 unique images, and 20
megapixels per image. These are safeguards, not mobile performance promises. If
the note or attachments change after review, publishing returns to a fresh
review. No manuscript or image is uploaded by the plugin.

See the
[combined desktop/mobile test plan](docs/testing/local-images-and-mobile.md).
The test-vault installer includes **Portable images.md**, PNG/JPEG artwork,
safety-case notes, and **Page Foundry test plan.md** for convenient testing.

## Development

### Preset packs

Set an explicit vault-relative JSON file in **Preset pack path** to enable a
custom design. The built-in and custom presets use the same safe contract; packs
cannot execute code, scan the vault or replace core. Private designs stay
outside this repository. See [pack authoring](docs/preset-packs.md) and the
[milestone test plan](docs/testing/preset-packs.md), also copied into the test
vault alongside a neutral example. Invalid packs block publishing; changed packs
return to review before export. Layout review is a summary, not a rendered
preview. Print-proof and readable presets do not certify KDP/accessibility
compliance.

### Build and isolated test vault

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
