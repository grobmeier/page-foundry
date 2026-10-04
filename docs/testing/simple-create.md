# Try the simpler Page Foundry workflow

Use the isolated development vault, not a personal vault. Rebuild/install with
`npm run test-vault`, then reload Page Foundry or reopen this test vault.

## 1. Create a letter and reuse its layout

1. Open **Portable letter**. Run **Page Foundry: Create**.
2. Search **letter pdf a4** and select **Letter · A4 · PDF**.
3. Check the publication fields and press **Create PDF**. You should not need to
   open a report or change format/page-size dropdowns.
4. Confirm the result shows the actual file path, including a numbered suffix if
   the name already exists. Use **Open in default app** or **Show in folder**.
5. Run **Create recent**. The letter layout should appear, but no new file
   should be generated until you select it and press Create. Export-only fields
   must come from the current note/template, not your previous edits.

## 2. Set up a book without editing technical fields

1. Open **Book/Chapter One.md**, run **Set up book**, and give your book a title
   and a new plan filename, for example **My Trial.book.md**.
2. The active chapter is already included. Press **Add section**, expand it,
   choose **Opening pages**, and enter **Book/Preface.md** as its Note path.
3. Move that section above the chapter. You should see titles and friendly
   section types, without having to enter IDs or edit YAML.
4. Press **Save book plan**. Open that plan and use **Set up book** again to
   edit it. Cancel should leave the saved plan unchanged.
5. With the plan open, use **Create**, search **Amazon 6x9 cream**, and select
   the paperback layout. **Next-page chapters** is optional; the other variant
   starts parts/chapters on right-hand pages.
6. Create the PDF. **Print proof details** should be collapsed in the result.
   This short sample is a layout proof, not a retailer-ready book.
7. Use **Create** again and search **EPUB** to make an ebook from the same plan.
   Find it using the finished-file actions, not only Obsidian’s sidebar.

## 3. Check help and safeguards

- Run **Cheat Sheet**. It should open help without creating a vault note.
- Open **Missing image** and use Create. The missing-image problem must remain
  visible with Create disabled, even when Details is closed.
- Change a required field in a submission-letter form. The message and Create
  button should update while typing without losing focus.
- Check keyboard navigation, native disclosure controls and a narrow window.
  Every input and action must remain reachable without horizontal scrolling.
- Optional: edit a book plan elsewhere while its setup form is open. Save must
  refuse to overwrite that newer version and keep the form available.
- In settings, **Clear history** removes local recent/most-used layout records.
  Your note content and private pack must not be changed.

## Evidence and remaining acceptance

Automated tests cover search, compatibility, ranking, bounded history, explicit
plan saves, stable IDs, changed/missing plans, form validation, ordering,
cancellation and concurrent saves. Live desktop checks use neutral fixtures;
they are not proof of physical mobile performance or retailer acceptance. Repeat
Create, book setup and system saving/sharing on iPad/iPhone before making mobile
compatibility claims. Private template packs require your explicit pack
configuration; development fixtures contain no personal designs.

Checked on 4 October 2026: all 106 tests, formatting, type checks and production
build pass. In Obsidian’s isolated vault, Create saved a letter PDF with a
numbered filename; Create recent offered that layout without exporting
immediately. Set up book created a plan, added opening pages, reordered them and
saved in place; the original chapter ID was independently confirmed unchanged.
Create produced a three-page paperback proof and an EPUB from that plan. The
result’s print report stayed collapsed, and Cheat Sheet opened without writing a
vault note. Unsupported-image blockers remained visible in the shortened form.
Narrow-screen styling is provided; physical mobile interaction/performance still
needs owner testing, not inference from these desktop checks.

The live book EPUB also passes EPUBCheck with zero errors or warnings.
