/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import {
  Decoration,
  ViewPlugin,
  type DecorationSet,
  type EditorView,
  type ViewUpdate,
} from "@codemirror/view";
import { editorLivePreviewField } from "obsidian";
import { bookControlComments } from "../books/controlComments";
export function bookLivePreview() {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = this.build(view);
      }
      update(update: ViewUpdate) {
        if (
          update.docChanged ||
          update.viewportChanged ||
          update.state.field(editorLivePreviewField, false) !==
            update.startState.field(editorLivePreviewField, false)
        )
          this.decorations = this.build(update.view);
      }
      private build(view: EditorView): DecorationSet {
        if (
          !view.state.field(editorLivePreviewField, false) ||
          view.state.doc.length > 128 * 1024
        )
          return Decoration.none;
        return Decoration.set(
          bookControlComments(view.state.doc.toString()).map((range) =>
            Decoration.replace({}).range(range.from, range.to),
          ),
        );
      }
    },
    { decorations: (plugin) => plugin.decorations },
  );
}
