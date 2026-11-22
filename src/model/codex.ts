import { type App, normalizePath, TFile, TFolder, type Vault } from "obsidian";
import { relativeVaultPath, resolveRelativeVaultPath, vaultParentPath } from "src/lib/path";
import { ensureVaultFolder } from "./note-create";
import { type MultipleSceneProject } from "./types";
import { scenePath } from "./scene-navigation";

export const DEFAULT_CODEX_FOLDER = "Codex";
export const CODEX_CATEGORIES = {
  character: { label: "Characters", folder: "Characters" },
  location: { label: "Locations", folder: "Locations" },
} as const;
export const CODEX_SUBFOLDERS = [
  "Assets",
  CODEX_CATEGORIES.location.folder,
  CODEX_CATEGORIES.character.folder,
  "Timeline",
] as const;

export type CodexKind = keyof typeof CODEX_CATEGORIES;
export const CODEX_KINDS = ["character", "location"] as const;

export interface CodexEntry {
  path: string;
  title: string;
  aliases: string[];
  kind: CodexKind;
  qualifier?: string;
}

export function codexFolderPath(project: MultipleSceneProject): string {
  const parent = vaultParentPath(project.vaultPath);
  return (
    resolveRelativeVaultPath(parent, project.codexFolder ?? DEFAULT_CODEX_FOLDER) ??
    normalizePath(`${parent}/${DEFAULT_CODEX_FOLDER}`)
  );
}

/** A leading dot segment distinguishes new relative paths from legacy vault-relative paths. */
export function readCodexFolder(indexPath: string, value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const path = value.trim();
  const parent = vaultParentPath(indexPath);
  const base = /^\.{1,2}(?:\/|$)/u.test(path) ? parent : "/";
  const target = resolveRelativeVaultPath(base, path);
  return target ? relativeVaultPath(parent, target) : undefined;
}

export function encodeCodexFolder(path: string): string {
  return path === "." || path === ".." || path.startsWith("../") ? path : `./${path}`;
}

export function codexCategoryPath(folder: string, kind: CodexKind): string {
  return normalizePath(`${folder}/${CODEX_CATEGORIES[kind].folder}`);
}

export function isCodexPath(path: string, project: MultipleSceneProject): boolean {
  const folder = codexFolderPath(project);
  return CODEX_SUBFOLDERS.some((name) => path.startsWith(`${normalizePath(`${folder}/${name}`)}/`));
}

export async function ensureCodexFolders(vault: Vault, folder: string): Promise<void> {
  await ensureVaultFolder(vault, folder);
  for (const name of CODEX_SUBFOLDERS) {
    await ensureVaultFolder(vault, normalizePath(`${folder}/${name}`));
  }
}

export function readCodex(app: App, project: MultipleSceneProject): CodexEntry[] {
  const folder = codexFolderPath(project);
  const manuscript = new Set(
    project.scenes.map(({ title }) => scenePath(title, project, app.vault)),
  );
  const entries: CodexEntry[] = [];

  function readFolder(parent: TFolder, kind: CodexKind) {
    for (const file of parent.children) {
      if (file instanceof TFolder) {
        readFolder(file, kind);
      } else if (file instanceof TFile && file.extension === "md" && !manuscript.has(file.path)) {
        const properties = app.metadataCache.getFileCache(file)?.frontmatter;
        if (properties?.inkwell === "scenes" || properties?.inkwell === "single") continue;
        const label = properties?.title ?? properties?.name;
        const rawAliases = properties?.aliases;
        let aliases: string[] = [];
        if (Array.isArray(rawAliases)) {
          aliases = rawAliases.filter((alias): alias is string => typeof alias === "string");
        } else if (typeof rawAliases === "string") {
          aliases = [rawAliases];
        }
        entries.push({
          path: file.path,
          title: (typeof label === "string" && label.trim()) || file.basename,
          aliases,
          kind,
        });
      }
    }
  }

  for (const kind of CODEX_KINDS) {
    const category = app.vault.getAbstractFileByPath(codexCategoryPath(folder, kind));
    if (category instanceof TFolder) readFolder(category, kind);
  }

  // Notes with the same display title need a visible distinction in pickers and lists.
  const firstByTitle = new Map<string, CodexEntry>();
  const relativeStart = folder === "/" ? 0 : folder.length + 1;
  for (const entry of entries) {
    const key = `${entry.kind}/${entry.title.toLowerCase()}`;
    const first = firstByTitle.get(key);
    if (first) {
      first.qualifier = first.path.slice(relativeStart, -3);
      entry.qualifier = entry.path.slice(relativeStart, -3);
    } else {
      firstByTitle.set(key, entry);
    }
  }

  return entries.toSorted((a, b) => a.title.localeCompare(b.title) || a.path.localeCompare(b.path));
}
