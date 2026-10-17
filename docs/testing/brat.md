# Test Page Foundry with BRAT

The engine repository and beta releases are public. Page Foundry is not yet
listed in the Obsidian community plugin directory. No GitHub token is required
for normal BRAT installation. Public availability does not certify production,
mobile performance, retailer compliance or physical printing.

## Install

1. Use Obsidian 1.8.7 or newer and current BRAT (1.1.0 or newer).
2. Start in a separate test vault with neutral text; back up notes before wider
   use.
3. Open the command palette and run BRAT's **Add a beta plugin for testing**.
4. Enter `grobmeier/page-foundry` or
   `https://github.com/grobmeier/page-foundry`.
5. Track latest for future prerelease updates, or choose a specific release tag
   for a reproducible test. Enable **Page Foundry** in Community plugins.
6. Confirm the version, then try **Page Foundry: Create new note → Letter**,
   **Edit document details**, and **Publish → Letter · A4 · PDF**.

Continue with the [authoring checklist](authoring-templates.md). No Docker,
Pandoc or native LaTeX is required. Test physical-device offline rendering,
memory and sharing separately. EPUB/DOCX may be hidden in Obsidian's sidebar;
use the export result's saved path and available file actions.

## Updates and credentials

BRAT installs GitHub release assets, not arbitrary main-branch commits. Run its
update command when tracking latest; a frozen version remains fixed until
changed. If you created a token solely for this repository's former private
beta, you can revoke it in GitHub. Do not remove a token used for other private
plugins without checking those uses. Do not share BRAT settings containing
credentials.

GitHub can rate-limit unauthenticated requests. A token is optional for higher
limits, not required to access this public plugin. Never paste one into chat,
issues or screenshots. See the
[official BRAT guide](https://github.com/TfTHacker/obsidian42-brat/blob/main/BRAT-DEVELOPER-GUIDE.md).

## Private designs stay private

Keep custom Markdown templates, preset packs, fonts, artwork and manuscripts in
your own vault/private storage, outside the engine repository. Register exact
template/pack paths in Page Foundry settings. Local configuration does not
upload them, but your own vault sharing, sync and backups can expose them.

## Maintainers

The packaging command remains `npm run release:prepare -- 0.1.0-beta.N`. See the
[packaging procedure](release-packaging.md); it stages only an explicit asset
list, retains licence texts and produces checksums. For public beta publication
verify that no private files or credentials occur in history, source archives or
assets before uploading. Increment the beta number; never replace a published
beta. No beta publication submits the community-directory listing automatically.
