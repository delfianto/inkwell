import "./styles.css";

import { Plugin, WorkspaceLeaf, FileView, addIcon, TAbstractFile, TFolder } from "obsidian";
import once from "lodash/once";
import pick from "lodash/pick";
import type { Unsubscriber } from "svelte/store";
import { get } from "svelte/store";

import { VIEW_TYPE_INKWELL_EXPLORER, ExplorerPane } from "./view/explorer/ExplorerPane";
import {
  PASSTHROUGH_SAVE_SETTINGS_PATHS,
  type Project,
  type InkwellPluginSettings,
} from "./model/types";
import { DEFAULT_SETTINGS, TRACKED_SETTINGS_PATHS } from "./model/types";
import { activeFile, selectedTab } from "./view/stores";
import { ICON_NAME, ICON_SVG } from "./view/icon";
import { LeafStyler } from "./view/leaf-styler";
import { InkwellSettingsTab } from "./view/settings/InkwellSettings";
import { UserScriptObserver } from "./model/user-script-observer";
import { ProjectStoreSync } from "./model/project-store-sync";
import { WorkflowStorage } from "./model/workflow-storage";
import { selectedProject, selectedProjectPath, initialized, pluginSettings } from "./model/stores";
import { addCommands } from "./commands";
import { WordCountTracker } from "./model/word-count-tracker";
import NewProjectModal from "./view/modals/NewProjectModal";
import { InkwellAPI } from "./api";

export default class InkwellPlugin extends Plugin {
  // Local mirror of the pluginSettings store
  // since this class does a lot of ad-hoc settings fetching.
  // More efficient than a lot of get() calls.
  cachedSettings: InkwellPluginSettings | null = null;
  private unsubscribers: Unsubscriber[] = [];
  private userScriptObserver: UserScriptObserver;
  private projectStoreSync: ProjectStoreSync;
  private workflowStorage: WorkflowStorage;
  wordCountTracker: WordCountTracker;
  public api: InkwellAPI;

  async onload(): Promise<void> {
    console.log(`[Inkwell] Starting Inkwell ${this.manifest.version}…`);
    addIcon(ICON_NAME, ICON_SVG);

    this.registerView(VIEW_TYPE_INKWELL_EXPLORER, (leaf: WorkspaceLeaf) => new ExplorerPane(leaf));

    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file: TAbstractFile) => {
        if (!(file instanceof TFolder)) {
          return;
        }
        menu.addItem((item) => {
          item
            .setTitle("Create Inkwell Project")
            .setIcon(ICON_NAME)
            .onClick(() => {
              new NewProjectModal(this.app, file).open();
            });
        });
      }),
    );

    // Settings
    this.unsubscribers.push(
      pluginSettings.subscribe(async (value) => {
        let shouldSave = false;

        const changeInKeys = (
          obj1: Record<string, any>,
          obj2: Record<string, any>,
          keys: string[],
        ): boolean => {
          return !!keys.find((k) => obj1[k] !== obj2[k]);
        };

        if (
          this.cachedSettings &&
          changeInKeys(this.cachedSettings, value, PASSTHROUGH_SAVE_SETTINGS_PATHS)
        ) {
          shouldSave = true;
        }

        this.cachedSettings = value;

        if (shouldSave) {
          await this.saveSettings();
        }
      }),
    );

    await this.loadSettings();
    this.addSettingTab(new InkwellSettingsTab(this.app, this));

    this.projectStoreSync = new ProjectStoreSync(this.app, this.registerEvent.bind(this));

    this.app.workspace.onLayoutReady(this.postLayoutInit.bind(this));

    // Track active file
    activeFile.set(this.app.workspace.getActiveFile());
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", (leaf) => {
        if (leaf.view instanceof FileView) {
          activeFile.set(leaf.view.file);
        } else {
          // Empty-state view detection — undocumented Obsidian API; may break.
          const emptyView = leaf.view as { emptyTitleEl?: HTMLElement; emptyStateEl?: HTMLElement };
          if (emptyView.emptyTitleEl && emptyView.emptyStateEl) {
            activeFile.set(null);
          }
        }
      }),
    );

    addCommands(this);

    const leafStyler = new LeafStyler(this.app.workspace, this.registerEvent.bind(this));
    this.unsubscribers.push(leafStyler.watch());

    this.api = new InkwellAPI();
  }

  onunload(): void {
    this.projectStoreSync.destroy();
    this.unsubscribers.forEach((u) => u());
    this.wordCountTracker.destroy();
    this.app.workspace.getLeavesOfType(VIEW_TYPE_INKWELL_EXPLORER).forEach((leaf) => leaf.detach());
  }

  async loadSettings(): Promise<void> {
    const settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

    const _pluginSettings: InkwellPluginSettings = pick(
      settings,
      TRACKED_SETTINGS_PATHS,
    ) as InkwellPluginSettings;
    pluginSettings.set(_pluginSettings);
    selectedProjectPath.set(_pluginSettings.selectedProjectPath);

    // User scripts load imperatively first; workflows may reference them.
    this.userScriptObserver = new UserScriptObserver(this.app.vault);
    await this.userScriptObserver.loadUserSteps();

    this.workflowStorage = new WorkflowStorage(this.app);
    await this.workflowStorage.load();

    this.wordCountTracker = new WordCountTracker(this.app.vault);
  }

  async saveSettings(): Promise<void> {
    if (!this.cachedSettings) {
      return;
    }

    await this.saveData(this.cachedSettings);
  }

  private async postLayoutInit(): Promise<void> {
    // Initialize project ↔ vault sync. SyncWaiter (composed inside) gates
    // discovery until Obsidian's first-party Sync plugin settles; vault
    // listeners are registered at the end of initialize().
    await this.projectStoreSync.initialize();

    this.watchProjects();

    const defaultToScenes = once(function (d: Project) {
      if (d && d.format === "scenes") {
        selectedTab.set("Scenes");
      }
    });

    this.unsubscribers.push(
      selectedProject.subscribe(async (d) => {
        if (!get(initialized) || !d) {
          return;
        }

        // On initial load, default to Scenes tab for multi-scene projects.
        defaultToScenes(d);

        pluginSettings.update((s) => ({
          ...s,
          selectedProjectPath: d.vaultPath,
        }));
        this.cachedSettings = get(pluginSettings);
        await this.saveSettings();
      }),
    );

    this.unsubscribers.push(this.workflowStorage.watch());

    this.initLeaf();
    initialized.set(true);
  }

  initLeaf(): void {
    if (this.app.workspace.getLeavesOfType(VIEW_TYPE_INKWELL_EXPLORER).length) {
      return;
    }
    this.app.workspace.getRightLeaf(false).setViewState({
      type: VIEW_TYPE_INKWELL_EXPLORER,
    });
  }

  private watchProjects(): void {
    const onScript = this.userScriptObserver.fileEventCallback.bind(this.userScriptObserver);
    this.registerVaultListeners({
      modify: onScript,
      create: onScript,
      delete: onScript,
      rename: onScript,
    });

    const onWordCountChange = (file: TAbstractFile) =>
      this.wordCountTracker.debouncedCountProjectContaining(file);
    this.registerVaultListeners({
      modify: this.wordCountTracker.fileModified.bind(this.wordCountTracker),
      create: onWordCountChange,
      delete: onWordCountChange,
      rename: onWordCountChange,
    });
  }

  private registerVaultListeners(handlers: {
    modify?: (file: TAbstractFile) => void;
    create?: (file: TAbstractFile) => void;
    delete?: (file: TAbstractFile) => void;
    rename?: (file: TAbstractFile, oldPath: string) => void;
  }) {
    if (handlers.modify) this.registerEvent(this.app.vault.on("modify", handlers.modify));
    if (handlers.create) this.registerEvent(this.app.vault.on("create", handlers.create));
    if (handlers.delete) this.registerEvent(this.app.vault.on("delete", handlers.delete));
    if (handlers.rename) this.registerEvent(this.app.vault.on("rename", handlers.rename));
  }
}
