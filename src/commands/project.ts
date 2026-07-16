import { type App, TFolder } from "obsidian";
import { type CommandBuilder } from "./types";
import { JumpModal } from "./helpers";
import NewProjectModal from "src/view/modals/NewProjectModal";

/** Global command id (Obsidian prefixes it with the plugin id → `inkwell:…`). */
export const CREATE_PROJECT_COMMAND_ID = "inkwell-create-project";

function folderChoices(app: App): Map<string, TFolder> {
  const folders = app.vault
    .getAllLoadedFiles()
    .filter((f): f is TFolder => f instanceof TFolder)
    .toSorted((a, b) => a.path.localeCompare(b.path));

  const choices = new Map<string, TFolder>();
  for (const folder of folders) {
    choices.set(folder.isRoot() ? "/" : folder.path, folder);
  }
  return choices;
}

export const createProject: CommandBuilder = (plugin) => ({
  id: CREATE_PROJECT_COMMAND_ID,
  name: "Create new project",
  callback: () => {
    new JumpModal(
      plugin.app,
      folderChoices(plugin.app),
      [
        { command: "↑↓", purpose: "to navigate" },
        { command: "↵", purpose: "to choose folder" },
        { command: "esc", purpose: "to dismiss" },
      ],
      (folder: TFolder) => {
        new NewProjectModal(plugin.app, folder).open();
      },
    ).open();
  },
});
