# Page Foundry: desktop and mobile test plan

Use a disposable vault and neutral notes, not your personal manuscripts. Run
this checklist when convenient; physical-device testing is not a development
gate, but remains required before public compatibility claims.

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

## Report back

Send device/versions, fixture note, format/preset, destination, approximate
duration, expected versus actual behaviour, and Pass/Fail/Not tested.
Screenshots or a neutral failed output help. Never include a private manuscript
in a bug report. Physical mobile and assistive-technology results remain pending
until actually exercised; automated tests are not a substitute.
