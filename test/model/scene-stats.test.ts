import { describe, expect, it } from "vitest";
import {
  type MultipleSceneProject,
  type ProjectWordCounts,
  type SingleSceneProject,
} from "src/model/types";
import { sceneWordCount, statsForScene } from "src/model/scene-stats";

const fakeFile = (path: string) => ({ path }) as never;

const multi: MultipleSceneProject = {
  format: "scenes",
  title: "Novel",
  titleInFrontmatter: true,
  vaultPath: "Novel/Index.md",
  workflow: null,
  sceneFolder: "/",
  scenes: [
    { title: "Chapter 1", indent: 0 },
    { title: "Chapter 2", indent: 0 },
  ],
  ignoredFiles: [],
  unknownFiles: [],
  sceneTemplate: null,
  ebook: {},
};

const single: SingleSceneProject = {
  format: "single",
  title: "Story",
  titleInFrontmatter: true,
  vaultPath: "Story.md",
  workflow: null,
  ebook: {},
};

describe("statsForScene", () => {
  it("returns null when counts has no entry for the project", () => {
    const counts: ProjectWordCounts = {};
    expect(statsForScene(fakeFile("Novel/Chapter 1.md"), multi, counts)).toBeNull();
  });

  it("single-scene project: scene and project totals match the file count", () => {
    const counts: ProjectWordCounts = { "Story.md": 1234 };
    const result = statsForScene(fakeFile("Story.md"), single, counts);
    expect(result).toEqual({ scene: 1234, project: 1234 });
  });

  it("multi-scene project with active file in project returns scene total + project sum", () => {
    const counts: ProjectWordCounts = {
      "Novel/Index.md": { "Chapter 1": 500, "Chapter 2": 700 },
    };
    const result = statsForScene(fakeFile("Novel/Chapter 1.md"), multi, counts);
    expect(result).toEqual({ scene: 500, project: 1200 });
  });

  it("multi-scene project without active file returns scene=0, project=sum", () => {
    const counts: ProjectWordCounts = {
      "Novel/Index.md": { "Chapter 1": 500, "Chapter 2": 700 },
    };
    const result = statsForScene(null, multi, counts);
    expect(result).toEqual({ scene: 0, project: 1200 });
  });

  it("multi-scene project with active file not in project returns scene=0", () => {
    const counts: ProjectWordCounts = {
      "Novel/Index.md": { "Chapter 1": 500, "Chapter 2": 700 },
    };
    // file is in the project's folder but doesn't match any scene name in counts
    const result = statsForScene(fakeFile("Novel/Untitled.md"), multi, counts);
    expect(result).toEqual({ scene: 0, project: 1200 });
  });
});

describe("sceneWordCount", () => {
  const counts: ProjectWordCounts = {
    "Novel/Index.md": { "Chapter 1": 500, "Chapter 2": 700 },
    "Story.md": 1234,
  };

  it("returns the per-scene count for a named scene", () => {
    expect(sceneWordCount(counts, multi, "Chapter 1")).toBe(500);
    expect(sceneWordCount(counts, multi, "Chapter 2")).toBe(700);
  });

  it("returns undefined for a scene absent from the counts map", () => {
    expect(sceneWordCount(counts, multi, "Chapter 3")).toBeUndefined();
  });

  it("returns undefined when the project has no counts entry yet", () => {
    expect(sceneWordCount({}, multi, "Chapter 1")).toBeUndefined();
  });

  it("returns undefined for a single-scene project (no per-scene map)", () => {
    expect(sceneWordCount(counts, single, "Story")).toBeUndefined();
  });
});
