import { type App } from "obsidian";
import { type CommandBuilder } from "./types";
import { get } from "svelte/store";
import { selectedProject } from "src/model/stores";
import { VIEW_TYPE_INKWELL_COMPILE } from "src/view/compile/CompilePane";

export const OPEN_COMPILE_BUILDER_COMMAND_ID = "inkwell-open-compile-builder";

/**
 * Reveal the Compile builder in a main-area tab, reusing an existing builder
 * leaf if one is already open (mirrors the reuse-first `showLeaf` pattern).
 */
export async function openCompileBuilder(app: App): Promise<void> {
  const existing = app.workspace.getLeavesOfType(VIEW_TYPE_INKWELL_COMPILE).first();
  if (existing) {
    app.workspace.revealLeaf(existing);
    return;
  }
  const leaf = app.workspace.getLeaf("tab");
  await leaf.setViewState({ type: VIEW_TYPE_INKWELL_COMPILE, active: true });
  app.workspace.revealLeaf(leaf);
}

export const openCompileBuilderCommand: CommandBuilder = (plugin) => ({
  id: OPEN_COMPILE_BUILDER_COMMAND_ID,
  name: "Open compile builder",
  checkCallback: (checking: boolean): boolean | void => {
    if (checking) {
      return get(selectedProject) !== null;
    }
    void openCompileBuilder(plugin.app);
  },
});
