# Author workflow acceptance

Use the isolated test vault and its **Start here** note. The neutral
**Examples** tree covers every starter, all output formats, book roles,
paperback options, tables/images/code, custom designs and expected errors. Do
not copy private designs or personal writing into development fixtures.

## Short first-release check

1. **Create new note → Letter**. Use a new filename and invented names with
   two-line addresses. Expect a new Markdown note, no PDF and no change to the
   previously open note. Cancel another creation and test a filename collision.
2. **Edit document details**. Check readable addresses. Switch Document type to
   Manuscript, enter a header surname, then switch back: your address must still
   be present. Cancel: the source must be identical.
3. Repeat and **Save details** as Manuscript. Expect unchanged writing and
   retained addresses/custom properties, plus the chosen type and edited fields.
   No starter text should be inserted. **Publish** must open General manuscript
   PDF rather than a previously remembered letter design. Change back to Letter,
   save, then Publish: expect Letter PDF. Same-type saves retain output choices.
4. Try a note with no properties, and a disposable note with an unknown
   `document` value. The form should allow an explicit type choice. Open the
   form, then edit or move the source elsewhere: Save must refuse to overwrite.
5. In Publish, open **Document details (export only)**. Changes here must not
   change the note. **Edit saved document details** closes export review and
   opens the persistent form; its warning explains that unsaved export choices
   are discarded. Cancel this form without changing anything.
6. Open **Examples/Book/Reading order.book**. Edit document details must open
   the ordered-plan editor, not a prose type selector. Check all six sections,
   reorder and publish PDF/EPUB/DOCX. Included chapter notes must remain
   unchanged.
7. Run **Manage designs**. Expect Book designs and Document designs. Test custom
   appearance only at a new local path or in a deliberate copy; do not overwrite
   retained owner designs. See [book designs](../book-designs.md).
8. Inspect the palette with a Markdown note active: only Publish, Create new
   note, Create recent, Edit document details, Save as note template, Manage
   designs and Cheat Sheet. No migration commands or duplicate Publish aliases.
   Repeat the details → type → Save → Publish path using the keyboard.

The existing Start here route adds formatting, paperback, offline, file-location
and private-template checks. Physical iPad/iPhone/Android rendering, memory and
Files/iCloud/installed share targets remain separate acceptance gates. Inspect
paperback PDFs, retailer previews and physical proofs separately.
