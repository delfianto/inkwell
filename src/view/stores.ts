import { derived, writable } from "svelte/store";
import { type Project, type ProjectWordCounts } from "src/model/types";
import { projectWordCounts, selectedProject } from "src/model/stores";
import { type SceneWordStats, statsForScene } from "src/model/scene-stats";
import { type TFile } from "obsidian";

// Writable stores
export const activeFile = writable<TFile | null>(null);

export type ExplorerTab = "Scenes" | "Project" | "Compile";
export const selectedTab = writable<ExplorerTab>("Project");

const statsFor = (
  file: TFile | null,
  project: Project | null | undefined,
  wordCounts: ProjectWordCounts,
): SceneWordStats | null => {
  if (project && wordCounts) {
    return statsForScene(file, project, wordCounts);
  }
  return null;
};

// Derived stores
export const selectedProjectWordCountStatus = derived(
  [activeFile, selectedProject, projectWordCounts],
  ([$activeFile, $selectedProject, $projectWordCounts]) =>
    $selectedProject ? statsFor($activeFile, $selectedProject, $projectWordCounts) : null,
);
