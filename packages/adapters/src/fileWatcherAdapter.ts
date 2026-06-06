import { watch, type FSWatcher } from "node:fs";
import { resolve } from "node:path";
import type { PlatformRouter } from "@muse-egg/core";

export interface FileWatcherAdapterSettings {
  enabled: boolean;
  paths: string[];
}

export class FileWatcherAdapter {
  private watchers: FSWatcher[] = [];

  constructor(
    private readonly settings: FileWatcherAdapterSettings,
    private readonly router: PlatformRouter
  ) {}

  start(): void {
    if (!this.settings.enabled) {
      return;
    }

    for (const target of this.settings.paths) {
      const root = resolve(target);
      const watcher = watch(root, { recursive: true }, (eventName, filename) => {
        void this.router.receive({
          type: "observed_file_change",
          platform: "file_watcher",
          source: "file_watcher",
          payload: {
            root,
            filename: filename?.toString() ?? "",
            eventName
          }
        });
      });
      this.watchers.push(watcher);
    }
  }

  stop(): void {
    for (const watcher of this.watchers) {
      watcher.close();
    }
    this.watchers = [];
  }
}
