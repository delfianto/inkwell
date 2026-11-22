import { type CommandBuilder } from "./types";
import NewProjectModal from "src/view/modals/NewProjectModal";
import { ProjectFolderPicker } from "src/view/modals/ProjectFolderPicker";
import { TFolder } from "obsidian";

/** Global command id (Obsidian prefixes it with the plugin id → `inkwell:…`). */
export const CREATE_PROJECT_COMMAND_ID = "inkwell-create-project";

export const createProject: CommandBuilder = (plugin) => ({
  id: CREATE_PROJECT_COMMAND_ID,
  name: "Create new project",
  callback: () => {
    const { app } = plugin;
    const path = plugin.cachedSettings?.writingProjectsFolder;
    const folder =
      path === "/" ? app.vault.getRoot() : path && app.vault.getAbstractFileByPath(path);
    if (folder instanceof TFolder) {
      new NewProjectModal(app, folder).open();
    } else {
      new ProjectFolderPicker(app, (parent) => new NewProjectModal(app, parent).open()).open();
    }
  },
});
