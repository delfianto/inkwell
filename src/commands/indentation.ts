import { get } from "svelte/store";

import { activeFile } from "src/view/stores";
import { projects } from "src/model/stores";
import { findScene } from "src/model/scene-navigation";
import type { CommandBuilder } from "./types";

const checkIndent = (checking: boolean, action: "indent" | "unindent"): boolean | void => {
  const path = get(activeFile).path;
  const allProjects = get(projects);
  const result = findScene(path, allProjects);
  if (checking && result) {
    return action === "indent" || result.currentIndent > 0;
  }

  if (result) {
    projects.update((all) => {
      return all.map((p) => {
        if (p.vaultPath !== result.project.vaultPath || p.format !== "scenes") {
          return p;
        }

        const delta = action === "indent" ? 1 : -1;

        p.scenes[result.index].indent = p.scenes[result.index].indent + delta;
        return p;
      });
    });
  }
};

export const indentScene: CommandBuilder = (_plugin) => ({
  id: "inkwell-indent-scene",
  name: "Indent scene",
  editorCheckCallback: (checking: boolean) => checkIndent(checking, "indent"),
});

export const unindentScene: CommandBuilder = (_plugin) => ({
  id: "inkwell-unindent-scene",
  name: "Unindent scene",
  editorCheckCallback: (checking: boolean) => checkIndent(checking, "unindent"),
});
