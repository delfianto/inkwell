import debounce from "lodash/debounce";
import { normalizePath, type App } from "obsidian";
import { get, type Unsubscriber } from "svelte/store";

import { DEFAULT_WORKFLOWS } from "src/compile";
import type { Workflow } from "src/compile";
import { deserializeWorkflow, serializeWorkflow } from "src/compile/serialization";
import { inkwellDataDir } from "src/lib/path";
import { initialized, workflows } from "./stores";
import type { SerializedWorkflow } from "./types";

/**
 * Owns workflow persistence to `.obsidian/inkwell/workflows.json`.
 * Loads on plugin init and writes the file back whenever the `workflows`
 * store changes (debounced).
 */
export class WorkflowStorage {
  private app: App;

  constructor(app: App) {
    this.app = app;
  }

  private get dir(): string {
    return inkwellDataDir(this.app.vault);
  }

  private get path(): string {
    return normalizePath(`${this.dir}/workflows.json`);
  }

  /**
   * Load workflows from the vault file (falling back to `DEFAULT_WORKFLOWS`),
   * deserialize into runtime workflows, and populate the `workflows` store.
   * Also persists immediately so a missing or default file is created on disk.
   */
  async load(): Promise<void> {
    const raw = (await this.readFile()) ?? DEFAULT_WORKFLOWS;

    const deserialized: Record<string, Workflow> = {};
    Object.entries(raw).forEach(([key, value]) => {
      deserialized[key] = deserializeWorkflow(value as SerializedWorkflow);
    });
    workflows.set(deserialized);

    await this.save();
  }

  /**
   * Subscribe to the `workflows` store and write changes back to disk on a
   * 3-second debounce. Returns the unsubscriber for the caller's cleanup.
   */
  watch(): Unsubscriber {
    const debouncedSave = debounce(() => this.save(), 3000);
    return workflows.subscribe(() => {
      if (!get(initialized)) return;
      debouncedSave();
    });
  }

  async save(): Promise<void> {
    const current = get(workflows);
    const serialized: Record<string, SerializedWorkflow> = {};
    Object.entries(current).forEach(([key, value]) => {
      serialized[key] = serializeWorkflow(value);
    });

    try {
      if (!(await this.app.vault.adapter.exists(this.dir))) {
        await this.app.vault.adapter.mkdir(this.dir);
      }
      await this.app.vault.adapter.write(this.path, JSON.stringify(serialized, null, 2));
    } catch (e) {
      console.error("[Inkwell] Failed to save workflows to vault:", e);
    }
  }

  private async readFile(): Promise<Record<string, SerializedWorkflow> | null> {
    try {
      if (await this.app.vault.adapter.exists(this.path)) {
        const raw = await this.app.vault.adapter.read(this.path);
        return JSON.parse(raw);
      }
    } catch (e) {
      console.error("[Inkwell] Failed to read workflows from vault:", e);
    }
    return null;
  }
}
