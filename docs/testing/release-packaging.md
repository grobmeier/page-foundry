# Maintainer release packaging

Work on main during prerelease development. Keep the root manifest's stable base
version; packaging writes a matching prerelease version only into the release
asset. Never replace a published beta: increment its beta number.

With Node.js 22.12 or newer and locked dependencies installed:

```sh
npm ci
npm run release:prepare -- 0.1.0-beta.N
```

This verifies/tests/builds and stages an explicit asset list in ignored
`dist/0.1.0-beta.N/`. It refuses an existing destination. Licence texts are
included in the plugin itself and as separate assets, with SHA-256 checksums. No
vault, output, settings, source maps or custom designs are packaged.

Review the assets and scan both source history and staged files for secrets and
private material. With owner authority, commit/push source and record the exact
pushed commit in the release. Use matching tag/title/manifest versions and mark
the release prerelease, not latest stable. Download the assets again and verify
`SHA256SUMS` before handing off. BRAT installs release assets, not main commits.

Public source archives contain tracked source, so private designs must never
enter Git in the first place. No beta publication submits Page Foundry to the
Obsidian community directory or certifies mobile, retailer or print acceptance.
