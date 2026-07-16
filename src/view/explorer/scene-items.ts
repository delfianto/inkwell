import { type App, TFile } from "obsidian";
import { type MultipleSceneProject, type ProjectWordCounts } from "src/model/types";
import { numberScenes, scenePath } from "src/model";
import { sceneWordCount } from "src/model/scene-stats";

/**
 * A project scene enriched with everything the scene views (List / Cards /
 * Outline) render: its number, resolved path, per-scene word count, and the
 * front-matter-derived `status`, display `title`, and `synopsis`.
 *
 * Shared derivation so the three views stay in lockstep. Reads are synchronous
 * (numbering + metadata cache + the precomputed word-count map); callers put
 * this behind a `$derived` that also depends on a metadata tick so edits to a
 * scene's front-matter re-run it.
 */
export interface EnrichedScene {
  /** Scene title — the file basename and the stable id. */
  name: string;
  /** Front-matter `title` if set, else `name`. */
  displayName: string;
  /** Full vault path to the scene file. */
  path: string;
  /** 0-based indent from the Index.md scene list. */
  indent: number;
  /** Hierarchical number, e.g. `[1, 2]` → "1.2". */
  numbering: number[];
  /** Front-matter `status:` (raw), or undefined. */
  status: string | undefined;
  /** Per-scene word count, or undefined if not yet counted. */
  wordCount: number | undefined;
  /** Front-matter `synopsis` (falling back to `description`), or undefined. */
  synopsis: string | undefined;
}

export function enrichScenes(
  app: App,
  project: MultipleSceneProject,
  wordCounts: ProjectWordCounts,
): EnrichedScene[] {
  return numberScenes(project.scenes).map(({ title, indent, numbering }) => {
    const path = scenePath(title, project, app.vault);
    const file = app.vault.getAbstractFileByPath(path);
    let status: string | undefined;
    let displayName = title;
    let synopsis: string | undefined;
    if (file instanceof TFile) {
      const fm = app.metadataCache.getFileCache(file)?.frontmatter;
      if (fm) {
        if (fm["status"]) {
          status = `${fm["status"]}`;
        }
        const fmTitle = fm["title"];
        if (typeof fmTitle === "string" && fmTitle.trim().length > 0) {
          displayName = fmTitle.trim();
        }
        const rawSynopsis = fm["synopsis"] ?? fm["description"];
        if (typeof rawSynopsis === "string" && rawSynopsis.trim().length > 0) {
          synopsis = rawSynopsis.trim();
        }
      }
    }
    return {
      name: title,
      displayName,
      path,
      indent,
      numbering,
      status,
      wordCount: sceneWordCount(wordCounts, project, title),
      synopsis,
    };
  });
}
