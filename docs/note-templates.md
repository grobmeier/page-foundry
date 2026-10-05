# Note templates and output presets

Create notes first; publish them when ready. Typst is the internal PDF engine,
not Markdown itself. Your source files remain ordinary Obsidian Markdown notes.

## Create and edit a document

Run **Page Foundry: Create new note**, choose a note template and enter its
filename, folder and details. **Create note** saves a new Markdown file and
opens it. It does not publish, copy the active note or overwrite an existing
file. Incomplete publication fields are allowed in drafts. Missing folders are
only created if you explicitly enable **Create missing folders**.

Use **Edit document details** to save properties later. Letters have separate
sender/recipient names and multiline addresses, subject, salutation and closing.
The form saves readable YAML strings, not nested address objects. Write only the
letter body in the note: the letter PDF adds its salutation and closing.
Publishing supports the old `from` and `to` blocks too. Fields edited only in
the export form are temporary and do not change the source note.

For a legacy letter, Edit document details shows the first line of each old
block as its name and the remaining lines as its address. Review those fields;
Save explicitly replaces the old blocks, while Cancel leaves them intact.

**Publish** and **Publish recent** choose PDF, EPUB, DOCX and compatible output
layouts. **Create recent** remembers note templates separately. Histories
contain only template/layout keys and usage, not addresses, manuscript text or
filenames.

## Readable book plans

Create a **Book** note, then use **Edit document details** to add existing
notes. An empty draft book is allowed; publication needs at least one included
section. The form saves a bounded Markdown order region between hidden comments.
Its headings and direct links look like this:

```markdown
## Opening pages

- [[Book/Preface.md|Preface]]

## Part: First steps

## Chapter: Arrival

- [[Book/Arrival.md|Arrival]]

## Scene: At the station

- [[Book/Station.md|At the station]]

## Closing pages

- [[Book/Afterword.md|Afterword]]
```

Only recognised level-two role headings and their direct bullet links define the
order. Chapter/Scene sections contain one link; Opening/Closing pages may group
several. A Part can be a heading alone, or introduce chapter links. Use exact
vault-relative `.md` paths, not ambiguous names or embedded notes. Other
headings, prose and fenced examples do not include files. Do not delete the
order boundary comments or the generated section comments: these preserve scope
and destinations. Page Foundry hides its control comments in Live Preview; they
remain editable in source mode, and normal author comments are left alone.
Manually authored plans without boundary comments are also supported; saving
through the form adds the bounded region and retains explanatory prose.

Legacy YAML plans remain readable. Use **Convert to readable book plan** and
review **Convert and save** to replace their nested `entries` with this outline.
The conversion preserves IDs, order and prose; stale saves are rejected. It
never edits chapters. The old format is retained until you explicitly convert
it.

## Make a private note template

1. Prepare a neutral starting note, or select an existing note deliberately.
2. Run **Save as note template**. Choose an exact Markdown path in an existing
   local vault folder; its filename becomes its display name.
3. Review the full copy preview. **Clear personal properties** defaults on,
   clearing author, address/name blocks, salutation, surname, date, subject and
   publication identifier. It does not redact body text; inspect that yourself
   before saving.
4. Save. The template is registered and appears in **Create new note**. Edit the
   saved Markdown template normally to change it.

Use simple scalar YAML properties. Templates do not support nested
objects/lists, code execution, shell commands or automatic includes. Each
template is at most 128 KiB, with up to 30 exact registered paths in settings.
Missing or changed templates are explained rather than silently replaced.
Removing a registration does not delete its file. No unrelated vault folders are
scanned.

The optional placeholders are `{{title}}`, `{{author}}`, `{{language}}` and
`{{date}}`. They are replaced as text with YAML-safe serialization and Markdown
escaping; arbitrary expressions are rejected. Unknown scalar properties are
retained as template defaults, but the details form exposes the supported
fields.

```markdown
---
document: manuscript
title: "{{title}}"
author: "{{author}}"
language: en-GB
---

# {{title}}

Start writing here.
```

## Make a private output preset

Run **Manage output presets**, choose a starting recipe, name your preset and
adjust supported size, spacing, margins, colour and fonts. Save to an exact
local JSON pack path in an existing folder. The form writes/validates the pack
for you; you do not need to write JSON. The configured pack's existing presets
can be edited in the same form. Blank overrides retain each format's settings.

The editor preserves other presets and metadata definitions, increments the
local pack version and rejects stale/moved saves. It never edits core presets or
overwrites an existing unconfigured file. Invalid or incompatible packs must be
repaired or explicitly unconfigured, not silently replaced. Recipe/metadata
schema editing remains an advanced [pack-authoring](preset-packs.md) feature.

The engine's limits still apply: PDF bundles Libertinus Serif; arbitrary fonts,
assets, executable Typst/LaTeX templates and decorative chapter/title-page
designs are not supported yet. Paperback geometry and black ink follow measured
proof rules rather than general margin/colour overrides. EPUB readers can change
typography. An existing `.tex` design requires an intentional port, not an
import that promises identical results.

## Privacy and saving

Keep real templates, manuscripts, fonts, artwork and output packs outside this
repository. Page Foundry makes no template uploads and runs no rendering server.
Your vault sync, backups and folder sharing have independent privacy settings;
"private template" does not mean encrypted or excluded from those systems.
Registered paths live in local plugin settings, not a remote account.

New notes use the **New-note folder**, which is separate from the configurable
generated **Output folder**. Generated EPUB/DOCX may be hidden in Obsidian's
file list. The result dialog shows the actual saved path and offers supported
desktop open/reveal or mobile share/save actions. Physical-device acceptance is
pending.
