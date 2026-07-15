import { activeFile } from "src/view/stores";
import { type CommandBuilder } from "./types";
import { findScene } from "src/model/scene-navigation";
import { get } from "svelte/store";
import { projects } from "src/model/stores";

const checkIndent = (checking: boolean, action: "indent" | "unindent"): boolean | void => {
  const file = get(activeFile);
  if (!file) {
    return checking ? false : undefined;
  }
  const allProjects = get(projects);
  const result = findScene(file.path, allProjects);
  if (checking && result) {
    return action === "indent" || result.currentIndent > 0;
  }

  if (result) {
    projects.update((all) =>
      all.map((p) => {
        if (p.vaultPath !== result.project.vaultPath || p.format !== "scenes") {
          return p;
        }

        const delta = action === "indent" ? 1 : -1;

        p.scenes[result.index].indent += delta;
        return p;
      }),
    );
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
