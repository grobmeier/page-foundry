# Make your own book design

A book design saves your PDF appearance. Its title, author, subtitle, imprint
and chapter order come from your Markdown book, so you can reuse one design for
several books. A note template is separate: it supplies starting text and
properties when you create a new note. For a complete first setup, follow the
[private-template walkthrough](custom-templates.md).

## Create and use a design

1. Open a book plan. Use **Edit document details** to set its title, optional
   subtitle and imprint, and add its existing chapter notes.
2. Run **Page Foundry: Manage designs → Book designs**. Choose **New design**,
   give it a name and select **Book PDF** or **Paperback proof**.
3. Open the relevant sections to adjust opening pages, chapters, body type and
   headers. **More layout controls** contains detailed title/rule dimensions and
   ordinary PDF margins. Paperback margins remain measured and protected.
4. Click **Create proof** to see your unsaved design on the active book. This
   creates a separate PDF in your configured output folder; it does not save the
   design or assign it to the book. Reopen the editor if the source book,
   chapter files or configured pack change while the form is open.
5. **Save book design** stores the design in the exact local pack path shown by
   the form. Use an existing vault folder. Nothing is uploaded.
6. Run **Publish → Change layout** and choose your saved design by name. After
   successful publication, Publish remembers it for that book and opens it
   directly next time. Paperback controls on Publish can override the design's
   trim, paper and chapter-start defaults for that export.

The contents list includes opening/closing matter, parts and chapters, with
links to their final pages; scene entries are not separate contents rows. The
title, imprint and contents pages have no running furniture. Other opening
matter uses Roman numbers; body pages use Arabic numbers. Chapter openings
suppress headers, while later pages use the selected book/chapter title.
Generated blanks have no header or footer. Inspect the whole proof, especially
long headings and page transitions, before publication.

**Extra paragraph spacing** adds a gap after the normal line separation. Zero
keeps paragraphs on the same line rhythm as the body, with first-line indents
providing the distinction.

## Edit or duplicate a design

Manage designs → Book designs lists the book designs in your configured pack.
Select one to edit it, or click **Duplicate design** to keep the original and
make a new variation. Saving preserves the other presets in the pack. Cancel
writes nothing.

Book controls use pack version 2. Existing version-1 packs still work. When
adding book controls to an older pack, the form defaults to **Save a copy** and
suggests a different filename. The original remains usable by older plugin
versions. If that copy already exists, choose another name; it is never replaced
silently. Switch off Save a copy only when you deliberately want an in-place
upgrade. Older plugin versions cannot read the upgraded pack.

## Keep designs private

Keep real designs, starter notes, fonts, artwork and proofs in your private
vault, outside the public engine checkout. Configure an exact pack path in Page
Foundry settings; it reads that pack, not whole design folders. The same private
pack remains editable through the form. Removing its configured path does not
delete it.

Vault sync, backups and folder-sharing rules control who else can see these
files. Calling a design private does not encrypt it or make a shared vault
private. The plugin uploads neither your pack nor your manuscript, and the
release packager excludes local vaults and packs.

## Current limits

These controls apply to ordered-book PDFs. EPUB and DOCX remain available but do
not inherit print-page design controls. PDF uses bundled Libertinus Serif;
custom fonts, ornaments, opening initials and imported artwork are later work.
These and the other design limitations are tracked in the [roadmap](roadmap.md).
Existing LaTeX templates must be ported to the supported controls, not pasted
into the editor. No Docker, Pandoc, TeX installation or rendering account is
needed. Paperback output is a no-bleed black-ink proof, not retailer acceptance
or print-quality certification.

Developers can regenerate neutral 50-chapter ordinary/print proofs with
`npm run test:book-pdf`. The command writes into a fresh temporary directory and
prints its path. It never reads a user vault or private design collection. It
also creates 27 short paragraph proofs across A4, US Letter and paperback
layouts, with three type/line-spacing settings and zero, 3 mm and 12 mm extra
paragraph gaps. With Python and `pdfplumber` installed, verify their actual PDF
coordinates using `python3 scripts/check-pdf-paragraphs.py <printed-directory>`.
Inspect rendered pages as well as running the coordinate check.
