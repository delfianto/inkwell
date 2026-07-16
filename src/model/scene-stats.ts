import { type Project, type ProjectWordCounts } from "./types";
import { fileNameFromPath } from "src/lib/path";
import { type TFile } from "obsidian";

export interface SceneWordStats {
  scene: number;
  project: number;
}

/**
 * Word count for a single named scene within a multi-scene project, looked up
 * from {@link ProjectWordCounts}. Returns `undefined` when the project has no
 * counts yet, is a single-scene project (no per-scene map), or the scene is
 * absent from the map. Shared by the List / Cards / Outline scene views.
 */
export function sceneWordCount(
  counts: ProjectWordCounts,
  project: Project,
  sceneName: string,
): number | undefined {
  const projectCounts = counts[project.vaultPath];
  if (!projectCounts || typeof projectCounts === "number") {
    return undefined;
  }
  return projectCounts[sceneName];
}

export function statsForScene(
  activeFile: TFile | null,
  project: Project,
  counts: ProjectWordCounts,
): SceneWordStats | null {
  const count = counts[project.vaultPath];
  if (!count) {
    return null;
  }

  let projectTotal = 0;
  if (typeof count === "number") {
    projectTotal = count;
  } else if (typeof count === "object") {
    projectTotal = Object.values(count as Record<string, number>).reduce(
      (total, n) => total + n,
      0,
    );
  }

  if (project.format === "single") {
    return { scene: projectTotal, project: projectTotal };
  }

  const sceneName = activeFile ? fileNameFromPath(activeFile.path) : null;
  const sceneTotal = sceneName && typeof count !== "number" ? (count[sceneName] ?? 0) : 0;
  return { scene: sceneTotal, project: projectTotal };
}
