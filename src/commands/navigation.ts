import type { App, PaneType } from "obsidian";

import { get } from "svelte/store";
import { repeat } from "lodash";

import type { CommandBuilder } from "./types";
import { activeFile, selectedTab } from "src/view/stores";
import {
  projects as projectsStore,
  projectsByTitle,
  selectedProject,
  selectedProjectPath,
} from "src/model/stores";
import {
  findScene,
  scenePath,
  scenePathForLocation,
  type SceneNavigationLocation,
} from "src/model/scene-navigation";
import { VIEW_TYPE_INKWELL_EXPLORER } from "src/view/explorer/ExplorerPane";
import type InkwellPlugin from "src/main";
import type { Project } from "src/model/types";
import { JumpModal } from "./helpers";

const checkForLocation = (
  checking: boolean,
  location: SceneNavigationLocation,
  app: App,
): boolean | void => {
  const path = get(activeFile).path;
  const ps = get(projectsStore);
  const newPath = scenePathForLocation(location, path, ps, app.vault);
  if (checking) {
    return newPath !== null;
  }
  app.workspace.openLinkText(newPath, "/", false);
};

export const previousScene: CommandBuilder = (plugin) => ({
  id: "inkwell-previous-scene",
  name: "Previous scene",
  editorCheckCallback: (checking: boolean) =>
    checkForLocation(checking, { position: "previous", maintainIndent: false }, plugin.app),
});

export const previousSceneAtIndent: CommandBuilder = (plugin) => ({
  id: "inkwell-previous-scene-at-level",
  name: "Previous scene at indent level",
  editorCheckCallback: (checking: boolean) =>
    checkForLocation(checking, { position: "previous", maintainIndent: true }, plugin.app),
});

export const nextScene: CommandBuilder = (plugin) => ({
  id: "inkwell-next-scene",
  name: "Next scene",
  editorCheckCallback: (checking: boolean) =>
    checkForLocation(checking, { position: "next", maintainIndent: false }, plugin.app),
});

export const nextSceneAtIndent: CommandBuilder = (plugin) => ({
  id: "inkwell-next-scene-at-level",
  name: "Next scene at indent level",
  editorCheckCallback: (checking: boolean) =>
    checkForLocation(checking, { position: "next", maintainIndent: true }, plugin.app),
});

export const focusCurrentProject: CommandBuilder = () => ({
  id: "inkwell-focus-current-project",
  name: "Open current note's project",
  editorCheckCallback(checking) {
    const path = get(activeFile).path;
    const ps = get(projectsStore);

    const index = ps.findIndex((p) => p.vaultPath === path);
    if (checking && index >= 0) {
      return true;
    } else if (!checking && index >= 0) {
      selectedProjectPath.set(ps[index].vaultPath);
    } else {
      const scene = findScene(path, ps);
      if (checking && scene) {
        return true;
      } else if (!checking && scene) {
        selectedProjectPath.set(scene.project.vaultPath);
      }
    }

    return false;
  },
});

const showLeaf = (plugin: InkwellPlugin) => {
  plugin.initLeaf();
  const leaf = plugin.app.workspace.getLeavesOfType(VIEW_TYPE_INKWELL_EXPLORER).first();
  if (leaf) {
    plugin.app.workspace.revealLeaf(leaf);
  }
};

export const showInkwell: CommandBuilder = (plugin) => ({
  id: "inkwell-show-view",
  name: "Open Inkwell pane",
  callback: () => {
    showLeaf(plugin);
  },
});

export const jumpToProject: CommandBuilder = (plugin) => ({
  id: "inkwell-jump-to-project",
  name: "Jump to project",
  callback: () => {
    const byTitle: Map<string, Project> = new Map(Object.entries(get(projectsByTitle)));

    new JumpModal(
      plugin.app,
      byTitle,
      [
        { command: "↑↓", purpose: "to navigate" },
        { command: "↵", purpose: "to open in Inkwell" },
        { command: "esc", purpose: "to dismiss" },
      ],
      (project: Project) => {
        selectedProjectPath.set(project.vaultPath);
        showLeaf(plugin);
        plugin.app.workspace.openLinkText(project.vaultPath, "/", false);
      },
    ).open();
  },
});

export const jumpToScene: CommandBuilder = (plugin) => ({
  id: "inkwell-jump-to-scene",
  name: "Jump to scene in current project",
  checkCallback(checking) {
    const current = get(selectedProject);
    if (!current || current.format === "single" || current.scenes.length === 0) {
      return false;
    }
    if (checking) {
      return true;
    }

    const scenesToTitles: Map<string, string> = new Map();
    current.scenes.forEach((s) => {
      scenesToTitles.set(`${repeat("\t", s.indent)}${s.title}`, s.title);
    });

    new JumpModal(
      plugin.app,
      scenesToTitles,
      [
        { command: "↑↓", purpose: "to navigate" },
        { command: "↵", purpose: "to open" },
        { command: "cmd ↵", purpose: "to open in a new pane" },
        { command: "esc", purpose: "to dismiss" },
      ],
      (scene: string, modEvent: boolean | PaneType) => {
        const path = scenePath(scene, current, plugin.app.vault);
        if (path) {
          plugin.app.workspace.openLinkText(path, "/", modEvent);
        }
      },
    ).open();
  },
});

export const revealProjectFolder: CommandBuilder = (plugin) => ({
  id: "inkwell-reveal-project-folder",
  name: "Reveal current project in navigation",
  checkCallback(checking) {
    const path = get(selectedProjectPath);
    if (checking) {
      return path !== null;
    }

    if (!path) return;

    try {
      const parent = plugin.app.vault.getAbstractFileByPath(path).parent;
      plugin.app.internalPlugins.plugins["file-explorer"]?.instance.revealInFolder(parent);
    } catch (error) {
      console.error("[Inkwell] Error calling file-explorer.revealInFolder:", error);
    }
  },
});

export const focusNewSceneField: CommandBuilder = (plugin) => ({
  id: "inkwell-focus-new-scene-field",
  name: "Focus new scene field",
  checkCallback(checking) {
    const project = get(selectedProject);
    if (checking) {
      return project && project.format === "scenes";
    }
    if (!project || project.format !== "scenes") return;

    showLeaf(plugin);
    selectedTab.set("Scenes");
    setTimeout(() => {
      activeDocument.getElementById("new-scene").focus();
    }, 0);
  },
});
