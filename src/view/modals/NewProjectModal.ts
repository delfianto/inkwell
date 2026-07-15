import { type App, Modal, type TFolder } from "obsidian";
import { type MultipleSceneProject, type Project, type SingleSceneProject } from "src/model/types";
import { appContext } from "src/view/utils";
import { insertProjectFrontmatter } from "src/model/project-utils";
import { mount } from "svelte";
import NewProjectModalContent from "./NewProjectModal.svelte";
import { selectedProjectPath } from "src/model/stores";
import { selectedTab } from "src/view/stores";

export default class NewProjectModal extends Modal {
  private parent: TFolder;

  constructor(app: App, parent: TFolder) {
    super(app);
    this.parent = parent;
  }

  override onOpen(): void {
    const { contentEl } = this;

    this.setTitle("Create Project");
    const entrypoint = contentEl.createDiv("inkwell-add-create-project-root");

    const context = appContext(this);
    context.set("close", () => this.close());
    context.set(
      "createProject",
      async (format: "scenes" | "single", title: string, path: string) => {
        const exists = await this.app.vault.adapter.exists(path);
        if (exists) {
          console.log(`[Inkwell] Cannot create project at ${path}, already exists.`);
          return;
        }

        const parentPath = path.split("/").slice(0, -1).join("/");
        if (!(await this.app.vault.adapter.exists(parentPath))) {
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
              sceneFolder: "/",
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

    mount(NewProjectModalContent, {
      target: entrypoint,
      context,
      props: {
        parent: this.parent,
      },
    });
  }

  override onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}
