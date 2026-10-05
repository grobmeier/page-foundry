# Third-party notices

Page Foundry bundles the following components into its generated plugin file:

- **Typst** and **typst.ts** — Apache License 2.0. The browser compiler is
  provided by `@myriaddreamin/typst-ts-web-compiler` and the JavaScript adapter
  by `@myriaddreamin/typst.ts`.
- **File Viewer Typst assets** — Apache License 2.0. Page Foundry uses the
  packaged copy of the standard Typst font assets without its installer or
  renderer runtime.
- **Libertinus Serif** — SIL Open Font License 1.1.
- **fflate**, **unified**, **remark-parse**, and **remark-frontmatter** — MIT
  License.
- **docx** — MIT License. Page Foundry uses its browser packer to create
  editable Office Open XML documents locally.
- **yaml** — ISC License.

The exact versions are recorded in `package-lock.json`. Release preparation must
preserve the applicable licence texts and review this inventory after every
dependency change.

The Live Preview extension uses CodeMirror's MIT-licensed view API provided by
Obsidian. It is a pinned development dependency and is external to the generated
plugin bundle; the plugin does not ship a second editor runtime.
