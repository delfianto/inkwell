import { appContext, ICON_NAME } from "src/view";
import { compile, type CompileStatus, type CompileStepKind, type Workflow } from "src/compile";
import ConfirmActionModal, { type ConfirmActionOptions } from "../modals/ConfirmActionModal";
import { ItemView, Menu, type WorkspaceLeaf } from "obsidian";
import { mount, unmount } from "svelte";
import AddStepModal from "../modals/AddStepModal";
import CompileView from "./CompileView.svelte";
import { type Project } from "src/model";

export const VIEW_TYPE_INKWELL_COMPILE = "VIEW_TYPE_INKWELL_COMPILE";

/**
 * Full-pane (workspace tab) host for the Compile builder. Mirrors
 * {@link ExplorerPane} but provides only the four context functions
 * {@link CompileView} consumes.
 */
export class CompilePane extends ItemView {
  private compileView: ReturnType<typeof mount> | null = null;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_INKWELL_COMPILE;
  }

  getDisplayText(): string {
    return "Compile";
  }

  override getIcon(): string {
    return ICON_NAME;
  }

  override onOpen(): Promise<void> {
    const context = appContext(this);

    context.set("showConfirmModal", (options: ConfirmActionOptions) => {
      new ConfirmActionModal(this.app, options).open();
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

    this.contentEl.addClass("inkwell-compile-pane");
    this.compileView = mount(CompileView, {
      target: this.contentEl,
      context,
    });

    return Promise.resolve();
  }

  override async onClose(): Promise<void> {
    if (this.compileView) {
      await unmount(this.compileView);
      this.compileView = null;
    }
    this.contentEl.empty();
  }
}
