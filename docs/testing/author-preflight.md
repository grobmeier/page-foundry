# Publication checks

Use the isolated test vault's Start here route and neutral Examples tree. Follow
[the author workflow check](authoring-templates.md) first. Reports are optional
detail, not certification of accessibility, submission rules or print.

1. Publish **Examples/Writing/Manuscript** as PDF and DOCX. Check the design,
   output and destination summary. Publishing must not change its Markdown.
2. Open **Examples/Expected errors/Empty note**: every output must be blocked
   despite a title property. No finished file should be saved.
3. Open **Examples/Expected errors/Broken heading link**. EPUB must be blocked;
   PDF/DOCX explain the plain-text fallback. Missing, remote and SVG images also
   have explicit expected-error examples.
4. Publish **Examples/Writing/Submission letter** with its matching PDF design.
   Clear a required sender/recipient/subject field in export-only details:
   checks and Create must update while typing. Restore it and Cancel; source
   properties must be unchanged.
5. Expand Details and checks. Copy preflight report only on request; clipboard
   failure must not prevent export. Reports can contain resource names and
   design labels: use neutral examples in public reports.

Repeat offline on physical devices, checking focus, portrait/landscape, memory,
vault saving and supported Files/cloud targets. These checks remain separate
from local automated tests. See
[image and device checks](local-images-and-mobile.md).
