/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
/** Minimal optional desktop contract; never imported on mobile. */
declare module "electron" {
  interface Shell {
    openPath(path: string): Promise<string>;
    showItemInFolder(path: string): void;
  }
  export const shell: Shell | undefined;
  export const remote: { shell?: Shell } | undefined;
}
