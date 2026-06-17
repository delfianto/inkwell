import type { App } from "obsidian";
import { get } from "svelte/store";

import { pluginSettings, waitingForSync } from "./stores";

/**
 * Gates plugin initialization on Obsidian's first-party Sync plugin.
 *
 * When the user has the `waitForSync` setting on and Sync is enabled,
 * `awaitInitialSync()` blocks until Sync reports no active syncing — or until
 * `settlingTime` elapses, at which point we proceed anyway. If Sync's internal
 * API isn't reachable (private surface, may change between Obsidian versions),
 * we fall back to a simple fixed-duration wait controlled by the
 * `fallbackWaitEnabled` / `fallbackWaitTime` settings.
 *
 * Why this exists: the initial vault scan (in `ProjectStoreSync.discoverProjects`)
 * needs to see a stable file tree. If Sync is mid-download, the scan would
 * miss projects or read partial files, and the in-memory projects store would
 * be incomplete.
 */
export class SyncWaiter {
  private app: App;
  private settlingTime = 30000;

  constructor(app: App) {
    this.app = app;
  }

  async awaitInitialSync(): Promise<void> {
    const settings = get(pluginSettings);

    if (!settings.waitForSync || !this.isSyncEnabled()) {
      return;
    }

    try {
      const sync = this.app.internalPlugins.plugins.sync?.instance;

      // Disable watchers and show the loading spinner while we wait.
      waitingForSync.set(true);

      // If we can't access Sync's status (API may have changed), fall back
      // to a fixed-duration wait.
      if (!sync?.syncing) {
        return this.fallbackWait();
      }

      return new Promise((resolve) => {
        if (!sync.syncing) {
          waitingForSync.set(false);
          resolve();
          return;
        }

        console.log("[Inkwell] Waiting for active sync to complete...");

        const interval = setInterval(() => {
          if (!sync.syncing) {
            clearInterval(interval);
            clearTimeout(timeout);
            console.log("[Inkwell] Sync complete.");
            waitingForSync.set(false);
            resolve();
          }
        }, 1000);

        const timeout = setTimeout(() => {
          clearInterval(interval);
          console.log("[Inkwell] Sync wait timed out");
          waitingForSync.set(false);
          resolve();
        }, this.settlingTime);
      });
    } catch {
      waitingForSync.set(false);
      return this.fallbackWait();
    }
  }

  private isSyncEnabled(): boolean {
    try {
      const syncPlugin = this.app.internalPlugins?.plugins?.sync;
      return syncPlugin?.enabled === true;
    } catch {
      return false;
    }
  }

  private async fallbackWait(): Promise<void> {
    const settings = get(pluginSettings);
    if (!settings.fallbackWaitEnabled) {
      return;
    }

    return new Promise((resolve) => setTimeout(resolve, settings.fallbackWaitTime * 1000));
  }
}
