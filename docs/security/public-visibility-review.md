# Public visibility review — 13 October 2026

The owner authorised making the engine repository public after reviewing it for
credentials and private material. Public repositories, Git history and release
assets are discoverable independently of an Obsidian directory listing.

## Scope and evidence

- Fetched every remote branch and tag: one branch, main, and the first beta tag.
- Gitleaks 8.30.1, obtained from the official release and checksum-verified,
  scanned all 26 pre-transition commits and the tracked HEAD snapshot with
  default rules and fully redacted reports: no leaks detected.
- Reviewed all 472 pre-transition Git objects for private design identifiers,
  personal filesystem paths, private-key headers, credential-bearing URLs and
  private-network references: no findings. No private pack/vault/credential file
  paths were present in the historical file inventory.
- Downloaded every beta.1 asset. Gitleaks and the private-material checks found
  no leaks/private designs; beta.2 assets were scanned separately.
- GitHub contained no issues, pull requests, workflow runs or deployments, one
  beta release, and no enabled Discussions or Pages. Release content was
  reviewed and scanned. Git author metadata retains the owner's intended
  professional attribution; source/licence copyright and dependency-author
  notices remain.
- Runtime inspection found no manuscript upload, telemetry, unrelated-file
  discovery, executable-template evaluation or shell-command execution path.
  Explicit completed-file desktop opening uses Obsidian/Electron file actions.
- Patched development tooling's Moment override to 2.31.0 without downgrading
  Obsidian. The full npm audit reports zero known vulnerabilities; all 126
  tests, format/type checks and the production build pass.

The transition commit and new assets must pass a final secret scan before
visibility changes. Audit reports containing raw GitHub content stay outside
source and release assets. No history rewrite was necessary.

## Ongoing boundaries

Keep private manuscripts, names, custom packs, fonts, artwork and vault settings
outside this repository. Ignore rules reduce accidents but are not a substitute
for reviewing staged files and history. Any exposed credential must be revoked,
even if subsequently removed from Git. Dependency updates are reviewable
proposals, never automatic merges.

This review is not an exhaustive security assessment of Obsidian or the bundled
WebAssembly compiler, and scanners can miss secrets. Physical-device,
file-share, retailer and print acceptance remain open. Keep the beta status
clear and report suspected vulnerabilities privately rather than posting private
notes or keys.
