# Maintain the example vault

Use a separate vault with neutral examples for development. Keep personal
writing and private designs outside the public engine checkout.

## Add examples

`npm run test-vault` adds missing neutral examples to the ignored
`.test-vault/`. It preserves existing notes, installed plugin files, BRAT and
settings. Install or update Page Foundry through [BRAT](brat.md); the fixture
installer does not install a development bundle over it.

Save pending edits and fully reload Obsidian after external fixture changes.
Reloading only the plugin is insufficient: a stale vault index can report Cannot
open even when the note exists. Open Start here and follow its links. The
[author test path](authoring-templates.md) covers all five starters, formats,
books, private templates, designs and expected errors.

## Refresh generated guidance

`npm run test-vault:guide` explicitly refreshes an unchanged generated guide
from beta.6/beta.7. It refuses edited or unknown guides and verifies a private
backup outside the checkout before replacement. Other notes, designs, BRAT and
settings stay unchanged. The guide follows development main; check the build
under test against your installed beta. Fully reload Obsidian afterwards.

## Start freshly

Only after an explicit request to reset the dedicated test workspace,
`npm run test-vault:fresh` moves old content into a private recovery directory
alongside the checkout, verifies checksums and installs new examples. It retains
BRAT/settings, registered templates/designs and referenced resource folders.
Recovery instructions are stored in `recovery.json`. Preserve the recovery until
its owner accepts the new workspace. Never use this command on a personal vault.
