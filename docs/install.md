# Install and update Page Foundry

Page Foundry requires Obsidian 1.8.7 or newer. Open its
[community listing](https://community.obsidian.md/plugins/page-foundry) and
choose **Add to Obsidian**, then review the plugin in Obsidian and install and
enable it. The published listing includes the current version and review
scorecard; a completed automated review can still carry warnings.

You can also choose release files from
[GitHub Releases](https://github.com/grobmeier/page-foundry/releases). The
[latest stable release](https://github.com/grobmeier/page-foundry/releases/latest)
is separate from beta builds marked **Pre-release**. Use release files or BRAT
for a pinned build, beta testing or if your app has not refreshed its directory.

The embedded offline PDF compiler makes `main.js` about 17 MB. **Obsidian Sync
Standard cannot sync this plugin file**, because its per-file limit is 5 MB.
Install the plugin separately on each device rather than expecting that plan to
transfer it. Note and output-file syncing still depends on your storage
provider's own limits. A smaller portable package is tracked in
[#39](https://github.com/grobmeier/page-foundry/issues/39).

## Beta channel: BRAT

BRAT installs Page Foundry on desktop and mobile and manages beta updates.

1. Install and enable BRAT in Obsidian.
2. Run **BRAT: Add a beta plugin for testing** and enter
   `grobmeier/page-foundry`.
3. Track the latest beta, or select a specific release tag for a fixed build.
4. Enable Page Foundry in Community plugins. Run **Page Foundry: Create new
   note**, then **Page Foundry: Publish** when ready.

No GitHub token is needed for this public repository. See the
[BRAT guide](testing/brat.md) for update troubleshooting and credential safety.
BRAT remains available for beta testing alongside stable releases.

## Pinned desktop installation: release files

1. Back up your vault. Download `main.js`, `manifest.json` and `styles.css` from
   the **same release**. Do not use the GitHub source-code archive as the
   installed plugin.
2. Close Obsidian. Create `.obsidian/plugins/page-foundry/` inside your vault
   and copy those three files there. When updating, replace only those files;
   retain `data.json`, which contains your settings and template registrations.
3. Open Obsidian and enable Page Foundry in Community plugins.

Licence texts are embedded in `main.js`; stable releases from 0.1.3 publish only
the three installed files, with GitHub artifact attestations for provenance.
Local maintainer staging also produces licence and checksum files. Manual
installations stay on the chosen version until you replace the release files;
use BRAT if you want managed beta updates. Avoid mixing manual updates with a
BRAT-managed installation.

## Update without losing your work

Save open edits before updating, then fully reload Obsidian and confirm the
installed version in Community plugins. BRAT downloads release assets, not new
commits on main. If an update seems missing, check whether your BRAT entry is
fixed to an older tag and explicitly select the intended version.

Updating the plugin does not replace your notes, example guide, output files or
private designs. Your own vault sync, sharing and backups still apply.
