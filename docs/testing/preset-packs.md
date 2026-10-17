# Custom design checks

Use the neutral Examples tree in the isolated test vault. Install/update the
plugin through [BRAT](brat.md); fixture setup does not install a plugin.

1. Record the existing configured pack path before changing it. Never overwrite
   retained owner designs. The optional fixture is **Examples/Customise/Example
   output styles.json**; only one pack is selected at a time. Restore the
   original setting afterwards.
2. Use **Manage designs → Document designs** to review supported layouts. Select
   an example design through **Publish → Change layout** and export PDF, DOCX
   and EPUB where offered. Inspect typography and readable content; EPUB readers
   may override the design.
3. Edit an export-only field, then switch design. Original note/default values
   must replace temporary edits. Publishing must leave source notes unchanged.
4. On a deliberate copy, change the pack while Publish is open: Create must
   request a fresh review instead of using obsolete settings. Missing or invalid
   configured packs must block creation, not silently fall back.
5. Create a reusable note template from neutral writing using **Save as note
   template**. Inspect its body and cleared properties. Note templates create
   source text; output designs never replace it.
6. For opening pages, chapter styles and running headers, use **Manage designs →
   Book designs** and follow [the book design guide](../book-designs.md).

Private manuscripts, artwork and design packs stay outside the public checkout.
Repeat offline generation and saving/sharing on physical devices before claiming
mobile acceptance. See [the author test path](authoring-templates.md).
