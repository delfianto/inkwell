import { describe, expect, it } from "vitest";
import {
  type MultipleSceneProject,
  type ProjectWordCounts,
  type SingleSceneProject,
} from "src/model/types";
import { statsForScene } from "src/model/scene-stats";

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
