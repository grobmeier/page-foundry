# Repository Instructions

## Product

- Page Foundry is an author-focused Obsidian publishing companion.
- Keep Markdown notes authoritative and do not rewrite manuscript sources as
  part of publishing.
- Keep the renderer independent from the Obsidian user interface.
- Treat deterministic, local publishing as the default. Do not add telemetry or
  manuscript network access.

## Privacy Boundary

- Never add private brand names, text, artwork, fonts, metadata, paths,
  screenshots, templates, or fixtures to this repository.
- Use invented, neutral examples in source, tests, documentation, and media.
- Support private designs only through the documented custom template-pack
  interface.
- Do not enumerate unrelated vault files. Resolve only the active note, an
  explicitly selected project, and explicitly referenced resources.

## Workflow

- Follow the workspace specification process for non-trivial user-facing
  features and obtain agreement before implementation.
- Work directly on `main` until the first release unless the user explicitly
  changes this policy.
- Do not commit, push, publish, or release without explicit approval in the
  current conversation.
- Keep changes small, preserve unrelated work, and update living setup and
  architecture documentation with implementation changes.

## Quality

- Use English for code, documentation, generated technical text, and examples.
- Add Apache-2.0 licence headers to source files where the file format permits.
- Prefer pure, testable domain modules over Obsidian-coupled logic.
- Validate generated documents structurally and visually.
- Use an isolated test vault; never use a personal vault for automated or manual
  development tests.
