# Paperback proof acceptance

Install or update through [BRAT](brat.md). In the isolated `.test-vault`, open
`Examples/Book/Reading order.book.md`, run **Publish**, and select PDF /
**Paperback interior (no bleed)**. This recipe is only available for books.

1. Use 6 × 9 inch, white paper, right-hand part/chapter starts. Export offline.
   The result includes a measured proof report. Record its physical page count.
   Parts/chapters start on right-hand pages; the scene continues its chapter.
   Inserted blanks have no numbers, opening matter is Roman and body numbering
   is Arabic. Counts depend on the design and final pagination.
2. Check actual PDF page size, chapter positions and that no source was changed.
   The report must clearly say **Proof only**: this short book is below KDP's
   supported page count. The plugin does not certify upload readiness.
3. Switch to **Next page** starts. No chapter-start blank pages should be
   inserted. Try 5 × 8 inch / cream and 5.5 × 8.5 inch / white. Trim choices
   affect PDF only; EPUB/DOCX remain unchanged.
4. Copy the print proof report using the explicit result button. If clipboard
   access is unavailable, the report remains visible and the PDF remains usable.
5. Export a longer neutral test book. Above 300 physical pages the inside margin
   must grow beyond the initial 0.5 inch. The report's page count includes
   title, front matter and blanks; changing gutter can change the final count.
   Inspect left/right pages: the extra binding space alternates sides, not both
   sides. The developer browser harness has **Generate long gutter proof** for
   this check; it is not a physical-mobile performance benchmark.
6. Add a local PNG/JPEG and check that it stays inside the trim's text area. No
   bleed is supported. Black-ink selection does not convert coloured images;
   inspect image resolution, greyscale contrast and retailer preview yourself.
7. Switch presets/formats and export another ordinary note. Print controls must
   not appear on note exports or EPUB/DOCX. Existing result-folder/share actions
   and source-change re-review remain available.

Profiles use black ink, white/cream paper, left binding and no bleed. Supported
trim sizes currently share page ranges: white 24–828, cream 24–776. Short/long
files remain useful proofs but carry a clear range warning. A4/US Letter exports
are not treated as paperback profiles. Inside margins follow page-count bands,
with conservative 0.5 inch minimum inside/outside and 0.75 inch top/bottom.
Custom style margin/colour settings cannot override the fixed print geometry and
black text; supported body size/leading still apply.

Rules checked 2 October 2026 against
[Amazon's trim/margin specifications](https://kdp.amazon.com/en_US/help/topic/GVBQ3CMEQW3W2VL6).
Before publishing, review every PDF page, use the retailer's previewer and order
a physical proof. Cover/spine, bleed, greyscale conversion, image DPI, overflow,
accessibility and full font-embedding certification are not part of this report.
Physical Obsidian desktop and iPad/iPhone/Android acceptance remain pending.
