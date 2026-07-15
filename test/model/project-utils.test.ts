import {
  decodeFlatScenes,
  encodeIndentedScenes,
  numberScenes,
  setProjectFrontmatter,
} from "src/model/project-utils";
import { describe, expect, it } from "vitest";
import {
  type IndentedScene,
  type MultipleSceneProject,
  type SingleSceneProject,
} from "src/model/types";

const flat = (titles: string[]): IndentedScene[] => titles.map((title) => ({ title, indent: 0 }));

describe("encodeIndentedScenes / decodeFlatScenes", () => {
  it("round-trips a flat list", () => {
    const input = flat(["one", "two", "three"]);
    expect(encodeIndentedScenes(input)).toEqual(["one", "two", "three"]);
    expect(decodeFlatScenes(encodeIndentedScenes(input))).toEqual(input);
  });

  it("round-trips a nested list", () => {
    const input: IndentedScene[] = [
      { title: "first", indent: 0 },
      { title: "second", indent: 1 },
      { title: "third", indent: 1 },
      { title: "deep child", indent: 2 },
      { title: "fourth", indent: 0 },
    ];
    expect(encodeIndentedScenes(input)).toEqual([
      "first",
      "> second",
      "> third",
      "> > deep child",
      "fourth",
    ]);
    expect(decodeFlatScenes(encodeIndentedScenes(input))).toEqual(input);
  });

  it("skips non-string and empty entries", () => {
    expect(decodeFlatScenes(["", "> ", 42, null, "ok"] as unknown[])).toEqual([
      { title: "ok", indent: 0 },
    ]);
  });

  it("returns empty for non-array input", () => {
    expect(decodeFlatScenes(undefined)).toEqual([]);
    expect(decodeFlatScenes(null)).toEqual([]);
    expect(decodeFlatScenes("not an array")).toEqual([]);
  });

  it("a leading `>` without trailing space is part of the title", () => {
    // Only `> ` (with space) counts as an indent token.
    expect(decodeFlatScenes([">notindented", "> indented"])).toEqual([
      { title: ">notindented", indent: 0 },
      { title: "indented", indent: 1 },
    ]);
  });

  it("clamps negative indents to zero on encode", () => {
    expect(encodeIndentedScenes([{ title: "x", indent: -3 }])).toEqual(["x"]);
  });
});

describe("setProjectFrontmatter (flat v3 schema)", () => {
  const baseMulti: MultipleSceneProject = {
    format: "scenes",
    title: "My Novel",
    titleInFrontmatter: true,
    vaultPath: "Novels/My Novel/Index.md",
    workflow: "Default Workflow",
    sceneFolder: "/",
    scenes: [
      { title: "first", indent: 0 },
      { title: "second", indent: 1 },
    ],
    ignoredFiles: ["*-scratch"],
    unknownFiles: [],
    sceneTemplate: null,
    ebook: {
      author: "Jane Doe",
      language: "en",
      subjects: ["fiction"],
    },
  };

  it("writes the discriminator + flat keys for a multi-scene project", () => {
    const fm: Record<string, any> = {};
    setProjectFrontmatter(fm, baseMulti);
    expect(fm).toEqual({
      inkwell: "scenes",
      title: "My Novel",
      workflow: "Default Workflow",
      sceneFolder: "/",
      scenes: ["first", "> second"],
      ignoredFiles: ["*-scratch"],
      author: "Jane Doe",
      language: "en",
      subjects: ["fiction"],
    });
  });

  it("strips a legacy nested `inkwell:` object on write", () => {
    const fm: Record<string, any> = {
      inkwell: { format: "scenes", title: "Stale", scenes: [["a", "b"]] },
      othermetadata: "preserved",
    };
    setProjectFrontmatter(fm, baseMulti);
    expect(fm.inkwell).toBe("scenes");
    expect(fm.othermetadata).toBe("preserved");
  });

  it("removes `title:` when titleInFrontmatter is false", () => {
    const fm: Record<string, any> = { title: "leftover" };
    setProjectFrontmatter(fm, { ...baseMulti, titleInFrontmatter: false });
    expect(fm.title).toBeUndefined();
  });

  it("omits empty ebook fields", () => {
    const fm: Record<string, any> = {};
    setProjectFrontmatter(fm, { ...baseMulti, ebook: {} });
    expect(fm.author).toBeUndefined();
    expect(fm.subjects).toBeUndefined();
    expect(fm.seriesIndex).toBeUndefined();
  });

  it("clears scene-specific keys for a single-scene project", () => {
    const single: SingleSceneProject = {
      format: "single",
      title: "Short Story",
      titleInFrontmatter: true,
      vaultPath: "Stories/Short Story.md",
      workflow: null,
      ebook: {},
    };
    const fm: Record<string, any> = {
      inkwell: "scenes",
      sceneFolder: "/",
      scenes: ["leftover"],
      ignoredFiles: [],
      sceneTemplate: "tpl.md",
    };
    setProjectFrontmatter(fm, single);
    expect(fm.inkwell).toBe("single");
    expect(fm.sceneFolder).toBeUndefined();
    expect(fm.scenes).toBeUndefined();
    expect(fm.ignoredFiles).toBeUndefined();
    expect(fm.sceneTemplate).toBeUndefined();
  });
});

describe("numberScenes", () => {
  it("numbers a flat list as [1], [2], [3]", () => {
    const scenes: IndentedScene[] = [
      { title: "a", indent: 0 },
      { title: "b", indent: 0 },
      { title: "c", indent: 0 },
    ];
    const result = numberScenes(scenes).map((s) => s.numbering);
    expect(result).toEqual([[1], [2], [3]]);
  });

  it("numbers nested scenes with hierarchical indices", () => {
    const scenes: IndentedScene[] = [
      { title: "a", indent: 0 },
      { title: "a.1", indent: 1 },
      { title: "a.1.1", indent: 2 },
      { title: "a.2", indent: 1 },
      { title: "b", indent: 0 },
    ];
    const result = numberScenes(scenes).map((s) => s.numbering);
    expect(result).toEqual([[1], [1, 1], [1, 1, 1], [1, 2], [2]]);
  });

  it("resets sub-numbering when de-indenting back to root", () => {
    const scenes: IndentedScene[] = [
      { title: "a", indent: 0 },
      { title: "a.1", indent: 1 },
      { title: "b", indent: 0 },
    ];
    const result = numberScenes(scenes).map((s) => s.numbering);
    expect(result).toEqual([[1], [1, 1], [2]]);
  });
});
