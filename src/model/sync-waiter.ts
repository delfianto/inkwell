import { pluginSettings, waitingForSync } from "./stores";
import { type App } from "obsidian";
import { get } from "svelte/store";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

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
  private settlingTime = 30_000;

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
        await this.fallbackWait();
        return;
      }

      console.log("[Inkwell] Waiting for active sync to complete...");
      const deadline = Date.now() + this.settlingTime;
      while (sync.syncing && Date.now() < deadline) {
        await delay(1000);
      }
      console.log(sync.syncing ? "[Inkwell] Sync wait timed out" : "[Inkwell] Sync complete.");
      waitingForSync.set(false);
    } catch {
      waitingForSync.set(false);
      await this.fallbackWait();
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

    await delay(settings.fallbackWaitTime * 1000);
  }
}
