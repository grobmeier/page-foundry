/*
 * Copyright 2026 Christian Grobmeier
 * Licensed under the Apache License, Version 2.0.
 */

import { FileSystemAdapter, Platform, type App } from "obsidian";

export interface SavedFileActions {
  open(): Promise<void>;
  reveal(): void;
}

interface DesktopShell {
  openPath(path: string): Promise<string>;
  showItemInFolder(path: string): void;
}

export function savedFileActions(
  app: App,
  vaultPath: string,
): SavedFileActions | undefined {
  if (
    !Platform.isDesktopApp ||
    !(app.vault.adapter instanceof FileSystemAdapter)
  ) {
    return undefined;
  }
  try {
    // Electron is loaded only on desktop and only for a completed saved file.
    const host = require("electron") as {
      shell?: DesktopShell;
      remote?: { shell?: DesktopShell };
    };
    const shell = host.shell ?? host.remote?.shell;
    if (!shell?.openPath || !shell.showItemInFolder) return undefined;
    const fullPath = app.vault.adapter.getFullPath(vaultPath);
    return {
      async open() {
        const error = await shell.openPath(fullPath);
        if (error) throw new Error(`Could not open the file: ${error}`);
      },
      reveal() {
        shell.showItemInFolder(fullPath);
      },
    };
  } catch {
    return undefined;
  }
}
