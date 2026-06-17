import {
  ItemView,
  type KeymapContext,
  Menu,
  TAbstractFile,
  WorkspaceLeaf,
  type PaneType,
  Scope,
} from "obsidian";
import type { CompileStatus, Workflow } from "src/compile";
import { compile, CompileStepKind } from "src/compile";
import type { Project, MultipleSceneProject } from "src/model/types";
import AddStepModal from "../modals/AddStepModal";
import ConfirmActionModal from "../modals/ConfirmActionModal";
import { ICON_NAME } from "../icon";
import ExplorerView from "./ExplorerView.svelte";
import { mount, unmount } from "svelte";
import { scenePath } from "src/model/scene-navigation";
import { get } from "svelte/store";
import { projects, selectedProject } from "src/model/stores";
import { insertScene } from "src/model/project-utils";
import { UndoManager } from "../undo-manager";
import { ignoreScene } from "./scene-menu-items";
import { appContext } from "../utils";

export const VIEW_TYPE_INKWELL_EXPLORER = "VIEW_TYPE_INKWELL_EXPLORER";

export class ExplorerPane extends ItemView {
  private explorerView: ReturnType<typeof mount>;
  private undoManager = new UndoManager();
  private keyScope: Scope;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_INKWELL_EXPLORER;
  }

  getDisplayText(): string {
    return "Inkwell";
  }

  getIcon(): string {
    return ICON_NAME;
  }

  async onOpen(): Promise<void> {
    this.keyScope = new Scope(this.app.scope);
    this.keyScope.register(["Mod"], "z", (evt: KeyboardEvent, ctx: KeymapContext) => {
      const activePane = this.app.workspace.getActiveViewOfType(ExplorerPane);
      if (activePane === this) {
        this.undoManager.send("undo", evt, ctx);
        return false;
      }
      return true;
    });

    this.keyScope.register(["Mod", "Shift"], "z", (evt: KeyboardEvent, ctx: KeymapContext) => {
      const activePane = this.app.workspace.getActiveViewOfType(ExplorerPane);
      if (activePane === this) {
        this.undoManager.send("redo", evt, ctx);
        return false;
      }
      return true;
    });

    const context = appContext(this);

    context.set("undoManager", this.undoManager);

    // Context function for showing a generic confirmation modal
    context.set(
      "showConfirmModal",
      (
        title: string,
        description: string,
        yesText: string,
        yesAction: () => void,
        noText?: string,
        noAction?: () => void,
      ) => {
        new ConfirmActionModal(
          this.app,
          title,
          description,
          yesText,
          yesAction,
          noText,
          noAction,
        ).open();
      },
    );

    // Create a fully-qualified path to a scene from its name.
    context.set("makeScenePath", (project: MultipleSceneProject, sceneName: string) =>
      scenePath(sceneName, project, this.app.vault),
    );

    // Context function for opening scene notes on click
    context.set("onSceneClick", (path: string, paneType: PaneType | boolean) => {
      this.app.workspace.openLinkText(path, "/", paneType);
    });

    // Context function for creating new scene notes given a path
    context.set("onNewScene", async (name: string, open: boolean) => {
      await insertScene(
        this.app,
        projects,
        get(selectedProject) as MultipleSceneProject,
        name,
        this.app.vault,
        { at: "end", relativeTo: null },
        open,
      );
    });

    const addRelativeScene = (at: "before" | "after", file: TAbstractFile) => {
      const project = get(selectedProject) as MultipleSceneProject;
      let sceneName = "Untitled";
      let count = 0;
      const sceneNames = new Set(project.scenes.map((s) => s.title));
      while (sceneNames.has(sceneName)) {
        count = count + 1;
        sceneName = `Untitled ${count}`;
      }

      const relativeTo = project.scenes.map((s) => s.title).indexOf(file.name.split(".md")[0]);

      if (relativeTo >= 0) {
        insertScene(
          this.app,
          projects,
          project,
          sceneName,
          this.app.vault,
          {
            at,
            relativeTo,
          },
          true,
        );
      }
    };

    // Context function for showing a right-click menu
    context.set("onContextClick", (path: string, x: number, y: number, onRename: () => void) => {
      const file = this.app.vault.getAbstractFileByPath(path);
      if (!file) {
        return;
      }
      const menu = new Menu();
      menu.addSeparator();
      menu.addItem((item) => {
        item.setTitle("Rename");
        item.setIcon("pencil");
        item.onClick(onRename);
      });
      menu.addItem((item) => {
        item.setTitle("Delete");
        item.setIcon("trash");
        item.onClick(async () => {
          if (file) {
            await this.app.vault.trash(file, true);
          }
        });
      });
      menu.addItem((item) => {
        item.setTitle("Open in new pane");
        item.setIcon("vertical-split");
        item.onClick(() => this.app.workspace.openLinkText(path, "/", true));
      });
      menu.addItem((item) => {
        item.setTitle("Add new scene above");
        item.setIcon("document");
        item.onClick(() => addRelativeScene("before", file));
      });
      menu.addItem((item) => {
        item.setTitle("Add new scene below");
        item.setIcon("document");
        item.onClick(() => addRelativeScene("after", file));
      });
      menu.addItem((item) => {
        item.setTitle("Ignore note in Inkwell");
        item.setIcon("minus-circle");
        item.onClick(() =>
          ignoreScene(file.name.endsWith(".md") ? file.name.slice(0, -3) : file.name),
        );
      });
      // Triggering this event lets other apps insert menu items
      // including Obsidian, giving us lots of stuff for free.
      this.app.workspace.trigger("file-menu", menu, file, "inkwell");
      menu.showAtPosition({ x, y });
    });
    context.set("showDraftMenu", (x: number, y: number, action: () => void) => {
      const menu = new Menu();
      menu.addItem((item) => {
        item.setTitle("Rename");
        item.setIcon("pencil");
        item.onClick(action);
      });
      menu.showAtPosition({ x, y });
    });
    context.set("renameFolder", (oldPath: string, newPath: string) => {
      this.app.vault.adapter.rename(oldPath, newPath);
    });

    context.set(
      "compile",
      (
        project: Project,
        workflow: Workflow,
        kinds: CompileStepKind[],
        statusCallback: (status: CompileStatus) => void,
      ) => {
        compile(this.app, project, workflow, kinds, statusCallback);
      },
    );

    context.set("openCompileStepMenu", () => new AddStepModal(this.app).open());
    context.set(
      "showCompileActionsMenu",
      (
        x: number,
        y: number,
        currentWorkflowName: string,
        action: (type: "new" | "rename" | "delete") => void,
      ) => {
        const menu = new Menu();
        menu.addItem((item) => {
          item.setTitle("Add new workflow");
          item.setIcon("plus-with-circle");
          item.onClick(() => action("new"));
        });
        if (currentWorkflowName) {
          menu.addItem((item) => {
            item.setTitle(`Rename "${currentWorkflowName}"`);
            item.setIcon("pencil");
            item.onClick(() => action("rename"));
          });
          menu.addItem((item) => {
            item.setTitle(`Delete "${currentWorkflowName}"`);
            item.setIcon("trash");
            item.onClick(() => action("delete"));
          });
        }
        menu.showAtPosition({ x, y });
      },
    );

    this.explorerView = mount(ExplorerView, {
      target: this.contentEl,
      context,
    });
  }

  async onClose(): Promise<void> {
    this.undoManager.destroy();
    if (this.explorerView) {
      await unmount(this.explorerView);
    }
  }
}
