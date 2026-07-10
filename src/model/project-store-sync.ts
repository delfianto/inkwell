import {
  normalizePath,
  TFile,
  type App,
  type CachedMetadata,
  type EventRef,
  type MetadataCache,
  type Vault,
} from "obsidian";
import { get, type Unsubscriber } from "svelte/store";

import { deepEqual } from "src/lib/deep-equal";

import { EBOOK_STRING_KEYS, type EbookMetadata, type Project } from "./types";
import { projects as projectsStore, selectedProjectPath, updateScenesProject } from "./stores";
import { decodeFlatScenes, setProjectFrontmatter } from "src/model/project-utils";
import { fileNameFromPath } from "src/lib/path";
import { findScene, sceneFolderPath } from "./scene-navigation";
import { SyncWaiter } from "./sync-waiter";

type FileWithMetadata = {
  file: TFile;
  metadata: CachedMetadata;
};

export function resolveIfInkwellFile(
  metadataCache: MetadataCache,
  file: TFile,
): FileWithMetadata | null {
  const metadata = metadataCache.getFileCache(file);
  const format = metadata?.frontmatter?.["inkwell"];
  if (format === "scenes" || format === "single") {
    return { file, metadata };
  }
  return null;
}

/**
 * Bidirectional sync between the in-memory `projects` Svelte store and
 * on-disk `Index.md` files in the vault.
 *
 * Disk → memory: scans markdown files at startup for `inkwell:` frontmatter,
 * parses each into a `Project`, populates the store; then listens for vault
 * events (`metadataCache.on("changed")` plus `vault.on("create"|"delete"|"rename")`)
 * to keep the store current as the user edits files outside the plugin UI.
 *
 * Memory → disk: subscribes to the `projects` store; when the Inkwell UI
 * mutates it (title change, scene reorder, ebook metadata edit, etc.) the
 * corresponding `Index.md`'s frontmatter is rewritten via
 * `app.fileManager.processFrontMatter`.
 *
 * `initialize()` defers the initial scan via `SyncWaiter` so the plugin
 * doesn't race against Obsidian's first-party cloud Sync at startup.
 */
export class ProjectStoreSync {
  private app: App;
  private vault: Vault;
  private metadataCache: MetadataCache;
  private registerEvent: (ref: EventRef) => void;
  private syncWaiter: SyncWaiter;

  private lastKnownProjectsByPath: Record<string, Project> = {};
  private unsubscribers: Unsubscriber[] = [];

  private pathsToIgnoreNextChange: Set<string> = new Set();

  constructor(app: App, registerEvent: (ref: EventRef) => void) {
    this.app = app;
    this.vault = app.vault;
    this.metadataCache = app.metadataCache;
    this.registerEvent = registerEvent;
    this.syncWaiter = new SyncWaiter(app);
  }

  destroy(): void {
    this.unsubscribers.forEach((u) => u());
  }

  async initialize() {
    await this.syncWaiter.awaitInitialSync();
    await this.discoverProjects();
    // Register vault listeners only after the initial discover/load
    // completes, so handlers cannot fire during initialization.
    this.registerEvent(this.app.metadataCache.on("changed", this.fileMetadataChanged.bind(this)));
    this.registerEvent(this.app.vault.on("create", (f) => this.fileCreated(f as TFile)));
    this.registerEvent(this.app.vault.on("delete", (f) => this.fileDeleted(f as TFile)));
    this.registerEvent(
      this.app.vault.on("rename", (f, oldPath) => this.fileRenamed(f as TFile, oldPath)),
    );
  }

  async discoverProjects() {
    const start = new Date().getTime();

    const files = this.vault.getMarkdownFiles();
    const resolvedFiles = files.map((f) => resolveIfInkwellFile(this.metadataCache, f));
    const projectFiles = resolvedFiles.filter((f) => f !== null);

    const possibleProjects = await Promise.all(projectFiles.map((f) => this.projectFor(f)));
    const loadedProjects = possibleProjects.filter((d) => d !== null);

    // Write dirty projects back to their index files
    const dirtyProjects = loadedProjects.filter((d) => d.dirty);
    for (const d of dirtyProjects) {
      await this.writeProjectFrontmatter(d.project);
    }

    const projectsToWrite = loadedProjects.map((d) => d.project);

    this.lastKnownProjectsByPath = structuredClone(
      projectsToWrite.reduce((acc: Record<string, Project>, p) => {
        acc[p.vaultPath] = p;
        return acc;
      }, {}),
    );
    projectsStore.set(projectsToWrite);

    // Ensure `selectedProjectPath` points to a discovered project. Without
    // this, a fresh data.json (or a stale path referencing a deleted index
    // file) leaves the picker showing a cosmetic default while the
    // `selectedProject` derived store stays null — every tab gated on a
    // selected project then renders empty.
    this.ensureValidSelectedProject(projectsToWrite);

    console.log(
      `[Inkwell] Loaded and watching projects. Found ${projectFiles.length} projects in ${
        (new Date().getTime() - start) / 1000.0
      }s.`,
    );

    this.unsubscribers.push(projectsStore.subscribe(this.projectsStoreChanged.bind(this)));
  }

  private ensureValidSelectedProject(projects: Project[]): void {
    if (projects.length === 0) return;
    const currentPath = get(selectedProjectPath);
    const stillExists = currentPath !== null && projects.some((p) => p.vaultPath === currentPath);
    if (stillExists) return;
    // Sort by title so the auto-pick matches the picker's alphabetical order.
    const first = [...projects].sort((a, b) =>
      a.title < b.title ? -1 : a.title > b.title ? 1 : 0,
    )[0];
    selectedProjectPath.set(first.vaultPath);
  }

  async fileMetadataChanged(file: TFile, _data: string, cache: CachedMetadata) {
    if (this.pathsToIgnoreNextChange.delete(file.path)) {
      return;
    }

    const result = await this.projectFor({ file, metadata: cache });
    if (!result) {
      const deleted = this.lastKnownProjectsByPath[file.path];
      if (deleted) {
        projectsStore.update((ps) => ps.filter((p) => p.vaultPath !== file.path));
      }
      return;
    }

    const { project } = result;

    const old = this.lastKnownProjectsByPath[project.vaultPath];
    if (!old || !deepEqual(project, old)) {
      this.lastKnownProjectsByPath[project.vaultPath] = project;
      projectsStore.update((ps) => {
        const idx = ps.findIndex((p) => p.vaultPath === project.vaultPath);
        if (idx < 0) {
          ps.push(project);
        } else {
          ps[idx] = project;
        }
        return ps;
      });
    }
  }

  async fileCreated(file: TFile) {
    const owner = this.findOwningSceneFolder(file, get(projectsStore));
    if (owner) {
      this.addUnknownSceneFile(owner.vaultPath, file.basename);
    }
  }

  async fileDeleted(file: TFile) {
    const ps = get(projectsStore);
    if (this.removeProjectByPath(file.path)) return;

    const found = findScene(file.path, ps);
    if (found) {
      this.removeSceneFromProject(found.project.vaultPath, found.index);
      return;
    }

    const ownerProject = ps.find(
      (p) => p.format === "scenes" && p.unknownFiles.contains(file.basename),
    );
    if (ownerProject) {
      this.removeUnknownFile(ownerProject.vaultPath, file.basename);
    }
  }

  async fileRenamed(file: TFile, oldPath: string) {
    if (this.renameProjectInStore(oldPath, file.path)) return;

    const ps = get(projectsStore);
    const newTitle = fileNameFromPath(file.path);
    const foundOld = findScene(oldPath, ps);
    const oldParent = oldPath.split("/").slice(0, -1).join("/");

    if (foundOld && oldParent === file.parent.path) {
      // In-place rename within the same scene folder.
      this.renameSceneInProject(foundOld.project.vaultPath, foundOld.index, newTitle);
      return;
    }

    // File moved out of a known project's scene folder.
    const oldOwner = ps.find(
      (p) => p.format === "scenes" && sceneFolderPath(p, this.vault) === oldParent,
    );
    if (oldOwner) {
      updateScenesProject(oldOwner.vaultPath, (p) => {
        p.scenes = p.scenes.filter((s) => s.title !== file.basename);
        p.unknownFiles = p.unknownFiles.filter((f) => f !== file.basename);
      });
    }

    // File moved into a known project's scene folder.
    const newOwner = ps.find(
      (p) => p.format === "scenes" && sceneFolderPath(p, this.vault) === file.parent.path,
    );
    if (newOwner) {
      this.addUnknownSceneFile(newOwner.vaultPath, file.basename);
    }
  }

  // ---- Intent-named private operations used by the file event handlers. ----

  private findOwningSceneFolder(file: TFile, ps: Project[]): Project | undefined {
    const sceneFolder = file.parent.path;
    return ps.find((p) => {
      if (p.format !== "scenes") return false;
      const parentPath = this.vault.getAbstractFileByPath(p.vaultPath).parent.path;
      const targetPath = normalizePath(`${parentPath}/${p.sceneFolder}`);
      return targetPath === sceneFolder && !p.scenes.map((s) => s.title).contains(file.basename);
    });
  }

  private addUnknownSceneFile(projectVaultPath: string, basename: string) {
    updateScenesProject(projectVaultPath, (p) => {
      if (!p.unknownFiles.contains(basename)) p.unknownFiles.push(basename);
    });
  }

  /** Returns true if a project with `path` existed and was removed. */
  private removeProjectByPath(path: string): boolean {
    const ps = get(projectsStore);
    if (!ps.some((p) => p.vaultPath === path)) return false;
    const remaining = structuredClone(ps).filter((p) => p.vaultPath !== path);
    projectsStore.set(remaining);
    if (get(selectedProjectPath) === path) {
      selectedProjectPath.set(remaining.length > 0 ? remaining[0].vaultPath : null);
    }
    return true;
  }

  private removeSceneFromProject(projectVaultPath: string, sceneIndex: number) {
    updateScenesProject(projectVaultPath, (p) => {
      p.scenes.splice(sceneIndex, 1);
    });
  }

  private removeUnknownFile(projectVaultPath: string, basename: string) {
    updateScenesProject(projectVaultPath, (p) => {
      p.unknownFiles = p.unknownFiles.filter((f) => f !== basename);
    });
  }

  /** Returns true if a project at `oldPath` existed and was renamed to `newPath`. */
  private renameProjectInStore(oldPath: string, newPath: string): boolean {
    const ps = get(projectsStore);
    const idx = ps.findIndex((p) => p.vaultPath === oldPath);
    if (idx < 0) return false;
    projectsStore.update((all) => {
      const p = all[idx];
      p.vaultPath = newPath;
      if (!p.titleInFrontmatter) {
        p.title = fileNameFromPath(newPath);
      }
      return all;
    });
    if (get(selectedProjectPath) === oldPath) {
      selectedProjectPath.set(newPath);
    }
    return true;
  }

  private renameSceneInProject(projectVaultPath: string, sceneIndex: number, newTitle: string) {
    updateScenesProject(projectVaultPath, (p) => {
      p.scenes[sceneIndex].title = newTitle;
    });
  }

  async projectsStoreChanged(newValue: Project[]) {
    for (const project of newValue) {
      const old = this.lastKnownProjectsByPath[project.vaultPath];
      if (!old || !deepEqual(project, old)) {
        this.pathsToIgnoreNextChange.add(project.vaultPath);
        await this.writeProjectFrontmatter(project);
      }
    }

    this.lastKnownProjectsByPath = structuredClone(
      newValue.reduce((acc: Record<string, Project>, p) => {
        acc[p.vaultPath] = p;
        return acc;
      }, {}),
    );
  }

  private async projectFor(
    fileWithMetadata: FileWithMetadata,
  ): Promise<{ project: Project; dirty: boolean } | null> {
    const fm = fileWithMetadata.metadata.frontmatter;
    if (!fm) {
      return null;
    }
    const format = fm["inkwell"];
    if (format !== "scenes" && format !== "single") {
      return null;
    }

    const vaultPath = fileWithMetadata.file.path;
    const rawTitle = fm["title"];
    const titleInFrontmatter = typeof rawTitle === "string" && rawTitle.trim().length > 0;
    const title = titleInFrontmatter ? String(rawTitle) : fileNameFromPath(vaultPath);
    const workflow = typeof fm["workflow"] === "string" ? (fm["workflow"] as string) : null;
    const ebook = readEbookMetadata(fm);

    if (format === "scenes") {
      const scenes = decodeFlatScenes(fm["scenes"]);
      const sceneFolder = typeof fm["sceneFolder"] === "string" ? fm["sceneFolder"] : "/";
      const sceneTemplate =
        typeof fm["sceneTemplate"] === "string" && fm["sceneTemplate"].length > 0
          ? fm["sceneTemplate"]
          : null;
      const ignoredFiles: string[] = Array.isArray(fm["ignoredFiles"])
        ? fm["ignoredFiles"].filter((v: unknown): v is string => typeof v === "string")
        : [];
      const normalizedSceneFolder = normalizePath(
        `${fileWithMetadata.file.parent.path}/${sceneFolder}`,
      );

      let filenamesInSceneFolder: string[] = [];
      if (await this.vault.adapter.exists(normalizedSceneFolder)) {
        filenamesInSceneFolder = (await this.vault.adapter.list(normalizedSceneFolder)).files
          .filter((f) => f !== fileWithMetadata.file.path && f.endsWith(".md"))
          .map((f) => this.vault.getAbstractFileByPath(f)?.name.slice(0, -3))
          .filter((maybeName) => maybeName !== null && maybeName !== undefined) as string[];
      }

      const knownScenes = scenes.filter(({ title }) => filenamesInSceneFolder.contains(title));
      const dirty = knownScenes.length !== scenes.length;

      const sceneTitles = new Set(scenes.map((s) => s.title));
      const newScenes = filenamesInSceneFolder.filter((s) => !sceneTitles.has(s));

      const ignoredRegexes = ignoredFiles.filter((n) => n).map((p) => ignoredPatternToRegex(p));
      const unknownFiles = newScenes.filter(
        (s) => ignoredRegexes.find((r) => r.test(s)) === undefined,
      );

      return {
        project: {
          format: "scenes",
          title,
          titleInFrontmatter,
          vaultPath,
          sceneFolder,
          scenes: knownScenes,
          ignoredFiles,
          unknownFiles,
          sceneTemplate,
          workflow,
          ebook,
        },
        dirty,
      };
    }

    return {
      project: {
        format: "single",
        title,
        titleInFrontmatter,
        vaultPath,
        workflow,
        ebook,
      },
      dirty: false,
    };
  }

  private async writeProjectFrontmatter(project: Project) {
    const file = this.app.vault.getAbstractFileByPath(project.vaultPath);
    if (!file || !(file instanceof TFile)) {
      return;
    }

    await this.app.fileManager.processFrontMatter(file, (fm) => {
      setProjectFrontmatter(fm, project);
    });
  }
}

function readEbookMetadata(fm: Record<string, any>): EbookMetadata {
  const ebook: EbookMetadata = {};
  for (const key of EBOOK_STRING_KEYS) {
    const value = fm[key];
    if (typeof value === "string" && value.trim().length > 0) {
      ebook[key] = value;
    }
  }
  if (Array.isArray(fm["subjects"])) {
    const subjects = fm["subjects"].filter(
      (v: unknown): v is string => typeof v === "string" && v.length > 0,
    );
    if (subjects.length > 0) ebook.subjects = subjects;
  }
  if (typeof fm["seriesIndex"] === "number" && Number.isFinite(fm["seriesIndex"])) {
    ebook.seriesIndex = fm["seriesIndex"];
  }
  return ebook;
}

const ESCAPED_CHARACTERS = new Set("/&$^+.()=!|[]{},".split(""));
function ignoredPatternToRegex(pattern: string): RegExp {
  let regex = "";

  for (let index = 0; index < pattern.length; index++) {
    const c = pattern[index];

    if (ESCAPED_CHARACTERS.has(c)) {
      regex += "\\" + c;
    } else if (c === "*") {
      regex += ".*";
    } else if (c === "?") {
      regex += ".";
    } else {
      regex += c;
    }
  }

  return new RegExp(`^${regex}$`);
}
