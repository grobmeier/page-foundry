# Private BRAT testing

Historical private-repository instructions. For the now-public repository, use
[BRAT setup](brat.md): no repository token is needed. The historical beta
release notes remain valid for when that release was first prepared.

Page Foundry remains a private GitHub repository. Its prereleases are visible
only to accounts with repository access. Installing through BRAT does not make
the repository, your notes, or your local custom designs public.

## Install the beta

Use current BRAT (1.1.0 or newer) and Obsidian 1.8.7 or newer. Start in a
separate test vault with invented text. Back up existing notes before wider use.

1. In GitHub, create a **fine-grained personal access token**, owned by your
   account. Set a short expiry, for example 30 days.
2. Choose **Only selected repositories → grobmeier/page-foundry**. Set
   **Repository permissions → Contents: Read-only**. Metadata read access is
   automatic. Do not grant write access or access to all repositories.
3. Configure that token in BRAT's private-repository setup/settings on the
   device you are testing. Enter it directly there, never in chat, notes,
   screenshots, bug reports, Git, or custom-template files. Treat the vault's
   plugin settings and its backups/sync as credential-bearing; do not share
   them.
4. Run BRAT's **Add a beta plugin for testing** command and add
   `grobmeier/page-foundry`. Select `0.1.0-beta.1` for a reproducible first
   test, or latest for future prerelease updates.
5. Enable **Page Foundry** in Community plugins if BRAT does not enable it.
   Confirm the installed version is `0.1.0-beta.1`.

The token permits GitHub downloads; it is not a publishing account or rendering
service. Page Foundry itself renders locally, without Docker, Pandoc or native
LaTeX. Custom templates/packs remain in explicitly configured vault locations;
their privacy also depends on your own vault sharing, backups and sync settings.

Follow [the authoring checklist](authoring-templates.md). First create a new
letter, save both addresses, then publish PDF. Next try a readable book and a
neutral custom template. Keep physical-device testing separate: mobile offline
generation, memory/performance and Files/iCloud/installed share targets are not
yet certified.

## Update and troubleshooting

- Run BRAT's update command when tracking latest. A frozen version stays fixed
  until you change it. Main-branch commits alone do not update an installed
  beta.
- For authentication/not-found errors, check repository access, token expiry,
  selected repository and Contents read permission. Never include the token in
  an error report. Revoke it in GitHub when testing ends.
- For missing assets, reinstall the named beta and report the version/device;
  releases must include `main.js`, `manifest.json` and `styles.css`.
- EPUB/DOCX can be hidden in Obsidian's file sidebar. Use the export result's
  actual saved path and desktop **Show in folder**, or supported mobile sharing.

See the
[official BRAT developer guide](https://github.com/TfTHacker/obsidian42-brat/blob/main/BRAT-DEVELOPER-GUIDE.md)
for release and private-repository requirements. Creating/configuring the token
and completing installation are owner actions, not part of build verification.

## Maintainer packaging

Work on main during the prerelease phase. Keep the root manifest's stable base
version; the packaging step writes a matching prerelease version only into the
release asset. Never replace a published beta: increment its beta number.

With Node.js 22.12 or newer and locked dependencies installed:

```sh
npm ci
npm run release:prepare -- 0.1.0-beta.1
```

This verifies/tests/builds and stages an explicit asset list in ignored
`dist/0.1.0-beta.1/`. It refuses an existing destination. It includes licence
texts in the plugin itself (BRAT installs only the plugin files), separate legal
assets, and SHA-256 checksums. No vault, output, settings, source maps or custom
design directory is packaged. Review the files, commit/push the related source
with owner authority, and record the exact pushed commit in the release.

Check the intended repository visibility before creating a GitHub prerelease;
private tests require a private repository, while public beta tests use the
current [BRAT setup](brat.md). Use a tag and title exactly matching the release
manifest version, attach the staged assets, and set prerelease true/latest
false. Download the assets again and compare `SHA256SUMS` before handing off.
GitHub source archives contain only tracked neutral source; private designs must
never enter Git in the first place.
