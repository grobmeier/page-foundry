# Community review and reproducible builds

## Build identity and provenance

The 0.1.2 packager appended licence text after `npm run build`. The published
JavaScript therefore differed from the build output even though it used the same
runtime. From 0.1.3 the production build emits the complete licence footer;
packaging checks it and copies `main.js` byte-for-byte. Dependency licence names
are sorted and embedded binaries use the pinned JavaScript gzip implementation
with a zero timestamp, avoiding host-specific compressor output.

The stable tag workflow uses Node 22.19.0, locked dependencies and pinned
Actions revisions. It runs source linting, tests, real PDF exports, two matching
production builds and package checks before attesting and publishing the three
installed plugin files. GitHub artifact attestations cover `main.js`,
`manifest.json` and `styles.css`; they are provenance evidence, not a malware
certificate. Earlier releases remain immutable.

## Restricted dependency capabilities

Build adapters verify exact upstream JavaScript hashes before modifying the
composition. No files in `node_modules` are patched on disk.

- Typst's font loader accepts local bytes only. Remote fonts, URL-loaded WASM,
  optional Node filesystem loading and dynamic imports through string code are
  omitted. Page Foundry supplies its embedded module and fonts explicitly.
- Generated WASM glue uses a small reviewed set of static functions instead of
  constructing JavaScript from strings: global lookup, zero, true, path identity
  and two error callbacks for uninitialised access/package models. Any other
  function request fails closed; arbitrary function bodies are not evaluated.
- DOCX uses native bind/generator/async-constructor feature detection instead of
  old string-code polyfills. Data-URL image input is rejected; Page Foundry
  already supplies validated PNG/JPEG bytes. The separate
  [ZIP runtime adaptation](zip-runtime.md) remains in place.
- The production build inventories executable syntax, including direct aliases,
  and rejects reintroduced network or dynamic-JavaScript calls. This bounded
  check is a regression guard, not a full static-analysis or malware service.

The pinned compiler is `@myriaddreamin/typst-ts-web-compiler` 0.7.0. Its
unchanged WASM SHA-256 is
`1fc968438a672366dfec39c96c842c26ed29caff4eb1bcaab19a6c60867de5fd`. It is
embedded rather than downloaded. A service's recognition of WASM hashes is
controlled by that service; the compiler cannot be removed while preserving
offline PDF export.

## Source and host boundaries

Untrusted YAML and stored history are narrowed from `unknown` before field
access. ASCII control-character rejection is explicit and exhaustively tested;
replacing a regex does not weaken path validation. Vault files use
`instanceof TFile` checks. Clipboard writes use the modal's owning window and
occur only after an explicit Copy action; Page Foundry never reads clipboard
contents. Electron loads only for a desktop file action, not on mobile.

Searchable settings definitions and the pre-1.13 display share the same rows and
save handlers. The minimum Obsidian version remains 1.8.7; using the newer
settings search does not require dropping older users.

## Disclosures that should remain honest

- YAML 1.1 binary-data handling includes browser base64 codecs. Embedded assets
  are also encoded data, not hidden executable JavaScript. A base64 disclosure
  alone is not evidence of code execution or manuscript upload.
- Copy-report buttons intentionally write to the clipboard. Removing them just
  to remove a disclosure would remove an author-controlled feature.
- The offline bundle still exceeds the Sync Standard 5 MB per-file limit.
  [#39](https://github.com/grobmeier/page-foundry/issues/39) tracks the separate
  portable-package design; install the plugin separately on each device.
- Malware/obfuscation/network-scan availability and the community site's final
  build-verification result belong to its review service. Local tests and
  attestations cannot truthfully turn an unavailable service into a passed one.

Physical mobile, assistive technology, reader interoperability and print
acceptance remain distinct from source linting or a completed directory scan.
