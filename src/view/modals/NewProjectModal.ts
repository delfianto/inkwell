import { type App, Modal, TFolder } from "obsidian";
import {
  DEFAULT_CODEX_FOLDER,
  DEFAULT_SCENE_FOLDER,
  insertProjectFrontmatter,
  type MultipleSceneProject,
  type Project,
  selectedProjectPath,
  type SingleSceneProject,
} from "src/model";
import { mount, unmount } from "svelte";
import { appContext } from "src/view/utils";
import NewProjectModalContent from "./NewProjectModal.svelte";
import { ProjectFolderPicker } from "./ProjectFolderPicker";
import { selectedTab } from "src/view/stores";

export default class NewProjectModal extends Modal {
  private parent: TFolder;
  private component: ReturnType<typeof mount> | null = null;

  constructor(app: App, parent: TFolder) {
    super(app);
    this.parent = parent;
  }

  override onOpen(): void {
    const { contentEl } = this;

    this.modalEl.addClass("inkwell-new-project-modal");
    this.setTitle("New Inkwell project");
    const entrypoint = contentEl.createDiv("inkwell-add-create-project-root");

    const context = appContext(this);
    context.set("close", () => this.close());
    context.set("chooseFolder", (select: (folder: TFolder) => void) => {
      new ProjectFolderPicker(this.app, select).open();
    });
    context.set(
      "createProject",
      async (format: "scenes" | "single", title: string, path: string) => {
        const segments = path.split("/");
        const destination = segments.slice(0, format === "scenes" ? -2 : -1).join("/");
        if (
          destination &&
          !(this.app.vault.getAbstractFileByPath(destination) instanceof TFolder)
        ) {
          throw new Error("This folder is no longer available. Choose another folder.");
        }
        const exists = await this.app.vault.adapter.exists(path);
        if (exists) {
          throw new Error(
            "A note already exists at this path. Choose a different title or folder.",
          );
        }

        const parentPath = segments.slice(0, -1).join("/");
        if (parentPath && !(await this.app.vault.adapter.exists(parentPath))) {
          await this.app.vault.createFolder(parentPath);
        }

        const newProject: Project = (() => {
          if (format === "scenes") {
            const multi: MultipleSceneProject = {
              format: "scenes",
              title,
              titleInFrontmatter: true,
              vaultPath: path,
              workflow: null,
              sceneFolder: DEFAULT_SCENE_FOLDER,
              codexFolder: DEFAULT_CODEX_FOLDER,
              scenes: [],
              ignoredFiles: [],
              unknownFiles: [],
              sceneTemplate: null,
              ebook: {},
            };
            return multi;
          }
          const single: SingleSceneProject = {
            format: "single",
            title,
            titleInFrontmatter: true,
            vaultPath: path,
            workflow: null,
            ebook: {},
          };
          return single;
        })();

        await insertProjectFrontmatter(this.app, path, newProject);
        selectedProjectPath.set(path);
        selectedTab.set(format === "scenes" ? "Scenes" : "Project");
        if (format === "single") {
          this.app.workspace.openLinkText(path, "/", false);
        }
        this.close();
      },
    );

    this.component = mount(NewProjectModalContent, {
      target: entrypoint,
      context,
      props: {
        parent: this.parent,
      },
    });
  }

  override onClose(): void {
    if (this.component) {
      void unmount(this.component);
      this.component = null;
    }
    const { contentEl } = this;
    contentEl.empty();
  }
}
