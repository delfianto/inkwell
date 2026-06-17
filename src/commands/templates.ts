import type { Editor, MarkdownFileInfo, MarkdownView } from "obsidian";

import { projectForPath } from "src/model/scene-navigation";
import { projects, selectedProjectPath } from "src/model/stores";
import { get } from "svelte/store";
import type { CommandBuilder } from "./types";
import { insertProjectFrontmatter } from "src/model/project-utils";
import { fileNameFromPath } from "src/lib/path";
import type { Project, MultipleSceneProject, SingleSceneProject } from "src/model/types";

const callbackForFormat = (
  format: "scenes" | "single",
  checking: boolean,
  _editor: Editor,
  view: MarkdownView | MarkdownFileInfo,
): boolean | void => {
  const file = view.file;

  const project = projectForPath(file.path, get(projects));
  if (checking && project) {
    return false;
  } else if (project) {
    console.log(
      `[Inkwell] Attempted to insert frontmatter into existing project at ${file.path}; ignoring.`,
    );
  } else if (checking) {
    return true;
  }

  const title = fileNameFromPath(file.path);

  const newProject: Project = (() => {
    if (format === "scenes") {
      const multi: MultipleSceneProject = {
        format: "scenes",
        title,
        titleInFrontmatter: false,
        vaultPath: file.path,
        workflow: null,
        sceneFolder: "/",
        scenes: [],
        ignoredFiles: [],
        unknownFiles: [],
        sceneTemplate: null,
        ebook: {},
      };
      return multi;
    } else {
      const single: SingleSceneProject = {
        format: "single",
        title,
        titleInFrontmatter: false,
        vaultPath: file.path,
        workflow: null,
        ebook: {},
      };
      return single;
    }
  })();

  insertProjectFrontmatter(view.app, file.path, newProject).then(() => {
    selectedProjectPath.set(file.path);
  });
};

export const insertMultiSceneTemplate: CommandBuilder = (_plugin) => ({
  id: "inkwell-insert-multi-scene",
  name: "Insert multi-scene frontmatter",
  editorCheckCallback(checking, editor, view) {
    return callbackForFormat("scenes", checking, editor, view);
  },
});

export const insertSingleSceneTemplate: CommandBuilder = (_plugin) => ({
  id: "inkwell-insert-single-scene",
  name: "Insert single-scene frontmatter",
  editorCheckCallback(checking, editor, view) {
    return callbackForFormat("single", checking, editor, view);
  },
});
