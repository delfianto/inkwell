import { type App, type TFile } from "obsidian";
import { readStoryDateTime, storyWeekday } from "./story-time";
import { deepEqual } from "src/lib/deep-equal";

export interface SceneStoryDetails {
  title?: string;
  subtitle?: string;
  arc?: number;
  chapter?: number;
  status?: string;
  context?: string;
  summary?: string;
  pov?: string;
  povCharacter?: string;
  characters: string[];
  locations: string[];
  day?: string;
  start?: string;
  finish?: string;
  storyOrder?: number;
  storyWhen?: string;
  mood: string[];
  tags: string[];
  version?: string;
}

const STORY_KEYS = [
  "title",
  "subtitle",
  "arc",
  "chapter",
  "status",
  "context",
  "summary",
  "pov",
  "povCharacter",
  "characters",
  "locations",
  "day",
  "start",
  "finish",
  "storyOrder",
  "storyWhen",
  "mood",
  "tags",
  "version",
] as const satisfies readonly (keyof SceneStoryDetails)[];

function text(value: unknown): string | undefined {
  return typeof value === "string" ? value.trim() || undefined : undefined;
}

function textList(value: unknown): string[] {
  const items = Array.isArray(value) ? value : [value];
  return items.map((item) => text(item)).filter((item): item is string => item !== undefined);
}

function readTags(value: unknown): string[] {
  const tags = typeof value === "string" ? value.split(/[\s,]+/u) : value;
  return textList(tags)
    .map((tag) => tag.replace(/^#/u, ""))
    .filter(Boolean);
}

function number(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function isWikiLink(value: string | undefined): value is string {
  return value?.startsWith("[[") === true && value.endsWith("]]");
}

export function readSceneSummary(properties: Record<string, unknown> = {}): string | undefined {
  return text(properties.summary) ?? text(properties.synopsis) ?? text(properties.description);
}

export function readSceneStory(properties: Record<string, unknown> = {}): SceneStoryDetails {
  const pov = text(properties.pov);
  const linkedPov = isWikiLink(pov);
  return {
    title: text(properties.title),
    subtitle: text(properties.subtitle),
    arc: number(properties.arc),
    chapter: number(properties.chapter),
    status: text(properties.status),
    context: text(properties.context),
    summary: text(properties.summary),
    pov: linkedPov ? undefined : pov,
    povCharacter: text(properties.povCharacter) ?? (linkedPov ? pov : undefined),
    characters: textList(properties.characters),
    locations: textList(properties.locations ?? properties.location),
    day: text(properties.day),
    start: readStoryDateTime(properties.start),
    finish: readStoryDateTime(properties.finish),
    storyOrder: number(properties.storyOrder),
    storyWhen: text(properties.storyWhen),
    mood: textList(properties.mood),
    tags: readTags(properties.tags),
    version: text(properties.version) ?? number(properties.version)?.toString(),
  };
}

export async function saveSceneStory(
  app: App,
  file: TFile,
  original: SceneStoryDetails,
  draft: SceneStoryDetails,
): Promise<void> {
  if (original.start !== draft.start) {
    const day = storyWeekday(draft.start);
    const previousDay = storyWeekday(original.start);
    if (day || (draft.day === original.day && draft.day === previousDay)) {
      draft = { ...draft, day };
    }
  }
  const changes = STORY_KEYS.filter((key) => !deepEqual(original[key], draft[key]));
  if (changes.length === 0) return;

  await app.fileManager.processFrontMatter(file, (properties) => {
    const current = readSceneStory(properties);
    const legacyPov = isWikiLink(text(properties.pov));
    if (
      changes.some(
        (key) => !deepEqual(original[key], current[key]) && !deepEqual(draft[key], current[key]),
      )
    ) {
      throw new Error(
        "These scene details changed elsewhere. Reopen Scene details to edit the latest values.",
      );
    }

    const start = changes.includes("start") ? draft.start : current.start;
    const finish = changes.includes("finish") ? draft.finish : current.finish;
    if (
      (changes.includes("start") || changes.includes("finish")) &&
      start &&
      finish &&
      finish < start
    ) {
      throw new Error("Finish must be at or after the start.");
    }

    for (const key of changes) {
      const value = draft[key];
      if (value !== undefined) properties[key] = value;
      else if (Object.hasOwn(properties, key)) properties[key] = null;
    }

    if (changes.includes("locations")) delete properties.location;
    if (legacyPov && (changes.includes("pov") || changes.includes("povCharacter"))) {
      if (!changes.includes("pov")) properties.pov = null;
      if (!changes.includes("povCharacter")) properties.povCharacter = current.povCharacter;
    }
    if (Object.hasOwn(properties, "updated")) {
      properties.updated = globalThis.moment().format("YYYY-MM-DDTHH:mm:ss");
    }
  });
}

function linkParts(value: string): string[] {
  return value.startsWith("[[") && value.endsWith("]]") ? value.slice(2, -2).split("|") : [value];
}

export function sceneReferenceLabel(value: string): string {
  const [target, alias] = linkParts(value);
  return alias || target.split("/").at(-1)?.replace(/\.md$/u, "") || value;
}

export function sceneReferenceLink(path: string): string {
  return `[[${path.replace(/\.md$/u, "")}]]`;
}

export function sceneReferencePath(
  app: App,
  sourcePath: string,
  value: string,
): string | undefined {
  const [target] = linkParts(value);
  const path = target.split("#")[0].trim();
  return path ? app.metadataCache.getFirstLinkpathDest(path, sourcePath)?.path : undefined;
}

export function sceneReferencePaths(
  app: App,
  sourcePath: string,
  details: SceneStoryDetails,
): Set<string> {
  const references = [details.povCharacter, ...details.characters, ...details.locations];
  return new Set(
    references.flatMap((value) => {
      const target = value && sceneReferencePath(app, sourcePath, value);
      return target ? [target] : [];
    }),
  );
}

export function sortStoryScenes<T extends { story: SceneStoryDetails }>(
  scenes: T[],
  mode?: "calendar",
): {
  placed: T[];
  unplaced: T[];
} {
  const placed: { scene: T; order: number }[] = [];
  const unplaced: T[] = [];
  for (const scene of scenes) {
    const order =
      mode === "calendar" ? Date.parse(`${scene.story.start}Z`) : scene.story.storyOrder;
    if (order === undefined || !Number.isFinite(order)) unplaced.push(scene);
    else placed.push({ scene, order });
  }
  return {
    placed: placed.toSorted((a, b) => a.order - b.order).map(({ scene }) => scene),
    unplaced,
  };
}
