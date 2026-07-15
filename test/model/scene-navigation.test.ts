import { describe, expect, it } from "vitest";

import { findScene, projectForPath, scenePathForLocation } from "src/model/scene-navigation";
import { type MultipleSceneProject, type Project, type SingleSceneProject } from "src/model/types";

const project = (overrides: Partial<MultipleSceneProject> = {}): MultipleSceneProject => ({
  format: "scenes",
  title: "Novel",
  titleInFrontmatter: true,
  vaultPath: "Novel/Index.md",
  workflow: null,
  sceneFolder: "/",
  scenes: [
    { title: "Chapter 1", indent: 0 },
    { title: "Section 1.1", indent: 1 },
    { title: "Chapter 2", indent: 0 },
  ],
  ignoredFiles: [],
  unknownFiles: [],
  sceneTemplate: null,
  ebook: {},
  ...overrides,
});

const single = (overrides: Partial<SingleSceneProject> = {}): SingleSceneProject => ({
  format: "single",
  title: "Story",
  titleInFrontmatter: true,
  vaultPath: "Stories/Story.md",
  workflow: null,
  ebook: {},
  ...overrides,
});

describe("findScene", () => {
  it("returns null when no project matches", () => {
    const ps: Project[] = [project()];
    expect(findScene("nonexistent/path.md", ps)).toBeNull();
  });

  it("returns null for a path matching an index file", () => {
    const ps: Project[] = [project()];
    // The index file itself isn't a scene.
    expect(findScene("Novel/Index.md", ps)).toBeNull();
  });

  it("returns the scene + index + indent for a scene file in sceneFolder: '/'", () => {
    const p = project();
    const result = findScene("Novel/Chapter 1.md", [p]);
    expect(result).not.toBeNull();
    expect(result!.project.vaultPath).toBe("Novel/Index.md");
    expect(result!.index).toBe(0);
    expect(result!.currentIndent).toBe(0);
  });

  it("returns the indent of the matched scene", () => {
    const p = project();
    const result = findScene("Novel/Section 1.1.md", [p]);
    expect(result!.index).toBe(1);
    expect(result!.currentIndent).toBe(1);
  });

  it("works for nested sceneFolder", () => {
    const p = project({ sceneFolder: "chapters" });
    const result = findScene("Novel/chapters/Chapter 1.md", [p]);
    expect(result).not.toBeNull();
    expect(result!.index).toBe(0);
  });

  it("skips single-format projects", () => {
    const ps: Project[] = [single({ vaultPath: "Story.md" })];
    expect(findScene("Story.md", ps)).toBeNull();
  });
});

describe("projectForPath", () => {
  it("returns the project when path is its vaultPath", () => {
    const ps: Project[] = [project()];
    const result = projectForPath("Novel/Index.md", ps);
    expect(result?.vaultPath).toBe("Novel/Index.md");
  });

  it("returns the project when path is one of its scenes", () => {
    const ps: Project[] = [project()];
    const result = projectForPath("Novel/Chapter 2.md", ps);
    expect(result?.vaultPath).toBe("Novel/Index.md");
  });

  it("returns null when path is unrelated", () => {
    const ps: Project[] = [project()];
    expect(projectForPath("Other/Folder/note.md", ps)).toBeNull();
  });

  it("finds across multiple projects", () => {
    const a = project({ title: "A", vaultPath: "A/Index.md" });
    const b = project({ title: "B", vaultPath: "B/Index.md" });
    expect(projectForPath("B/Chapter 2.md", [a, b])?.title).toBe("B");
  });
});

describe("scenePathForLocation", () => {
  // scenePathForLocation needs a Vault to resolve the project's parent path,
  // so we provide a minimal mock that satisfies just the access pattern.
  const mockVault = {
    getAbstractFileByPath: (path: string) => ({
      parent: { path: path.split("/").slice(0, -1).join("/") },
    }),
  };

  it("returns the next scene path", () => {
    const p = project();
    const result = scenePathForLocation(
      { position: "next", maintainIndent: false },
      "Novel/Chapter 1.md",
      [p],
      mockVault as never,
    );
    expect(result).toBe("Novel/Section 1.1.md");
  });

  it("returns the previous scene path", () => {
    const p = project();
    const result = scenePathForLocation(
      { position: "previous", maintainIndent: false },
      "Novel/Section 1.1.md",
      [p],
      mockVault as never,
    );
    expect(result).toBe("Novel/Chapter 1.md");
  });

  it("with maintainIndent: true, jumps over deeper scenes", () => {
    const p = project();
    const result = scenePathForLocation(
      { position: "next", maintainIndent: true },
      "Novel/Chapter 1.md",
      [p],
      mockVault as never,
    );
    // Skips the indent-1 "Section 1.1" and lands on the next indent-0 chapter.
    expect(result).toBe("Novel/Chapter 2.md");
  });

  it("returns null at the start when going previous", () => {
    const p = project();
    const result = scenePathForLocation(
      { position: "previous", maintainIndent: false },
      "Novel/Chapter 1.md",
      [p],
      mockVault as never,
    );
    expect(result).toBeNull();
  });

  it("returns null at the end when going next", () => {
    const p = project();
    const result = scenePathForLocation(
      { position: "next", maintainIndent: false },
      "Novel/Chapter 2.md",
      [p],
      mockVault as never,
    );
    expect(result).toBeNull();
  });
});
