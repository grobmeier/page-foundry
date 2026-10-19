/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */

export type ZipTask = (...args: unknown[]) => void;
export interface ZipSchedulerHost {
  setTimeout(task: () => void, delay: number): unknown;
  clearTimeout(handle: unknown): void;
  setImmediate?: (task: ZipTask, ...args: unknown[]) => unknown;
  clearImmediate?: (handle: unknown) => void;
}

/** JSZip needs yielding tasks, not legacy DOM/script or string-code fallbacks. */
export function installZipScheduler(host: ZipSchedulerHost): void {
  if (typeof host.setImmediate === "function") return;
  host.setImmediate = (task, ...args) => {
    if (typeof task !== "function")
      throw new TypeError("ZIP tasks must be functions.");
    return host.setTimeout(() => task(...args), 0);
  };
  host.clearImmediate = (handle) => host.clearTimeout(handle);
}
