# Portable DOCX ZIP runtime

The community review of 0.1.0 detected script-element creation in legacy
scheduler fallbacks bundled inside docx's embedded JSZip distribution. Those
fallbacks are not needed by the supported Obsidian runtimes. This is a build
composition fix, not a string rename or scanner exception.

`modern-zip-runtime.mjs` replaces the entire embedded JSZip region in docx 9.8.1
with the **same JSZip 3.10.2**, explicitly pinned as a direct dependency, using
its modular source. The upstream docx distribution SHA-256, expected region
boundaries and JSZip version are checked. Dependency updates must review this
adaptation rather than silently applying it to changed code.

The modular build substitutes JSZip's Promise fallback with native Promise and
its global setImmediate polyfill with a timer-backed scheduler. The scheduler
accepts functions only, forwards arguments, supports clearImmediate and
preserves an existing native setImmediate. Tasks yield to the host event loop;
strings are never evaluated. No script element, message listener or DOM mutation
is used. Timers can be clamped by browser hosts, so native-device performance
remains a separate acceptance check.

From 0.1.3 the pinned DOCX adapter also replaces obsolete bind and
generator/async-constructor string-code probes with native implementations. Its
unused data-URL image path is disabled: the plugin supplies already validated
local image bytes. These reductions are included in repeated DOCX
book/table/image regression checks and the production capability inventory.

Page Foundry uses Blob/Uint8Array output, not JSZip's Node stream API. The build
therefore disables that optional interface rather than adding Node builtins to
the mobile bundle. JSZip's version and licence, and docx's applicable notices,
remain in the dependency inventory and release licence text. Installed
dependency files are not modified.

Both production and browser-smoke builds use the adaptation. A build guard
rejects script-element creation in the resulting JavaScript. Regression tests
exercise cancellation/arguments/native preservation, string rejection, repeated
browser-style DOCX book/table/image exports without a document or network, and
fail-closed handling of unexpected consumers. Other dependency-generated code
must still be assessed separately; this fix does not certify the whole bundle.
