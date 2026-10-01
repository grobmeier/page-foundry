# Preset pack milestone test plan

Use only the isolated `.test-vault` installed by `npm run test-vault`. The
installer copies the neutral pack and this plan without enabling the pack or
changing existing plugin settings. Physical-device acceptance remains pending.

## Quick desktop check

1. Reload the development plugin and open **Portable letter**. Run **Publish
   current note**. Select PDF → **General manuscript**. Review A4 layout and
   metadata; export. Confirm a title page, then surname/title/page running
   header on numbered body pages. Repeat using US Letter and DOCX.
2. Select PDF → **Submission letter**. Clear Author or Recipient: Create should
   become disabled with an explanation. Restore the field and export. Check
   recipient, subject and closing. The note must remain unchanged.
3. Change a metadata value, then change to another preset. The new form must use
   original note/default values, not your previous export-only edits.
   Close/reopen publishing and confirm entered values were not remembered.
4. Try **Print proof** and **Readable plain**. The review must not claim KDP or
   accessibility certification. Changing page size must update the summary.

## Custom pack check

1. Set **Preset pack path** to `Designs/page-foundry-pack.json`. Publish
   **Portable letter** with **Studio proof — Neutral Example**. Required title
   and author should be prefilled from the note. Export PDF, DOCX and EPUB.
2. PDF should use blue text, larger type and spacious margins. DOCX should
   expose editable text with the configured font/style. EPUB should use the
   pack's base styling, subject to the reader's settings. Open saved EPUB/DOCX
   using the final result path or your file manager, not only Obsidian's
   sidebar.
3. While an export review is open, change `bodySizePt` in the pack (14 → 15),
   then press Create. No file should be created; the refreshed layout review
   should require another Create action. Restore the example afterwards.
4. Enter a missing pack path or temporarily make the JSON invalid. Publishing
   must show the pack error and prevent creation. Clearing the configured path
   must restore core publishing. Paths such as `../pack.json` and URLs must fail
   without reading other content. Do not use real private files here.
5. Re-enable the neutral pack and go offline. Repeat exports: no account,
   network request, Docker, Pandoc or rendering server should be required.

## Deferred device check

On physical iPad/iPhone, repeat the form editing, preset switching, local pack
loading and offline generation. Observe responsiveness and export duration; save
to the configured vault folder and test Files/iCloud Drive plus an installed
cloud-provider share target. Try both portrait and landscape layouts and confirm
fields, validation and Create remain reachable. Android requires separate
acceptance before a public compatibility claim.

Also retain the [local-image and destination tests](local-images-and-mobile.md).
The new preset/metadata controls must not bypass their resource review, changed
note/image protection, collision-safe filenames, or final result paths.

## Automated reproduction

`npm run verify` checks schema bounds, recipe/style safety, namespaces, metadata
validation/isolation, native output styles, missing/invalid packs, read scope,
changed-pack re-review and existing image/result behaviour.
`npm run build:browser-smoke` creates a loopback-served WebKit harness for
image-bearing PDF/EPUB/DOCX, manuscript PDF and custom-pack output, including
offline repetition. Inspect generated PDFs visually and use EPUBCheck for the
EPUB. This is browser-engine evidence, not physical Obsidian acceptance.
