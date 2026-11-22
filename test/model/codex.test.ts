import { codexFolderPath, encodeCodexFolder, isCodexPath, readCodexFolder } from "src/model/codex";
import { describe, expect, it } from "vite-plus/test";
import { type MultipleSceneProject } from "src/model/types";

const project: MultipleSceneProject = {
  format: "scenes",
  title: "Story A",
  titleInFrontmatter: true,
  vaultPath: "Inkwell/StoryA/Index.md",
  workflow: null,
  sceneFolder: "Scenes",
  scenes: [],
  ignoredFiles: [],
  unknownFiles: [],
  sceneTemplate: null,
  ebook: {},
};

describe("project Codex folders", () => {
  it("resolves the default and custom folders from the project index", () => {
    expect(codexFolderPath(project)).toBe("Inkwell/StoryA/Codex");
    const value = readCodexFolder(project.vaultPath, "./Reference/Lore");
    expect(value).toBe("Reference/Lore");
    expect(codexFolderPath({ ...project, codexFolder: value })).toBe(
      "Inkwell/StoryA/Reference/Lore",
    );
  });

  it("continues to resolve existing vault-relative configurations", () => {
    const value = readCodexFolder(project.vaultPath, "Codex");
    expect(value).toBe("../../Codex");
    expect(codexFolderPath({ ...project, codexFolder: value })).toBe("Codex");
    expect(encodeCodexFolder(value!)).toBe("../../Codex");
    expect(readCodexFolder(project.vaultPath, "../../../Outside")).toBeUndefined();
  });

  it("recognizes all four reserved Codex directories", () => {
    for (const directory of ["Assets", "Locations", "Characters", "Timeline"]) {
      expect(isCodexPath(`Inkwell/StoryA/Codex/${directory}/Note.md`, project)).toBe(true);
    }
    expect(isCodexPath("Inkwell/StoryA/Scenes/Note.md", project)).toBe(false);
  });
});
