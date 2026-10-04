# Preset packs

Page Foundry supports an optional, self-contained JSON preset pack in addition
to its built-in pack. All packs use the same versioned, validated contract.
Private packs remain in the user's vault, outside this repository. The plugin
does not scan folders, download packs, or upload their contents.

## Install and use

1. Copy a pack into a vault folder, for example
   `Designs/page-foundry-pack.json`.
2. Enter that exact path in **Settings → Page Foundry → Preset pack path**.
3. Run **Publish current note** and select the named preset for PDF, EPUB or
   DOCX.
4. Review its pack version, recipe, page size and layout settings. Complete any
   required metadata, then create the file.

Clear the path to disable the custom pack. Invalid or missing configured packs
block publishing with an explanation; they do not silently fall back to core.
The pack is freshly read and validated before each export. If its contents or
configured path changed since review, the dialog reopens for review without
creating a file. The current export choices are retained where compatible.

The preview is a **layout summary**, not a pixel-accurate rendering. The output
result and saved file remain the authoritative proof. EPUB reader settings may
override typography; DOCX fonts depend on the editor/device.

## Contract, schema version 1

Start from
[the neutral example](../examples/neutral-pack/page-foundry-pack.json). Unknown
fields are rejected at every level. There is no code execution: JavaScript, CSS,
HTML, raw Typst, macros, hooks, external resources, font files, and assets are
**not supported** in this version. Future richer design packs need a separately
reviewed schema extension, not a bypass of this boundary.

| Field           | Meaning                                                                    |
| --------------- | -------------------------------------------------------------------------- |
| `schemaVersion` | Exactly `1`                                                                |
| `id`            | Lowercase hyphenated identifier, at most 64 characters; must not be `core` |
| `name`          | Display name, at most 160 characters                                       |
| `version`       | Numeric `major.minor.patch`, at most 32 characters                         |
| `compatibility` | `minEngine` and `maxEngine`, positive integer range including engine `1`   |
| `presets`       | 1–30 presets with unique IDs inside this pack                              |

Each preset has `id`, `name`, `description` (at most 1,000 characters),
`outputs`, and `metadata`. Output keys are only `pdf`, `epub`, and `docx`; at
least one is required. Each output has a required `recipe` and optional `style`.
Custom selections are namespaced as `pack-id:preset-id` and cannot replace core.

`paperback-interior` is available only when publishing an explicit ordered book.
Its export-only trim/paper/start controls and measured proof report are supplied
by the host; packs cannot supply executable print layouts. Fixed mirrored
geometry and black text override pack margin/colour values; supported body size
and leading still apply. Bleed, cover/spine and image greyscale conversion are
not supported. See [paperback proof testing](testing/paperback-proof.md).

| Format | Supported recipes                                              |
| ------ | -------------------------------------------------------------- |
| PDF    | `plain-document`, `letter`, `manuscript`, `paperback-interior` |
| EPUB   | `reflowable-ebook`                                             |
| DOCX   | `plain-editable`, `general-manuscript`                         |

Styles accept only the following values. Missing values use the recipe default.

| Setting                  | PDF / DOCX                                                                          | EPUB                               |
| ------------------------ | ----------------------------------------------------------------------------------- | ---------------------------------- |
| `bodySizePt`             | 8–24 points                                                                         | Not supported                      |
| `marginXmm`, `marginYmm` | 12–40 mm                                                                            | Not supported                      |
| `lineSpacing`            | 1–3; PDF uses a font-relative leading adjustment                                    | 1–3                                |
| `color`                  | Six-digit hex colour, e.g. `#243b53`                                                | Same                               |
| `font`                   | PDF: `Libertinus Serif`; DOCX: `Times New Roman`, `Arial`, `Calibri`, `Courier New` | `serif`, `sans-serif`, `monospace` |

The manifest is limited to 128 KiB of UTF-8. Its path must be a vault-relative
JSON file, not an absolute path, URL, or parent traversal. Only that exact file
is read; no unrelated vault content is enumerated. Stored plugin settings
contain the configured path and last selected preset IDs, not pack contents or
entered manuscript metadata. Vault sync and backups may of course carry the
pack: choose their privacy settings independently.

## Metadata forms

`metadata` is a bounded list of objects with `key`, `label`, optional boolean
`required`, and optional `default`. Supported unique keys are:

`title`, `author`, `language`, `identifier`, `surname`, `short-title`, `from`,
`to`, `date`, `subject`, `closing`.

Each entered/default value is at most 2,000 characters. Unsupported control
characters are rejected. Sender/recipient controls accept multiline addresses.
Blank required fields block export. Prefill precedence is note frontmatter, note
title (for `title`) or `lang` (for `language`), pack default, then empty. EPUB
always exposes a publication-language field and requires a language tag such as
`en`, `en-GB`, or `de`. If the note and pack supply no language, the plugin's
configured default publication language is used.

Edits apply only to the current export: they do not rewrite the note or save
metadata in plugin settings. Switching presets resets the form from the original
note and new pack defaults, so values entered for another design do not leak
into it. Clearing an optional field removes that frontmatter value from the
export; recipe fallbacks may then apply. Metadata not listed by the preset
remains the original note's metadata. An empty EPUB identifier generates a fresh
local identifier.

## Built-in presets

Core includes plain PDF, letter, submission letter, plain editable DOCX, general
manuscript (PDF and DOCX), reflowable ebook, generic print proof, and readable
plain output (PDF/EPUB/DOCX). General manuscript has a title page, running
surname/title/page header, manuscript spacing and first-line indents. Submission
letter requires author, recipient and subject. These are starting points, not
certification against every publisher's requirements. The generic print proof is
**not KDP-ready**, and readable plain is **not accessibility certification**.
Those checks remain later roadmap work.

Only neutral packs belong in this repository. Keep real designs, branding,
manuscripts, fonts, artwork and metadata in separately configured private packs.
