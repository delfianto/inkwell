import "./styles.css";
import {
  activeFile,
  ICON_NAME,
  ICON_SVG,
  InkwellSettingsTab,
  LeafStyler,
  sceneViewMode,
  selectedTab,
} from "./view";
import {
  addIcon,
  FileView,
  Plugin,
  type TAbstractFile,
  TFolder,
  type WorkspaceLeaf,
} from "obsidian";
import { CompilePane, VIEW_TYPE_INKWELL_COMPILE } from "./view/compile/CompilePane";
import {
  DEFAULT_SETTINGS,
  initialized,
  type InkwellPluginSettings,
  PASSTHROUGH_SAVE_SETTINGS_PATHS,
  pluginSettings,
  type Project,
  ProjectStoreSync,
  selectedProject,
  selectedProjectPath,
  TRACKED_SETTINGS_PATHS,
  UserScriptObserver,
  WordCountTracker,
  WorkflowStorage,
} from "./model";
import { ExplorerPane, VIEW_TYPE_INKWELL_EXPLORER } from "./view/explorer/ExplorerPane";
import { get, type Unsubscriber } from "svelte/store";
import { addCommands } from "./commands";
import { InkwellAPI } from "./api";
import NewProjectModal from "./view/modals/NewProjectModal";
import { once } from "./lib/fn";

function changeInKeys(
  obj1: Record<string, any>,
  obj2: Record<string, any>,
  keys: string[],
): boolean {
  return keys.some((key) => obj1[key] !== obj2[key]);
}

export default class InkwellPlugin extends Plugin {
  // Local mirror of the pluginSettings store
  // since this class does a lot of ad-hoc settings fetching.
  // More efficient than a lot of get() calls.
  cachedSettings: InkwellPluginSettings | null = null;
  private unsubscribers: Unsubscriber[] = [];
  private userScriptObserver!: UserScriptObserver;
  private projectStoreSync!: ProjectStoreSync;
  private workflowStorage!: WorkflowStorage;
  wordCountTracker!: WordCountTracker;
  public api!: InkwellAPI;

  override async onload(): Promise<void> {
    console.log(`[Inkwell] Starting Inkwell ${this.manifest.version}…`);
    addIcon(ICON_NAME, ICON_SVG);
    this.detectScrollbarStyle();

    this.registerView(VIEW_TYPE_INKWELL_EXPLORER, (leaf: WorkspaceLeaf) => new ExplorerPane(leaf));
    this.registerView(VIEW_TYPE_INKWELL_COMPILE, (leaf: WorkspaceLeaf) => new CompilePane(leaf));

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

    // Persist the Scenes sub-view choice. The store is seeded from settings in
    // loadSettings(); mirror later changes back into pluginSettings so the
    // passthrough-save subscription above writes them to disk.
    this.unsubscribers.push(
      sceneViewMode.subscribe((mode) => {
        pluginSettings.update((s) => (s ? { ...s, sceneViewMode: mode } : s));
      }),
    );

    this.projectStoreSync = new ProjectStoreSync(this.app, this.registerEvent.bind(this));

    this.app.workspace.onLayoutReady(this.postLayoutInit.bind(this));

    // Track active file
    activeFile.set(this.app.workspace.getActiveFile());
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", (leaf) => {
        if (!leaf) return;
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

  override onunload(): void {
    this.projectStoreSync.destroy();
    this.unsubscribers.forEach((u) => u());
    this.wordCountTracker.destroy();
    this.app.workspace.getLeavesOfType(VIEW_TYPE_INKWELL_EXPLORER).forEach((leaf) => leaf.detach());
    this.app.workspace.getLeavesOfType(VIEW_TYPE_INKWELL_COMPILE).forEach((leaf) => leaf.detach());
    document.body.classList.remove("inkwell-classic-scrollbars");
    document.body.style.removeProperty("--inkwell-scrollbar-width");
  }

  /**
   * Flag the body when the environment uses classic, space-taking scrollbars
   * (Obsidian's styled scrollbars, or macOS "always show scroll bars"). Only
   * then does the explorer auto-hide its scroll thumb — native overlay
   * scrollbars already auto-hide and must not be switched to a classic bar.
   */
  private detectScrollbarStyle(): void {
    const probe = document.createElement("div");
    probe.style.cssText = "position:absolute;top:-9999px;width:50px;height:50px;overflow:scroll;";
    document.body.append(probe);
    const width = probe.offsetWidth - probe.clientWidth;
    probe.remove();
    const classic = width > 0;
    document.body.classList.toggle("inkwell-classic-scrollbars", classic);
    if (classic) {
      // Match the custom scrollbar to the native width so there's no reflow.
      document.body.style.setProperty("--inkwell-scrollbar-width", `${width}px`);
    } else {
      document.body.style.removeProperty("--inkwell-scrollbar-width");
    }
  }

  async loadSettings(): Promise<void> {
    const settings = { ...DEFAULT_SETTINGS, ...(await this.loadData()) };

    const trackedSettings = Object.fromEntries(
      TRACKED_SETTINGS_PATHS.filter((key) => key in settings).map((key) => [key, settings[key]]),
    ) as InkwellPluginSettings;
    pluginSettings.set(trackedSettings);
    selectedProjectPath.set(trackedSettings.selectedProjectPath);
    sceneViewMode.set(trackedSettings.sceneViewMode);

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

    const defaultToScenes = once((d: Project) => {
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
      this.workflowStorage.watch(),
    );

    this.initLeaf();
    initialized.set(true);
  }

  initLeaf(): void {
    if (this.app.workspace.getLeavesOfType(VIEW_TYPE_INKWELL_EXPLORER).length > 0) {
      return;
    }
    this.app.workspace.getRightLeaf(false)?.setViewState({
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
