# Start here with Page Foundry

Create a note, write in Markdown, then publish when ready. The note is your
original; PDF, EPUB and DOCX are separate generated files. No Docker or
rendering account is needed.

## Write a letter

1. Run **Page Foundry: Create new note → Letter**. Choose a filename and fill
   sender/recipient names, addresses and date. Subject is optional. Create it.
2. Edit the greeting, writing, sign-off and signature directly in the note body.
   The signature starts with the sender name entered at creation; later changes
   to address properties do not rewrite your prose. Use **Edit document
   details** when you want to save different addresses or a subject.
3. Run **Page Foundry: Publish**. It opens Letter PDF automatically. Check the
   layout and destination, then **Create PDF**. The result shows the actual path
   in your configured output folder, normally **Page Foundry**.

New letters do not need Salutation, Closing, Author or a default Language
property. **More details** offers a language override. Ordinary Markdown remains
editable without Page Foundry.

Older letters still use their greeting/closing properties. To simplify one, run
**Move letter greeting and sign-off into writing**. Review the complete body
before saving; remove any repeated phrases. Cancel changes nothing. Do not
delete old properties blindly, because they may still supply printed content.

## Manuscripts and books

**Create new note → Manuscript** prepares a single manuscript note. **Book**
prepares a reading-order plan for existing chapter notes. Use **Edit document
details** on the book to add exact chapter paths and arrange them. Publish the
book plan to include its listed chapters; publishing a chapter exports only that
chapter. New book plans use readable headings and links, not JSON properties.

## Change the output or make a template

Publish remembers a successfully used layout for each note. It does not reuse
addresses from other notes. Change the format on the Publish form, or choose
**Change layout**. **More layouts** includes specialist sizes and paperback
proofs. Letter address formatting is PDF-only; other formats export the writing
with their chosen layout. Paperback PDFs still require retailer/physical proofs.

**Create recent** reuses note starters; **Publish recent** is an optional layout
picker. For a private starter, open a note and use **Save as note template**.
Review its copied body as well as properties, then save and edit the template
Markdown locally. **Manage output presets** controls page appearance, not
starting text. Keep private designs outside the public engine repository.

Export-form detail changes are temporary; **Edit document details** saves them.
For a reusable book appearance, run **Manage book designs**, adjust the form and
**Create proof** before saving. Choose the saved design once through **Publish →
Change layout**; Publish then remembers it for that book. See
[Make your own book design](book-designs.md) for private storage and upgrade
copies. Use the result's actual path if Obsidian hides EPUB/DOCX in its sidebar.
On supported mobile devices, sharing can save to Files or installed storage
apps.

For focused tests see [the authoring checklist](testing/authoring-templates.md).
On the test vault, older developer checks live under **Archive**; your writing
and designs are separate and are not reset by cleanup.
