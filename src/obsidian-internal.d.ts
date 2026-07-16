// Ambient declarations for Obsidian's private API surface that this plugin
// uses. Centralizes the trust-Obsidian boundary in one file so call sites can
// be plain typed access instead of (app as any) / @ts-ignore.
//
// Only the fields actually consumed by the codebase are declared; expand as
// needed.

import { type TAbstractFile, type TFile, type TFolder } from "obsidian";

declare module "obsidian" {
  interface App {
    commands: {
      executeCommandById: (id: string) => boolean;
    };
    plugins: {
      getPlugin: ((id: "templater-obsidian") => TemplaterPlugin | null) &
        ((id: string) => unknown | null);
    };
    internalPlugins: {
      getEnabledPluginById: ((id: "templates") => CoreTemplatesPlugin | null) &
        ((id: string) => unknown | null);
      plugins: {
        sync?: SyncPlugin;
        "file-explorer"?: FileExplorerPlugin;
      };
    };
  }

  interface WorkspaceLeaf {
    id?: string;
  }

  interface FileView {
    emptyTitleEl?: HTMLElement;
    emptyStateEl?: HTMLElement;
  }
}

interface TemplaterPlugin {
  templater: {
    create_running_config: (template: TAbstractFile, file: TFile, runMode: number) => unknown;
    read_and_parse_template: (config: unknown) => Promise<string>;
  };
}

interface CoreTemplatesPlugin {
  options: Record<string, string>;
}

interface SyncPlugin {
  enabled: boolean;
  instance?: {
    syncing: boolean;
    syncStatus: string;
  };
}

interface FileExplorerPlugin {
  instance: {
    revealInFolder: (folder: TFolder) => void;
  };
}
