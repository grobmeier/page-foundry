# Author preflight: your test checklist

The updated isolated `.test-vault` contains neutral examples and this checklist
as **Author preflight test plan.md**. Do not use a personal vault for
development tests. The plugin's report does not certify accessibility,
submission rules, print compliance or KDP readiness.

## On your Mac: start here

1. Open the existing `.test-vault` as a separate Obsidian vault. Reload Obsidian
   or disable/re-enable Page Foundry so it loads the updated development build.
2. Open **Preflight clean** and run **Page Foundry: Publish current note**.
   Select EPUB. **Publication checks** should show no blockers. Export, use the
   final result's **Show in folder**, and open the EPUB in your reader. The
   **Return to Chapter One** link must navigate to that section.
3. Open **Preflight advice**. Missing author, heading hierarchy, literal HTML/
   code formatting and an other-note link should produce advice. Create should
   remain enabled. Export PDF/DOCX and confirm unsupported links appear as text,
   the label/content remains present, and the original note is unchanged.
4. Open **Preflight broken link**, select EPUB: Create must be disabled with a
   missing-destination explanation. Select PDF or DOCX: that same fragment is
   advice and becomes plain text. Open **Preflight empty**: every format should
   be blocked despite having a frontmatter title.
5. Return to **Preflight clean**, choose Submission letter and clear a required
   field: the report should update while typing and disable Create. Restore it;
   publishing should be available again. If shown, **Copy preflight report**
   should copy only when you press it, with a success or failure notice.
   Clipboard failure must not prevent export. Copied reports can include
   document/pack labels and resource messages; share them only with people you
   choose.

If you want to try the private-pack mechanism safely, enable
`Designs/page-foundry-pack.json` in **Preset pack path** and follow the separate
[preset-pack checklist](preset-packs.md). Keep actual private designs outside
the repository; schema v1 currently supports bounded styles, not custom fonts,
artwork assets or executable templates.

## When you can test mobile

Transfer/sync only this disposable vault to iPad/iPhone by your usual vault
method. Include the `.obsidian/plugins/page-foundry`, `Designs` and `Artwork`
folders, fully downloaded before going offline. Repeat the clean/advice/blocker
checks in portrait and landscape. Confirm form focus and typing remain usable,
the full report and Create are reachable, and generation works offline. Record
approximate duration, freezes/crashes, and any memory warning.

Save to the configured vault folder. Then test **Share or save elsewhere** with
Files/iCloud Drive and one installed cloud-provider target. Sharing depends on
the host; on Mac, the fallback is **Show in folder**, not a promise of a native
share sheet. Android needs separate acceptance before a public support claim.

## What to send back

Tell me which step failed, device/OS/Obsidian version, selected format/preset,
what you expected and what happened. A copied report from the neutral test vault
or a neutral screenshot is useful. Avoid real manuscript text, private design
names and private file paths in public reports. Mark anything you could not test
as **Not tested**; it does not block continued development.

Continue to retain the [image/destination tests](local-images-and-mobile.md).
The next development milestone is explicit ordered multi-note book manifests;
verified KDP geometry comes later. No public release is being made here.

## Local verification

`npm run verify`, `npm run test-vault`, and `npm run build:browser-smoke`
reproduce the local checks. Serve `.test-browser` on loopback and use WebKit:
the harness exercises a resolved heading link, detects a broken one, and
generates all formats offline. Validate the EPUB with EPUBCheck and inspect
PDF/DOCX output visually. Browser checks do not replace physical-device tests.
