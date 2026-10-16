# Page Foundry: desktop and mobile test plan

Use a disposable vault and neutral notes, not your personal manuscripts. Run
this checklist when convenient; physical-device testing is not a development
gate, but remains required before public compatibility claims.

Also run the [preset-pack milestone checklist](preset-packs.md), copied into the
test vault as **Preset pack test plan.md**, for custom designs, metadata forms,
manuscript PDF and submission letters.

The [author preflight checklist](author-preflight.md), copied as **Author
preflight test plan.md**, covers checks, heading links and report copying.

## Set up once

On the development Mac, use Node 22.12+ and run:

```sh
npm ci
npm run test-vault
```

Open the generated `.test-vault` directory as a vault in Obsidian. Enable
community plugins and Page Foundry. If it is already enabled, disable/re-enable
it or reload Obsidian. The installer creates named neutral test notes and this
plan as **Page Foundry test plan.md**. It only touches the disposable vault.

For iPad/iPhone, transfer or sync this disposable vault, including its
`.obsidian/plugins/page-foundry` files and `Artwork` folder, by your usual vault
method. Check that the fixture notes and images are fully downloaded locally
before the offline test. Do not connect the test vault to a personal live vault.
If Obsidian asks about plugin trust, enable the development plugin only in this
test vault. A separate Android run is needed before an Android claim.

Record device model, OS version, Obsidian version, date, plugin commit/build,
reader/editor used, and each result as **Pass / Fail / Not tested**.

## 1. Image review and all three formats

Open **Portable images.md** and run **Page Foundry: Publish current note**.

- Review lists the landscape PNG and portrait JPEG in `Artwork`, their
  dimensions and sizes.
- The repeated landscape is listed only once. Advice about the width-only
  embed's missing alt text is expected; it must not block export.
- Export PDF / Plain document / A4, EPUB / Reflowable ebook, and DOCX / Plain
  editable, choosing Save in vault each time. Record approximate generation time
  and any freeze, crash or device memory warning.
- Every result shows the actual `Page Foundry/...` saved path. EPUB/DOCX may
  remain hidden by Obsidian's sidebar; that is not a missing-file failure.
- On Mac, use Show in folder and Open in default app. Share is absent if the
  Obsidian host cannot share files. You can share the saved file from Finder.
- Open PDF in a PDF reader, EPUB in an installed ebook reader, and DOCX in a
  document editor. Confirm blue/gold landscape and portrait panels, no
  stretching or cropping, and a smaller 300-pixel landscape repeat. Text remains
  readable.
- EPUB images resize with the reader viewport. Its table of contents works.
- DOCX body text remains editable. Export General manuscript too: title page,
  running header/page numbers, double-spaced prose and images remain usable.
- Repeat with US Letter for PDF/DOCX: no image crosses the content margins.
- Export the same name again: a numbered filename appears, the earlier file is
  untouched, and Open/Share uses the numbered file.
- Check that source Markdown and artwork have not changed.

The portrait fixture is a JPEG, so this note checks both formats without needing
additional artwork. Optionally add another neutral local JPEG to a copy of the
note; avoid private artwork in test reports.

## 2. Text-only regression

Export **Portable letter.md** as PDF Letter, EPUB, and DOCX General manuscript.
Confirm letter metadata, ebook navigation, and editable manuscript output still
work without an image review. No image from a previous export should appear.

## 3. Safety cases

Each blocking case must disable Create and explain the problem. There should be
no finished file or silent placeholder export.

| Note or action                                                 | Expected result                               |
| -------------------------------------------------------------- | --------------------------------------------- |
| Missing image.md                                               | Missing attachment explanation                |
| Remote image.md                                                | Local-only explanation; no download attempted |
| Unsupported image.md                                           | PNG/JPEG-only explanation                     |
| Traversal image.md                                             | Vault path/traversal explanation              |
| Missing alt text.md                                            | Advice only; export is allowed                |
| PNG renamed to `.jpg` in a copied note                         | Contents/extension mismatch                   |
| Reference a copied image larger than 5 MiB                     | Size-limit explanation                        |
| Use more than 50 unique small images or more than 20 MiB total | Count/total-size explanation                  |

For change detection, leave the publish dialog open, change the active test note
or replace one referenced image through another editor/device, then select
Create. The plugin must return to a fresh review instead of exporting the old
selection. For a missing-image repair, add the correct attachment, then select
Refresh image review. Create should become available.

## 4. iPad/iPhone save and share

Run on both devices when available, using the same image and text notes.

1. Save every format in the vault and verify it exists using an appropriate
   reader or the available share/save action.
2. Share/save a completed result to On My iPad/iPhone and iCloud Drive using the
   system Files interface; reopen each saved file.
3. If Dropbox or another provider is installed and enabled in Files/share, save
   there and reopen it. If unavailable, mark Not tested—not Pass.
4. Cancel sharing: the result dialog remains available. Retry without exporting
   again. A failed share should also retain the completed output.
5. Choose Share or save elsewhere as the initial destination, then Save in vault
   from the result. The dialog updates to the final saved path without making
   duplicate files from repeated taps.
6. Set a different vault output folder in Page Foundry settings. Confirm saved
   files go there and existing files are not overwritten.

The plugin does not upload directly to Dropbox/iCloud; the operating system
hands the completed file to an installed destination. An unavailable share
capability omits the action rather than claiming the file was shared.

## 5. Offline and repeatability

After all fixtures and the plugin are downloaded, disable network access and
export every format again. Rendering and vault saving must work without Docker,
Pandoc, a server, or signing in. A cloud destination may require reconnection;
that is separate from offline generation. Repeat an image export and a text-only
export three times, watching for increasing delays, freezes, or stale images.
Record approximate duration rather than inventing a memory measurement.

## Tables, code and narrow PDF pages

Use a neutral note in the test vault, not your manuscript. After installing the
candidate build, reload Page Foundry. BRAT needs a published beta; updating main
alone does not update the installed plugin.

1. Add a three-column table with left/centre/right alignment, a blank cell,
   **bold**, `inline code`, a link, and an escaped literal pipe (`\|`). Export
   PDF. Check borders, alignment and wrapping; no raw pipe-table source should
   appear. Without a valid separator row, pipe-containing prose stays prose.
2. Add a local PNG/JPEG inside a cell. For a wiki embed with dimensions use
   `![[Artwork/panel.png\|300x200]]`. Check it fits its cell without stretching.
   Also try an ordinary wide image, a portrait image and the same image twice.
3. Duplicate table rows until the table spans pages. Headings must repeat and
   the last row must remain present. Put several paragraphs' worth of text in
   one cell to check a row can continue across pages.
4. Try seven columns, then include the note in a 5×8 book. Wide tables should
   become readable label/value rows, with every original column represented.
   Ordinary small tables should remain grids. Check a table in a quote/list.
5. Add a fenced code block with blank lines, indentation, punctuation and a long
   identifier. PDF should use monospace text and wrap within the page.
   `#image("remote.png")` inside code must print literally, never fetch a file.
   Start a numbered list at 3; the PDF must start at 3, including nested lists.
6. Export the note as EPUB and DOCX too: tables and code must remain present. A
   missing/remote/SVG image inside a cell must still block export with a useful
   explanation. A row with more cells than the header must also block, not lose
   the extra cell silently. Original Markdown and attachments must be unchanged.

Repeat PDF export offline on iPad/iPhone when available, then save in the vault
and use Files/share for another destination. Physical-device performance is not
established by desktop proofs. Mathematics, diagrams, merged cells and rendered
HTML tables are outside these fixes.

For maintainers, `npm run test:markdown-pdf` generates neutral A4, US Letter and
5×8 proofs in a fresh temporary directory. Check all record numbers, the final
`END OF TALL ROW` / `END OF PROOF` markers, repeated headings, image bounds and
code wrapping. Render representative pages for visual inspection. Also run
`npm run test:book-pdf` to retain the existing custom-design/print checks.

## Report back

Send device/versions, fixture note, format/preset, destination, approximate
duration, expected versus actual behaviour, and Pass/Fail/Not tested.
Screenshots or a neutral failed output help. Never include a private manuscript
in a bug report. Physical mobile and assistive-technology results remain pending
until actually exercised; automated tests are not a substitute.
