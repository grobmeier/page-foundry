# Your own templates, from starting note to finished book

There are two reusable pieces. A **note template** provides starting writing and
properties. An **output design** controls how a published file looks. You can
use either independently; neither needs to be contributed to the plugin.

## First: choose private storage

Create folders such as `Templates/Studio` and `Designs/Studio` in your private
Obsidian vault, outside the public plugin checkout. These are suggested names,
not required folders. Page Foundry uses exact registered paths, not a folder
scan. Keep private writing, artwork, fonts and generated proofs there too.

The plugin does not upload these files. Vault sync, backups, Git and shared
folders are separate: a file in a public or shared vault is not made private by
calling it a private template. An ignored development folder is not a substitute
for keeping real designs outside the public repository.

## Save your starting note

1. Create a Manuscript, Letter or other supported note and set its reusable
   properties through **Edit document details**. Put the greeting and sign-off
   of a letter in the writing, not in extra properties.
2. Run **Page Foundry: Save as note template** and choose, for example,
   `Templates/Studio/Manuscript.md` in an existing folder.
3. Review the copy. **Clear personal properties** is on by default. Turn it off
   only if you deliberately want to retain your own author/address details in
   this private starter. Body text is not redacted automatically.
4. Save. The starter appears in **Create new note**. Edit the saved Markdown
   file normally whenever you want to improve it.

For variable titles, your saved template can contain:

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

Creating a note copies the starter; later template edits do not rewrite existing
notes. See [note templates](note-templates.md) for placeholders and limits.

## Design your book's PDF

1. Open an ordered Book plan. Set its title, author, optional subtitle and
   imprint through **Edit document details**, and include chapter notes.
2. Run **Page Foundry: Manage designs → Book designs → New design**. Give the
   design a recognisable name. Choose **Book PDF** for A4/US Letter or
   **Paperback proof** for a supported book trim.
3. Adjust **Opening pages**, **Chapter openings**, and **Body and running
   headers**. Use **More layout controls** for finer dimensions. Zero extra
   paragraph spacing means normal line separation with no additional gap.
4. Choose **Create proof**, inspect the PDF, then adjust. This proof does not
   save the design or change the book's selected layout.
5. Set **Local pack file** to, for example, `Designs/Studio/book-designs.json`,
   then **Save book design**. The form writes the JSON and registers the pack;
   you do not have to edit JSON yourself.
6. Use **Publish → Change layout** and select your design. After successful
   publication, that book remembers it. Reopen Manage designs to edit or
   duplicate the saved design.

One configured pack can hold several designs. Keep it backed up, and transfer it
and its configuration to each vault where you want to use it. Removing a
registration does not delete the file. See [book designs](book-designs.md) for
page-numbering rules, copies and stale-save protection. For individual letters
or manuscripts, use **Manage designs → Document designs** instead.

## Adapt an existing LaTeX design

Use a reference PDF as a visual specification: note the trim, title position,
chapter size/alignment, rule, indent, line spacing and running headers. Recreate
the supported choices in the form, then compare proofs. Put book-specific words
in the book's properties and chapters; keep reusable appearance in the design.

This is a port, not a `.tex` import. PDF currently uses bundled Libertinus
Serif. Arbitrary fonts, ornaments, drop caps and decorative imported artwork are
not supported by the design editor. Referenced PNG/JPEG images inside your
writing are supported, but are not interchangeable with page decorations. The
plugin does not run custom LaTeX or Typst code. EPUB and DOCX use their own
layouts rather than reproducing a PDF page design.

Start with one representative book and the closest supported layout. If its
identity depends on unsupported typography or artwork, keep the existing LaTeX
production workflow for the finished edition and use Page Foundry for writing,
submissions and reading proofs until those capabilities exist.
