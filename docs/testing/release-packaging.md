# Maintainer release packaging

Work on main until the first release. Keep the root manifest, package and
lockfile versions aligned. Packaging accepts that exact stable version or a
matching numbered beta, and changes only the staged release manifest. It does
not create a Git tag, publish a release or install a plugin.

With Node.js 22.19.0 (the stable CI version) and locked dependencies installed:

```sh
npm ci
npm run release:prepare -- 0.1.0-beta.N
# Or stage the stable version, after its acceptance checks:
npm run release:prepare -- 0.1.0
```

This verifies/tests/builds and stages an explicit asset list in ignored
`dist/<version>/`. It refuses an existing destination. Licence texts are
included in the plugin itself and as separate assets, with SHA-256 checksums. No
vault, output, settings, source maps or custom designs are packaged.

Review the assets and scan source history and staged files for secrets and
private material. Also inspect tracked source archives and documentation/media;
an ignored vault is not a privacy boundary. With owner authority, commit/push
source and record the exact pushed commit in the release. Use matching
tag/title/manifest versions. Mark betas **pre-release**, not latest stable; mark
a stable release as stable only after its release decision. Never replace
published assets or reuse a published tag. Download the public assets again and
compare with the local `SHA256SUMS` and verify GitHub attestations before
handing off. BRAT installs release assets, not main commits.

## First stable release checklist

From 0.1.3, push the approved stable tag only after local checks pass. The
`Verified release` workflow builds, compares repeated output, attests and
publishes exactly `main.js`, `manifest.json` and `styles.css`. Do not upload the
local legal/checksum companions: all licence text is already in the build.
Release preparation must copy the build unchanged. See
[review hardening](../architecture/review-hardening.md).

- Run `npm run verify`, `npm run test:markdown-pdf` and `npm run test:book-pdf`.
  Check compiled paragraph coordinates with Python and `pdfplumber`:
  `python3 scripts/check-pdf-paragraphs.py <book-proof-directory>`. Raster and
  inspect representative title, contents, chapter/body, table, image and code
  pages. Compilation alone does not establish layout quality.
- Complete the [author workflow](authoring-templates.md) against the exact
  candidate in a neutral, disposable vault, including a saved private design,
  proof, Publish, then Publish again. Do not overwrite the owner's BRAT install.
- Record physical mobile offline/rendering/memory/share tests and keyboard/
  assistive-technology results separately. Do not claim these passed from
  desktop tests. Decide whether any open platform gates limit the release's
  supported-platform claims.
- Inspect EPUBs in target readers and run EPUBCheck before claiming EPUB
  conformance. Keep retailer previews and physical print proofs separate from
  the plugin release; do not claim automatic retailer certification.
- Review [installation](../install.md),
  [supported content](../supported-content.md), privacy/security guidance,
  licence notices and the prepared release notes. Scan the exact candidate and
  staged assets for secrets/private content.
- Stage `0.1.0`; verify checksums, manifest version, explicit asset list and
  absence of vault/settings/design files. Obtain publication approval, then
  tag/publish the exact tested source. Re-download and verify public assets.
- Keep the BRAT beta instructions. Community-directory submission is a separate
  step, not an effect of publishing a stable GitHub release.

Public source archives contain tracked source, so private designs must never
enter Git in the first place. No GitHub release submits Page Foundry to the
Obsidian community directory or certifies mobile, retailer or print acceptance.
