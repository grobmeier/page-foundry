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

- a built-in **Cheat Sheet**, friendly book-order labels, and collapsed layout,
  resource and report details; blocking problems remain visible on the form;
- **Create** and **Create recent** with a searchable template picker: letters,
  manuscripts, documents and ebooks, plus six paperback size/paper combinations
  with right-hand or next-page chapter starts. Most-used layouts appear first;
  recent history stores only layout choices and can be cleared in settings;
- **Set up book** to create or edit a book plan visually: add sections, choose
  their note paths, and move them into reading order. IDs are managed
  internally; saves reject changed plans and never rewrite chapter notes;

- `Publish current note` in the Obsidian command palette;
- `Publish current book` for an explicit ordered Markdown manifest, with
  inclusion/order review, front/back matter, parts, chapters and continuous
  scenes;
- a PDF-only no-bleed paperback proof recipe with three trim sizes, mirrored
  page-count-based gutters, Roman front matter, optional right-hand starts and
  an actual-pagination proof report;
- PDF, EPUB, and DOCX output selected in one dialog;
- plain-document, letter, submission-letter, manuscript and print-proof PDF
  presets;
- a semantic reflowable EPUB with package metadata and heading navigation;
- plain editable and general manuscript DOCX presets;
- versioned, opt-in JSON preset packs with bounded styles, export-only metadata
  forms, required-field validation and a layout review;
- local author preflight with blockers, advice, unchecked limitations, optional
  report copying and validated EPUB heading links;
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

## Ordered books

For the everyday workflow, run **Page Foundry: Set up book**. Add the notes in
reading order and save the plan, then run **Create** to choose a book template.
Open an existing plan and run **Set up book** to edit it. The form manages the
technical fields below for you; editing YAML is optional, not required.

Open a Markdown manifest and run **Page Foundry: Publish current book**. Its
leading YAML contains `page-foundry-book: 1`, a book `title`, optional author/
language/identifier metadata and an ordered `entries` list. Each entry has a
unique lowercase hyphenated `id`, a `role` and an exact vault-relative Markdown
`path`; a heading-only `part` may use `title` instead of a path. Roles are
`front-matter`, `part`, `chapter`, `scene` and `back-matter`.

Only listed notes and their explicit images are included. Manifest prose and
chapter metadata are not imported. PDF/DOCX have one book title page and new
pages for non-scene entries. EPUB uses scoped destinations for links to included
notes; links outside the list become plain labels. Sources are never rewritten.
Change order in the manifest and refresh review. Before saving, all included
sources and resources are checked again; changes require a new review.

The isolated test vault contains `A Neutral Journey.book.md` and its five source
notes. Follow the [ordered book test plan](docs/testing/ordered-books.md).
Limits: 128 KiB manifest, 50 entries, 2 MiB per note, 20 MiB total note text; 50
unique images, 5 MiB each and 20 MiB combined. There are no globs, nested
project expansion or automatic vault discovery. No-bleed paperback geometry is
available below; full retailer/physical proof acceptance remains external.

## Paperback proofs

Select **Paperback interior (no bleed)** while publishing an ordered book.
Choose 5 × 8, 5.5 × 8.5 or 6 × 9 inch, black ink on white/cream paper, and
right-hand or next-page part/chapter starts. Print geometry overrides ordinary
A4/US Letter and style margins. The local renderer counts physical pages and
increases the mirrored gutter when the measured count requires it. Leading front
matter has Roman numbers; body numbers are Arabic. Inserted blank pages are
genuinely unnumbered.

The result includes a visible, explicitly copyable proof report with dimensions,
margins, measured section/blank-page positions and supported page-count range.
It is not upload certification: bleed, covers/spines, greyscale image
conversion, image DPI, accessibility and retailer/physical proof acceptance are
excluded. Short books may be exported for inspection but are labelled **Proof
only**. See the [paperback proof test plan](docs/testing/paperback-proof.md),
also installed as `Paperback proof test plan.md` in the isolated vault.

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

### Author preflight

The publish dialog checks the current note, selected preset and reviewed
resources. Empty content, required metadata and broken/ambiguous EPUB heading
links block creation. Missing author/descriptions, heading gaps, stripped links
and literal HTML/code formatting are advice. Other notes and external targets
are not read or tested. Named EPUB heading links resolve to the same IDs used by
the table of contents; PDF/DOCX heading links are currently plain labels.

The report explicitly lists checks it did not perform. It does not certify KDP,
publisher rules, rendered-page layout or accessibility. Copying is an optional,
explicit action, not storage or automatic sharing. See the
[author preflight checklist](docs/testing/author-preflight.md), included in the
test vault alongside neutral clean/advice/blocker notes.

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
