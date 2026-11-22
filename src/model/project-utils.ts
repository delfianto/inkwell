import { type App, Notice, TFile, type Vault } from "obsidian";
import { CHAPTER_TEMPLATE_PATH, createChapterNote } from "./chapter-template";
import { codexFolderPath, encodeCodexFolder, ensureCodexFolders, isCodexPath } from "./codex";
import { createNoteWithPotentialTemplate, ensureVaultFolder } from "./note-create";
import {
  EBOOK_STRING_KEYS,
  type EbookMetadata,
  type IndentedScene,
  type MultipleSceneProject,
  type Project,
} from "./types";
import { get, type Writable } from "svelte/store";
import { sceneFolderPath, scenePath } from "src/model/scene-navigation";
import { pluginSettings } from "./stores";

interface SceneInsertionLocation {
  at: "before" | "after" | "end";
  relativeTo: number | null;
}

export interface InsertSceneOptions {
  app: App;
  projectsStore: Writable<Project[]>;
  project: MultipleSceneProject;
  sceneName: string;
  vault: Vault;
  location: SceneInsertionLocation;
  open: boolean;
}

export async function insertScene(options: InsertSceneOptions): Promise<boolean> {
  const { app, projectsStore, project, sceneName, vault, location, open } = options;
  const newScenePath = scenePath(sceneName, project, vault);

  if (vault.getAbstractFileByPath(newScenePath)) {
    new Notice(
      isCodexPath(newScenePath, project)
        ? "A Codex note with that name already exists."
        : "A note with that name already exists in the scene folder.",
    );
    return false;
  }

  const projectPath = project.vaultPath;
  const relativeTitle =
    location.relativeTo === null ? undefined : project.scenes[location.relativeTo]?.title;
  let note: TFile | null;
  try {
    const globalTemplate = get(pluginSettings).sceneTemplate;
    const template = globalTemplate || project.sceneTemplate;
    const chapterMode = globalTemplate
      ? globalTemplate === CHAPTER_TEMPLATE_PATH
      : project.sceneTemplateMode === "chapter";
    note =
      chapterMode && template
        ? await createChapterNote(app, newScenePath, template, sceneName)
        : await createNoteWithPotentialTemplate(app, newScenePath, template);
  } catch (error) {
    console.error("[Inkwell] Could not create scene", error);
    new Notice("Could not create the scene. Check the scene template in Inkwell settings.");
    return false;
  }
  if (!note) {
    new Notice("Could not create the scene. Check the name and scene folder.");
    return false;
  }

  let added = false;
  projectsStore.update((allProjects) =>
    allProjects.map((p) => {
      if (
        p.vaultPath !== projectPath ||
        p.format !== "scenes" ||
        scenePath(sceneName, p, vault) !== newScenePath
      ) {
        return p;
      }
      added = true;
      if (p.scenes.some((scene) => scene.title === sceneName)) return p;
      const scenes = [...p.scenes];
      const anchor = scenes.findIndex((scene) => scene.title === relativeTitle);
      if (location.at === "end" || anchor === -1) {
        scenes.push({ title: sceneName, indent: 0 });
      } else {
        const index = location.at === "before" ? anchor : anchor + 1;
        scenes.splice(index, 0, { title: sceneName, indent: scenes[anchor].indent });
      }
      return { ...p, scenes, unknownFiles: p.unknownFiles.filter((name) => name !== sceneName) };
    }),
  );

  if (!added) {
    new Notice("The scene note was created, but the project changed before it could be added.");
  }
  if (open) await app.workspace.openLinkText(newScenePath, "/", false);
  return true;
}

export function setProjectFrontmatter(obj: Record<string, any>, project: Project) {
  // Cutover hygiene: strip any legacy nested `inkwell:` object that may
  // linger in a file that was previously written by the pre-v3 schema.
  if (obj["inkwell"] && typeof obj["inkwell"] === "object") {
    delete obj["inkwell"];
  }

  obj["inkwell"] = project.format;

  if (project.titleInFrontmatter) {
    obj["title"] = project.title;
  } else {
    delete obj["title"];
  }

  if (project.workflow) {
    obj["workflow"] = project.workflow;
  } else {
    delete obj["workflow"];
  }

  if (project.format === "scenes") {
    obj["sceneFolder"] = project.sceneFolder;
    obj["scenes"] = encodeIndentedScenes(project.scenes);
    if (project.sceneTemplate) {
      obj["sceneTemplate"] = project.sceneTemplate;
    } else {
      delete obj["sceneTemplate"];
    }
    if (project.sceneTemplate && project.sceneTemplateMode === "chapter") {
      obj["sceneTemplateMode"] = "chapter";
    } else {
      delete obj["sceneTemplateMode"];
    }
    if (project.storyTime === "calendar") {
      obj["storyTime"] = "calendar";
    } else {
      delete obj["storyTime"];
    }
    obj["ignoredFiles"] = project.ignoredFiles ?? [];
    if (project.codexFolder) {
      obj["codexFolder"] = encodeCodexFolder(project.codexFolder);
    } else {
      delete obj["codexFolder"];
    }
  } else {
    delete obj["sceneFolder"];
    delete obj["sceneTemplate"];
    delete obj["sceneTemplateMode"];
    delete obj["storyTime"];
    delete obj["scenes"];
    delete obj["ignoredFiles"];
  }

  writeEbookMetadata(obj, project.ebook);
}

function writeEbookMetadata(obj: Record<string, any>, ebook: EbookMetadata | undefined) {
  const e = ebook ?? {};
  for (const key of EBOOK_STRING_KEYS) {
    const value = e[key];
    if (typeof value === "string" && value.trim().length > 0) {
      obj[key] = value;
    } else {
      delete obj[key];
    }
  }

  if (Array.isArray(e.subjects) && e.subjects.length > 0) {
    obj["subjects"] = [...e.subjects];
  } else {
    delete obj["subjects"];
  }

  if (typeof e.seriesIndex === "number" && Number.isFinite(e.seriesIndex)) {
    obj["seriesIndex"] = e.seriesIndex;
  } else {
    delete obj["seriesIndex"];
  }
}

const SCENE_INDENT_TOKEN = "> ";

/**
 * Encodes a list of indented scenes into a flat array of strings, where each
 * scene's indent is represented by a leading run of `> ` tokens.
 *
 * Why a flat list? Obsidian's Properties UI cannot meaningfully render or
 * edit nested arrays; the moment a user saves an index file with one,
 * Obsidian may rewrite the frontmatter and lose the hierarchy. Encoding
 * indent inside the string keeps the data as a single flat array of
 * scalars — Obsidian-safe.
 */
export function encodeIndentedScenes(scenes: IndentedScene[]): string[] {
  return scenes.map(({ title, indent }) => {
    const prefix = SCENE_INDENT_TOKEN.repeat(Math.max(0, indent));
    return `${prefix}${title}`;
  });
}

/**
 * Decodes a flat array of scene strings back into IndentedScene objects.
 * Counts the run of `> ` tokens at the start of each string to determine
 * the scene's indent level.
 */
export function decodeFlatScenes(items: unknown): IndentedScene[] {
  if (!Array.isArray(items)) return [];

  return items
    .map((raw): IndentedScene | null => {
      if (typeof raw !== "string") return null;
      let rest = raw;
      let indent = 0;
      while (rest.startsWith(SCENE_INDENT_TOKEN)) {
        indent += 1;
        rest = rest.slice(SCENE_INDENT_TOKEN.length);
      }
      const title = rest;
      if (title.length === 0) return null;
      return { title, indent };
    })
    .filter((s): s is IndentedScene => s !== null);
}

export type NumberedScene = IndentedScene & {
  numbering: number[];
};

export function numberScenes(scenes: IndentedScene[]): NumberedScene[] {
  const numbering = [0];
  let lastNumberedIndent = 0;

  return scenes.map((scene) => {
    const { indent } = scene;
    if (indent > lastNumberedIndent) {
      let fill = lastNumberedIndent + 1;
      while (fill <= indent) {
        numbering[fill] = 1;
        fill += 1;
      }
      numbering[indent] = 0;
    } else if (indent < lastNumberedIndent) {
      const start = indent + 1;
      numbering.splice(start, numbering.length - start);
    }
    lastNumberedIndent = indent;

    numbering[indent] += 1;
    return {
      ...scene,
      numbering: [...numbering],
    };
  });
}

export function formatSceneNumber(numbering: number[]): string {
  return numbering.join(".");
}

/** A top-level scene ("Act") and the flattened list of its nested scenes. */
export interface SceneGroup<T extends { indent: number }> {
  /** The indent-0 scene that heads the act (or, for a leading orphan run of
   *  indented scenes with no preceding indent-0 scene, that first scene). */
  header: T;
  /** Every following scene at indent > 0, flattened. Deeper nesting is not
   *  preserved here — the Cards view caps hierarchy at two levels, so all
   *  descendants render as sibling cards under the act header. */
  children: T[];
}

/**
 * Groups an ordered, indented scene list into acts for the Cards view: a new
 * act begins at each indent-0 scene, and every following indent > 0 scene
 * becomes one of that act's (flattened) children until the next indent-0 scene.
 *
 * Generic over any `{ indent }`-bearing scene shape ({@link NumberedScene} or
 * the view layer's enriched scenes) so the same grouping serves every view.
 *
 * A flat project (no indentation) yields one act per scene, each with no
 * children — callers that want a flat card grid should check for the absence
 * of nesting first.
 */
export function groupByAct<T extends { indent: number }>(scenes: T[]): SceneGroup<T>[] {
  const acts: SceneGroup<T>[] = [];
  let current: SceneGroup<T> | null = null;

  for (const scene of scenes) {
    if (scene.indent === 0 || current === null) {
      current = { header: scene, children: [] };
      acts.push(current);
    } else {
      current.children.push(scene);
    }
  }

  return acts;
}

export async function insertProjectFrontmatter(app: App, path: string, project: Project) {
  if (project.format === "scenes") {
    await ensureVaultFolder(app.vault, sceneFolderPath(project, app.vault));
    await ensureCodexFolders(app.vault, codexFolderPath(project));
  }
  const exists = await app.vault.adapter.exists(path);
  if (!exists) {
    await app.vault.create(path, "");
  }

  const file = app.vault.getAbstractFileByPath(path);
  if (!(file instanceof TFile)) {
    return;
  }
  try {
    await app.fileManager.processFrontMatter(file, (fm) => {
      setProjectFrontmatter(fm, project);
    });
  } catch (error) {
    console.error("[Inkwell] insertProjectFrontmatter: processFrontMatter error:", error);
  }
}
