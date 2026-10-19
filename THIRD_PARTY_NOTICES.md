# Third-party notices

Page Foundry bundles the following components into its generated plugin file:

- **Typst** and **typst.ts** — Apache License 2.0. The browser compiler is
  provided by `@myriaddreamin/typst-ts-web-compiler` and the JavaScript adapter
  by `@myriaddreamin/typst.ts`. The build restricts their adapters to embedded
  module/local font bytes and static reviewed callbacks, omitting optional
  remote/filesystem loaders and arbitrary string-code execution. The WASM bytes
  are unchanged. See [review hardening](docs/architecture/review-hardening.md).
- **File Viewer Typst assets** — Apache License 2.0. Page Foundry uses the
  packaged copy of the standard Typst font assets without its installer or
  renderer runtime.
- **Libertinus Serif** — SIL Open Font License 1.1.
- **DejaVu Sans Mono** — Bitstream Vera / Arev font licences; DejaVu changes are
  public domain. Bundled locally for code formatting.
- **fflate**, **unified**, **remark-parse**, and **remark-frontmatter** — MIT
  License.
- **mdast-util-gfm-table** and **micromark-extension-gfm-table** — MIT License.
- **docx** — MIT License. Page Foundry uses its browser packer to create
  editable Office Open XML documents locally. Native bind/generator feature
  detection replaces obsolete string-code fallbacks; the unused data-URL image
  path is disabled in favour of validated local image bytes.
- **JSZip** — MIT License (the MIT option of its dual licence). The build uses
  the same pinned modular version instead of docx's embedded minified copy. Page
  Foundry supplies a timer-backed function-only scheduler and native Promise
  support; obsolete script-element and string-code fallbacks and the unused
  Node-stream interface are omitted. See
  [ZIP runtime adaptation](docs/architecture/zip-runtime.md).
- **yaml** — ISC License.

The exact versions are recorded in `package-lock.json`. Release preparation must
preserve the applicable licence texts and review this inventory after every
dependency change.

The production build collects installed non-development dependency and font
licences, project licence and notices into its generated JavaScript footer.
Local release staging also retains `THIRD_PARTY_LICENSES.txt`. Public releases
need only the three Obsidian plugin files; BRAT receives all licence text in
`main.js` without relying on unsupported extra assets. This inventory includes
transitive dependency notices; it is not a replacement for reviewing newly
bundled components. The Libertinus licence source is pinned in
`licenses/Libertinus-OFL.txt`. The DejaVu font licence is retained in
`licenses/DejaVu-LICENSE.txt`.

The Live Preview extension uses CodeMirror's MIT-licensed view API provided by
Obsidian. It is a pinned development dependency and is external to the generated
plugin bundle; the plugin does not ship a second editor runtime.
