# Ordered book acceptance

Run `npm run test-vault` and open the isolated `.test-vault` in Obsidian. Reload
Page Foundry if the vault is already open. Do not use a personal vault for
development testing.

1. Open `A Neutral Journey.book.md`. Run **Page Foundry: Publish current book**.
   Review all six entries: preface, heading-only part, first chapter, scene,
   second chapter, afterword. No letter preset should appear.
2. Export PDF using General manuscript, EPUB, then DOCX using General
   manuscript. The result shows the actual saved path in the configured Page
   Foundry folder.
3. PDF/DOCX: one title page; each non-scene entry starts on a new page; the
   small scene continues under Chapter One. Body page numbers start at one.
   Chapter headings are not duplicated.
4. EPUB: navigation follows manifest order. The first chapter's Continue link
   reaches Chapter Two's Arrival, not Chapter One's identically named heading.
   Return stays in Chapter One. Outside the book is plain text.
5. Change entry order in the manifest, then **Refresh book review**. The list
   and exported order should match. Sources must remain unchanged.
6. Open review, edit an included note, then Create. No output should be saved:
   review must reopen with a change notice. Repeat with the manifest and a
   referenced local PNG/JPEG. Refresh and export successfully.
7. Try a missing note, duplicate path/ID, unsafe `../` path and missing heading
   link. Invalid manifest blocks review; missing resources block publishing;
   broken heading links block EPUB, while PDF/DOCX report them as advice.
8. Add a local image to two listed notes. Review shows one unique attachment;
   both occurrences render. Only listed notes and their referenced images are
   read. Notes outside the list are never imported by links.

Repeat offline on iPad/iPhone when available: save in the vault, open the exact
saved file, and share/download using Files, iCloud Drive or an installed cloud
target. macOS may not support file sharing; use Open, Reveal or download
instead. Physical mobile performance and saving are still pending, not
established by WebKit tests. Android acceptance remains required before claiming
support.

This is portable author publishing, not certified KDP geometry, publisher
submission compliance or EPUB accessibility. Nested projects, globs and
automatic vault discovery are not supported. Manifest text is explanatory and
excluded; book metadata comes only from the manifest and export review.
