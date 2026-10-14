# Authoring templates test plan

Use the isolated test vault and invented names/addresses. Do not copy private
designs or personal manuscript text into development fixtures.

Start with [the short guide](../start-here.md). On beta.3 and later, greet/sign
off in the letter body. Publish opens the kind-aware layout directly; Change
layout is optional. Check that a new letter omits
author/language/greeting/closing properties unless explicitly supplied by a
custom starter. Test an old letter's conversion by cancelling first, then
reviewing and saving; its addresses and unrelated properties must survive. A
newer edit while the review is open must block Save. Check two different notes
retain independent successful layouts.

1. Run **Create new note → Letter**, name it **Authoring letter**, and fill
   sender and recipient names and two-line addresses. Create it. Expect an
   opened Markdown file with saved properties and no new PDF. The previously
   open note must be unchanged. Draft fields can be blank; filename collisions
   must fail without overwriting. Cancel another creation: no file should
   appear.
2. Reopen the letter and **Edit document details**. Expect both addresses to
   survive. Change its subject and save; cancel another edit and check nothing
   changed. If you edit the source elsewhere while the form is open, its Save
   must refuse to overwrite the newer note.
3. **Publish**, defaulting to Letter · A4 · PDF. Expect names and address lines,
   subject, salutation and closing exactly once. Publishing must not modify the
   note. Check the actual saved path in the result, then open the PDF. Try
   DOCX/EPUB from a manuscript; those are different output layouts, not new-note
   creation.
4. **Create new note → Book**, then **Edit document details**. Add existing
   `Book/Preface.md` and `Book/Chapter One.md`, choose roles and reorder. Save.
   Expect readable headings/links and no JSON entries in Properties. Publish
   PDF/EPUB; expect the same order. Missing exact paths must prevent
   saving/publication.
5. Open **A Neutral Journey.book** and run **Convert to readable book plan**.
   Cancel first: unchanged YAML. Repeat and Convert and save: readable outline,
   same sections/order/link destinations. No chapter notes should change.
6. On the neutral letter, **Save as note template** to
   `Designs/Neutral letter template.md`. Inspect the preview with personal-field
   clearing on/off. Save with clearing on, then **Create new note** from that
   template. It should be an independent file without copied addresses. Edit the
   template Markdown and repeat; the new content should be used. Removing its
   registration must not delete it. A moved template gives a useful error.
7. **Manage output presets**. Save **Comfortable proof** based on Readable plain
   document to `Designs/authoring-pack.json`, using 13-point text and 1.6
   spacing. Choose it in Publish and inspect its output. Edit the preset again;
   other presets remain. Invalid settings, collisions and newer external edits
   must be rejected without data loss. Clear its configured path when done if
   desired.
8. Check **Create recent**, **Publish recent** and **Cheat Sheet**. Confirm the
   two histories are separate and no personal values are reused from history.
   Repeat keyboard/narrow-window navigation and inspect multiline fields.

Still required on physical iPad/iPhone: offline creation/rendering,
PDF/EPUB/DOCX memory/performance, vault saving, Files/iCloud and an installed
cloud share target. Desktop and browser checks do not establish these device
results. No release or retailer certification is implied; inspect paperback
proofs separately.
