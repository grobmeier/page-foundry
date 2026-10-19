/*
 * Copyright 2026 Christian Grobmeier
 * Licensed under the Apache License, Version 2.0.
 */

import { FileSystemAdapter, Platform, type App } from "obsidian";

export interface SavedFileActions {
  open(): Promise<void>;
  reveal(): Promise<void>;
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
  const fullPath = app.vault.adapter.getFullPath(vaultPath);
  async function desktopShell(): Promise<DesktopShell> {
    // Electron is loaded only on desktop and only for a completed saved file.
    const host: {
      shell?: DesktopShell;
      remote?: { shell?: DesktopShell };
    } = await import("electron");
    const shell = host.shell ?? host.remote?.shell;
    if (!shell?.openPath || !shell.showItemInFolder)
      throw new Error("This desktop host cannot open or reveal saved files.");
    return shell;
  }
  return {
    async open() {
      const error = await (await desktopShell()).openPath(fullPath);
      if (error) throw new Error(`Could not open the file: ${error}`);
    },
    async reveal() {
      (await desktopShell()).showItemInFolder(fullPath);
    },
  };
}
