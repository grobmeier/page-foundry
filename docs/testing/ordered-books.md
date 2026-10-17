# Ordered book acceptance

Install or update through [BRAT](brat.md), then open the isolated `.test-vault`.
`npm run test-vault` adds missing examples only; it does not update the plugin.
Do not use a personal vault for development testing.

1. Open `Examples/Book/Reading order.book.md`. Run **Page Foundry: Publish**.
   Review all six entries: preface, heading-only part, first chapter, scene,
   second chapter, afterword. No letter preset should appear.
2. Export PDF using General manuscript, EPUB, then DOCX using General
   manuscript. The result shows the actual saved path in the configured Page
   Foundry folder.
3. PDF/DOCX: one title page; each non-scene entry starts on a new page; the
   small scene continues under Chapter One. Body page numbers start at one.
   Chapter headings are not duplicated.
4. EPUB: navigation follows plan order. Chapter two's **the gate** link reaches
   Chapter one's heading. Links to files outside the book remain plain labels.
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
