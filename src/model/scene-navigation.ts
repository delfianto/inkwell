import { normalizePath, type Vault } from "obsidian";
import type { Project, MultipleSceneProject } from "./types";

export function projectFolderPath(project: Project, vault: Vault): string {
  return vault.getAbstractFileByPath(project.vaultPath).parent.path;
}

export function sceneFolderPath(project: MultipleSceneProject, vault: Vault): string {
  const root = vault.getAbstractFileByPath(project.vaultPath).parent.path;
  return normalizePath(`${root}/${project.sceneFolder}`);
}

export function scenePathForFolder(sceneName: string, folderPath: string): string {
  return normalizePath(`${folderPath}/${sceneName}.md`);
}

export function scenePath(sceneName: string, project: MultipleSceneProject, vault: Vault): string {
  const sceneFolder = sceneFolderPath(project, vault);
  return scenePathForFolder(sceneName, sceneFolder);
}

export type SceneFinding = {
  project: Project;
  index: number;
  currentIndent: number;
};

export function findScene(path: string, projects: Project[]): SceneFinding | null {
  for (const project of projects) {
    if (project.format === "scenes") {
      const parentPath = project.vaultPath.split("/").slice(0, -1).join("/");
      if (parentPath !== "" && !parentPath) {
        continue;
      }
      const index = project.scenes.findIndex(
        (s) => normalizePath(`${parentPath}/${project.sceneFolder}/${s.title}.md`) === path,
      );
      if (index >= 0) {
        return { project, index, currentIndent: project.scenes[index].indent };
      }
    }
  }
  return null;
}

export function projectForPath(path: string, projects: Project[]): Project | null {
  for (const project of projects) {
    if (project.vaultPath === path) {
      return project;
    } else {
      const found = findScene(path, projects);
      if (found) {
        return found.project;
      }
    }
  }
  return null;
}

export type SceneNavigationLocation = {
  position: "next" | "previous";
  maintainIndent: boolean;
};

export function scenePathForLocation(
  location: SceneNavigationLocation,
  path: string,
  projects: Project[],
  vault: Vault,
): string | null {
  for (const project of projects) {
    if (project.format === "scenes") {
      const root = vault.getAbstractFileByPath(project.vaultPath).parent.path;
      const index = project.scenes.findIndex(
        (s) => normalizePath(`${root}/${project.sceneFolder}/${s.title}.md`) === path,
      );
      if (index >= 0) {
        if (location.position === "next" && index < project.scenes.length - 1) {
          if (!location.maintainIndent) {
            const nextScene = project.scenes[index + 1];
            return normalizePath(`${root}/${project.sceneFolder}/${nextScene.title}.md`);
          } else {
            const indent = project.scenes[index].indent;
            const nextSceneAtIndent = project.scenes
              .slice(index + 1)
              .find((s) => s.indent === indent);
            if (nextSceneAtIndent) {
              return normalizePath(`${root}/${project.sceneFolder}/${nextSceneAtIndent.title}.md`);
            }
          }
        } else if (location.position === "previous" && index > 0) {
          if (!location.maintainIndent) {
            const previousScene = project.scenes[index - 1];
            return normalizePath(`${root}/${project.sceneFolder}/${previousScene.title}.md`);
          } else {
            const indent = project.scenes[index].indent;
            const previousSceneAtIndent = project.scenes
              .slice(0, index)
              .find((s) => s.indent === indent);
            if (previousSceneAtIndent) {
              return normalizePath(
                `${root}/${project.sceneFolder}/${previousSceneAtIndent.title}.md`,
              );
            }
          }
        }
      }
    }
  }
  return null;
}
