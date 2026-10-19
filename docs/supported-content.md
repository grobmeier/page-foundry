# Supported content and export limits

Page Foundry publishes individual Markdown notes and explicitly ordered books.
The same source can produce PDF, EPUB and DOCX; each format has its own layout.

## Markdown

Headings, paragraphs, emphasis, lists, quotations, links, horizontal rules,
literal code and pipe tables are supported. Fenced and indented code keeps its
whitespace; PDF wraps long lines with the bundled monospace font. Code never
executes. Raw HTML remains literal text. Mathematics and diagram rendering are
not implemented.

Pipe tables support left, centre and right alignment, inline formatting, empty
cells and local images. Escape literal pipes as `\|`, including pipes in inline
code and Obsidian embed aliases. PDF wraps text, repeats table headings and
allows tall rows to span pages. Tables wider than six columns, or with columns
narrower than 60 points, use stacked label/value rows. EPUB and DOCX keep native
tables. Limits are 20 columns and 1,000 body rows. Extra cells beyond the header
block creation instead of silently losing content. Merged cells and rendered
HTML tables are not supported.

## Images

Use Markdown images (`![Description](Artwork/panel.png)`), reference-style
images or Obsidian embeds (`![[Artwork/panel.png|300]]`). A numeric alias sets a
maximum pixel width; a text alias supplies alt text. `300x200` fits the image
inside a box without stretching it. In a table, escape the separator:
`![[Artwork/panel.png\|300x200]]`.

PNG/JPEG images retain their aspect ratio and are not upscaled. Only referenced
vault attachments are read. Remote images, absolute filesystem paths, parent
traversal, SVG and HTML images are rejected. Limits are 50 unique images, 5 MiB
and 20 megapixels per image, and 20 MiB combined image bytes.

## Ordered books

A book plan includes opening pages, parts, chapters, scenes and closing pages.
Only listed notes and explicit image references are included; plan prose and
chapter metadata are not imported as book content. PDF/DOCX have one book title
page and new pages for non-scene entries. EPUB links to included notes use
scoped destinations; links outside the reading order become plain labels.

Limits are a 128 KiB plan, 50 entries, 2 MiB per note and 20 MiB total note
text. Books do not expand folder globs, nested projects or the whole vault. See
[ordered-book checks](testing/ordered-books.md).

## Publication checks

Empty content, missing required details, broken resources and broken or
ambiguous EPUB heading links block creation. Missing author/descriptions,
heading gaps and literal HTML are advisory. EPUB heading destinations match its
contents navigation; PDF/DOCX heading links become plain labels. The review
rechecks changed notes, resources and configured designs before export.

The optional report states what was checked and what remains unchecked. It is
not an accessibility, publisher-rule or retailer certification. Paperback proofs
cover no-bleed black-ink interiors, not covers/spines, image DPI or greyscale
conversion. Inspect the PDF, retailer preview and physical proof. See
[publication checks](testing/author-preflight.md) and
[paperback checks](testing/paperback-proof.md).

## Beta.8 custom-book spacing issue

Custom book designs with zero paragraph spacing can produce overlapping
paragraphs. This was reproduced with the neutral Quiet book design and confirmed
in the generated PDF. Use the standard Plain document PDF layout for a reading
copy while the custom-book spacing fix is pending. Inspect proofs containing
multiple consecutive paragraphs before relying on a custom design.
