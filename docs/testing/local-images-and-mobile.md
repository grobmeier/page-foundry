# Formatting and device acceptance

Use a separate test vault with neutral Examples, not personal writing. Install
or update Page Foundry through [BRAT](brat.md). The fixture command
`npm run test-vault` adds missing examples; it never replaces BRAT, plugin
files, settings or edited notes. Start with the vault's single **Start here**
note.

## Tables, images and all formats

1. Open **Examples/Formatting/Tables and images**, then **Page Foundry:
   Publish**. Its referenced local PNG/JPEG live under **Examples/Assets**.
   Check image dimensions in review and export PDF, EPUB and DOCX.
2. Check proportions, no clipping, table alignment/wrapping, code indentation,
   long code lines and numbered-list starts. Wider tables use stacked rows. On
   **Examples/Formatting/Long table**, check every one of the 80 records and
   repeated PDF table headers. Repeat A4 and US Letter PDF/DOCX.
3. Every result shows its actual output path. EPUB/DOCX may be hidden in the
   sidebar: use Show in folder or Open in default app on desktop. Export twice;
   the numbered copy must not overwrite the first file. Source and assets stay
   unchanged. Try a text-only Letter afterwards: no previous image may leak in.
4. Use the deliberately broken notes under **Examples/Expected errors**.
   Missing/remote/SVG images and extra table cells must block Create with an
   explanation, not silent content loss or a placeholder PDF.
5. With Publish open, edit the note or a referenced image externally. Create
   must request a new review. Repair a missing local image and Refresh image
   review: publishing should become available again.

## Physical devices and offline use

Sync/transfer only the disposable vault by your usual method. Install the beta
on each device and download all notes/assets before going offline. Never connect
it to a personal live vault just for development testing.

Repeat creation, document-type editing and PDF/EPUB/DOCX generation on iPad and
iPhone. Check portrait/landscape, keyboard navigation, scroll reachability,
approximate duration, freezes/crashes and memory warnings. Save to the
configured vault folder, then try Share or save elsewhere with Files, iCloud
Drive and one installed cloud-provider target. Host sharing may be unavailable
on Mac; use Finder instead. Android needs its own acceptance run.

Record device/OS/Obsidian/plugin version, example, design/format, expected and
actual result as Pass, Fail or Not tested. Neutral screenshots are useful; do
not include private writing, design names, paths or credentials. Local automated
and desktop checks do not establish physical-mobile or retailer acceptance.
