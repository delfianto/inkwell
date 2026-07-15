export const INKWELL_CURRENT_PLUGIN_DATA_VERSION = 3;

export interface IndentedScene {
  title: string;
  indent: number;
}

export interface EbookMetadata {
  author?: string;
  language?: string;
  identifier?: string;
  description?: string;
  cover?: string;
  publisher?: string;
  pubdate?: string;
  rights?: string;
  subjects?: string[];
  series?: string;
  seriesIndex?: number;
}

/** Ebook metadata fields that are scalars (string-valued). Excludes `subjects` (array) and `seriesIndex` (number). */
export const EBOOK_STRING_KEYS = [
  "author",
  "language",
  "identifier",
  "description",
  "cover",
  "publisher",
  "pubdate",
  "rights",
  "series",
] as const satisfies readonly (keyof EbookMetadata)[];

export type EbookStringKey = (typeof EBOOK_STRING_KEYS)[number];

export interface MultipleSceneProject {
  format: "scenes";
  title: string;
  titleInFrontmatter: boolean;
  vaultPath: string;
  workflow: string | null;
  sceneFolder: string;
  scenes: IndentedScene[];
  ignoredFiles: string[] | null;
  unknownFiles: string[];
  sceneTemplate: string | null;
  ebook: EbookMetadata;
}

export interface SingleSceneProject {
  format: "single";
  title: string;
  titleInFrontmatter: boolean;
  vaultPath: string;
  workflow: string | null;
  ebook: EbookMetadata;
}

export type Project = MultipleSceneProject | SingleSceneProject;

export interface SerializedStep {
  id: string;
  optionValues: Record<string, unknown>;
}

export interface SerializedWorkflow {
  name: string;
  description: string;
  steps: SerializedStep[];
}

/**
 * Maps project vault paths to either a map of scene names to word counts or,
 * in the case of single-scene projects, the word count.
 */
export type ProjectWordCounts = Record<string, Record<string, number> | number>;

export interface InkwellPluginSettings {
  version: number;
  selectedProjectPath: string | null;
  workflows: Record<string, SerializedWorkflow> | null;
  numberScenes: boolean;
  sceneTemplate: string | null;
  waitForSync: boolean;
  fallbackWaitEnabled: boolean;
  fallbackWaitTime: number;
}

export const DEFAULT_SETTINGS: InkwellPluginSettings = {
  version: INKWELL_CURRENT_PLUGIN_DATA_VERSION,
  selectedProjectPath: null,
  workflows: null,
  numberScenes: false,
  sceneTemplate: null,
  waitForSync: false,
  fallbackWaitEnabled: true,
  fallbackWaitTime: 5,
};

export const TRACKED_SETTINGS_PATHS: (keyof InkwellPluginSettings)[] = [
  "version",
  "selectedProjectPath",
  "numberScenes",
  "sceneTemplate",
  "waitForSync",
  "fallbackWaitEnabled",
  "fallbackWaitTime",
];

export const PASSTHROUGH_SAVE_SETTINGS_PATHS: (keyof InkwellPluginSettings)[] = [
  "numberScenes",
  "sceneTemplate",
  "waitForSync",
  "fallbackWaitEnabled",
  "fallbackWaitTime",
];
