# Privacy

Page Foundry is designed for private, local manuscripts.

## Commitments

- No client-side telemetry or analytics.
- No account requirement.
- No manuscript upload or cloud rendering by default.
- No automatic discovery of unrelated vault content.
- No automatic upload, publication, or distribution of generated documents.
- No bundled private brands, manuscripts, fonts, artwork, or template packs.

The plugin processes the active note, an explicitly selected manuscript project,
and resources those sources explicitly reference. Generated files stay on the
user's computer unless the user moves or publishes them.

Custom template packs are loaded only from locations the user explicitly
configures. Page Foundry does not copy those packs into its public source tree
or transmit them elsewhere.

## Local layout history

Create and Publish each remember up to 50 template/layout identifiers, use
counts and last-used times in this plugin’s local settings. It does not store
manuscript text, source paths, output filenames, author details, addresses or
export-only metadata in that history. **Clear history** in settings removes
those layout records. History is never sent to a service or used for analytics.

Publish also remembers up to 100 per-note layout choices using SHA-256 hashes of
vault-relative note paths and validated layout identifiers. It does not store
the paths, text, addresses or export-form values in those records. Clearing
history clears these choices too. A path hash is local pseudonymous metadata,
not encryption or a guarantee that a predictable path cannot be guessed.

Registered custom-template paths and output-preset pack paths are separate
explicit configuration stored in local plugin settings. Do not share those
settings or a synced vault if they contain private information. Public source
and beta releases do not publish your local templates or vault files.

## Future network features

Any future feature that uses a network service must be optional, separately
specified, clearly disclosed, and disabled by default. It must not weaken the
local publishing workflow.
