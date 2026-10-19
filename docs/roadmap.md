# Roadmap after beta.9

[GitHub tracking index](https://github.com/grobmeier/page-foundry/issues/37)
collects the documented limitations and deferred work. These are follow-ups, not
first-release blockers or promises for a particular version. Every issue
includes current behaviour, an intended outcome, acceptance criteria and scope
boundaries. User-facing features still need an agreed specification before
implementation.

The suggested next design sequence is private font/asset support, ornaments,
opening initials, then richer page treatments and format-native controls. Keep
Create and Publish simple as the capabilities grow.

## Stable 0.1.0 community-review findings

- [#38: Remove legacy script-element scheduler fallbacks from the distributed bundle](https://github.com/grobmeier/page-foundry/issues/38)
  is a blocking automated review finding; stable GitHub publication alone does
  not make the plugin installable through the community directory.
- [#39: Reduce the installed core below the Obsidian Sync Standard 5 MB file limit](https://github.com/grobmeier/page-foundry/issues/39)
  tracks the 16 MB bundle warning and needs a separately agreed portable
  packaging design. Do not claim Sync Standard compatibility yet.
- Artifact attestations are tracked in
  [#35](https://github.com/grobmeier/page-foundry/issues/35). Standalone
  licence/checksum assets are intentional; their licence text is embedded in the
  installed JavaScript too.

## Design flexibility

- [#6: Use explicitly selected private fonts in PDF designs](https://github.com/grobmeier/page-foundry/issues/6)
- [#7: Add private chapter and scene ornaments through safe local assets](https://github.com/grobmeier/page-foundry/issues/7)
- [#8: Support drop caps and opening initials as a book-design treatment](https://github.com/grobmeier/page-foundry/issues/8)
- [#9: Extend declarative book layouts with reusable page and section treatments](https://github.com/grobmeier/page-foundry/issues/9)
- [#10: Expose native EPUB and DOCX design controls without promising PDF identity](https://github.com/grobmeier/page-foundry/issues/10)
- [#11: Make private design-pack transfer and management easier](https://github.com/grobmeier/page-foundry/issues/11)
- [#12: Expose advanced preset metadata and recipe setup through readable forms](https://github.com/grobmeier/page-foundry/issues/12)
- [#13: Add an optional paginated design preview with clear freshness and cost](https://github.com/grobmeier/page-foundry/issues/13)
- [#14: Document and validate a reference-PDF workflow for porting existing designs](https://github.com/grobmeier/page-foundry/issues/14)

## Authoring and content

- [#15: Add sourced, versioned publisher and manuscript presets](https://github.com/grobmeier/page-foundry/issues/15)
- [#16: Import explicitly selected Longform ordering into an ordered book](https://github.com/grobmeier/page-foundry/issues/16)
- [#17: Create an ordered book from the active note without copying its writing](https://github.com/grobmeier/page-foundry/issues/17)
- [#18: Support semantic footnotes across PDF, EPUB and DOCX](https://github.com/grobmeier/page-foundry/issues/18)
- [#19: Design book cross-references, citations, bibliographies and indexes](https://github.com/grobmeier/page-foundry/issues/19)
- [#20: Add bounded offline mathematics support to the Markdown model](https://github.com/grobmeier/page-foundry/issues/20)
- [#21: Evaluate safe offline diagram export with explicit supported syntax](https://github.com/grobmeier/page-foundry/issues/21)
- [#22: Extend table design and evaluate accessible merged-cell support](https://github.com/grobmeier/page-foundry/issues/22)
- [#23: Evaluate additional safe local image formats, including static SVG](https://github.com/grobmeier/page-foundry/issues/23)

## Print production

- [#24: Extend paperback interiors with explicit bleed and colour profiles](https://github.com/grobmeier/page-foundry/issues/24)
- [#25: Plan verified additional book formats, covers and spine calculations](https://github.com/grobmeier/page-foundry/issues/25)
- [#26: Add measured PDF production preflight beyond current paperback geometry](https://github.com/grobmeier/page-foundry/issues/26)

## Validation and capacity

- [#27: Complete physical iPad, iPhone and Android offline publishing acceptance](https://github.com/grobmeier/page-foundry/issues/27)
- [#28: Audit keyboard and assistive-technology usability of the author workflow](https://github.com/grobmeier/page-foundry/issues/28)
- [#29: Verify and improve exported-document accessibility semantics](https://github.com/grobmeier/page-foundry/issues/29)
- [#30: Make EPUBCheck and reader/Word interoperability repeatable release checks](https://github.com/grobmeier/page-foundry/issues/30)
- [#31: Measure large-book budgets and improve capacity-limit guidance](https://github.com/grobmeier/page-foundry/issues/31)
- [#32: Record reproducible publishing provenance without leaking private inputs](https://github.com/grobmeier/page-foundry/issues/32)

## Distribution and release operations

- [#33: Evaluate opt-in pack distribution and integrity verification](https://github.com/grobmeier/page-foundry/issues/33)
- [#34: Evaluate deferred formats and round-trip import as separate future capabilities](https://github.com/grobmeier/page-foundry/issues/34)
- [#35: Automate neutral verification, release asset auditing and dependency review](https://github.com/grobmeier/page-foundry/issues/35)
- [#36: Track first stable release and Obsidian community-directory submission](https://github.com/grobmeier/page-foundry/issues/36)

## Boundaries that stay in place

Private packs, fonts, artwork, manuscripts and settings stay outside the public
repository and release. Markdown remains authoritative. No telemetry, automatic
manuscript uploads, arbitrary template code, remote resource fetches, unrelated
vault enumeration or Docker/native-TeX dependency is planned. Resource budgets
are safety controls, not limits to remove indiscriminately.

Distribution/interchange issues are research decisions, not commitments to a
registry, every format, lossless round trips or direct retailer/cloud upload.
Existing operating-system sharing remains the cloud-provider handoff. Platform,
accessibility and print claims depend on the separately tracked acceptance.
