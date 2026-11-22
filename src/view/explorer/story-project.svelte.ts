import { CODEX_KINDS, codexCategoryPath, codexFolderPath, readCodex } from "src/model/codex";
import { type EnrichedScene, enrichScenes } from "./scene-items";
import { type App } from "obsidian";
import { get } from "svelte/store";
import { type MultipleSceneProject } from "src/model/types";
import { onMount } from "svelte";
import { projectWordCounts } from "src/model/stores";
import { sceneFolderPath } from "src/model/scene-navigation";
import { sceneReferencePaths } from "src/model/scene-story";

export function useStoryProject(app: App, getProject: () => MultipleSceneProject) {
  let revision = $state(0);

  onMount(() => {
    const relevant = (path: string) => {
      const project = getProject();
      const codex = codexFolderPath(project);
      const folder = sceneFolderPath(project, app.vault);
      const touchesCodex = CODEX_KINDS.some((kind) => {
        const category = codexCategoryPath(codex, kind);
        return (
          path === category || path.startsWith(`${category}/`) || category.startsWith(`${path}/`)
        );
      });
      return (
        touchesCodex || path.slice(0, path.lastIndexOf("/")) === (folder === "/" ? "" : folder)
      );
    };
    const metadata = app.metadataCache.on("changed", (file) => {
      if (relevant(file.path)) revision += 1;
    });
    const created = app.vault.on("create", (file) => {
      if (relevant(file.path)) revision += 1;
    });
    const deleted = app.vault.on("delete", (file) => {
      if (relevant(file.path)) revision += 1;
    });
    const renamed = app.vault.on("rename", (file, oldPath) => {
      if (relevant(oldPath) || relevant(file.path)) revision += 1;
    });
    return () => {
      app.metadataCache.offref(metadata);
      app.vault.offref(created);
      app.vault.offref(deleted);
      app.vault.offref(renamed);
    };
  });

  const data = $derived.by(() => {
    void revision;
    const project = getProject();
    const entries = readCodex(app, project);
    const entryPaths = new Set(entries.map((entry) => entry.path));
    const scenes = enrichScenes(app, project, get(projectWordCounts));
    const appearances = new Map<string, EnrichedScene[]>();
    for (const scene of scenes) {
      for (const path of sceneReferencePaths(app, scene.path, scene.story)) {
        if (!entryPaths.has(path)) continue;
        const previous = appearances.get(path);
        if (previous) previous.push(scene);
        else appearances.set(path, [scene]);
      }
    }
    return { entries, scenes, appearances };
  });

  return {
    get current() {
      return data;
    },
  };
}
