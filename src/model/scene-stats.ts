import { sum } from "lodash";
import type { TFile } from "obsidian";

import { fileNameFromPath } from "src/lib/path";
import type { Project, ProjectWordCounts } from "./types";

export type SceneWordStats = {
  scene: number;
  project: number;
};

export function statsForScene(
  activeFile: TFile | null,
  project: Project,
  counts: ProjectWordCounts,
): SceneWordStats | null {
  const count = counts[project.vaultPath];
  if (!count) {
    return null;
  }

  const projectTotal =
    typeof count === "number" ? count : typeof count === "object" ? sum(Object.values(count)) : 0;

  if (project.format === "single") {
    return { scene: projectTotal, project: projectTotal };
  }

  const sceneName = activeFile ? fileNameFromPath(activeFile.path) : null;
  const sceneTotal = sceneName && typeof count !== "number" ? (count[sceneName] ?? 0) : 0;
  return { scene: sceneTotal, project: projectTotal };
}
