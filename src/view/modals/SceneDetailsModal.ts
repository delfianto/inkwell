import { type App, Modal, type TFile } from "obsidian";
import { type CodexEntry, readCodex } from "src/model/codex";
import { mount, unmount } from "svelte";
import { appContext } from "../utils";
import { CodexEntryPicker } from "./CodexEntryPicker";
import { type MultipleSceneProject } from "src/model/types";
import SceneDetails from "./SceneDetails.svelte";

export class SceneDetailsModal extends Modal {
  private component: ReturnType<typeof mount> | null = null;

  constructor(
    app: App,
    private file: TFile,
    private project: MultipleSceneProject,
    private onCodex: (path?: string) => void,
  ) {
    super(app);
  }

  override onOpen(): void {
    this.setTitle("Scene details");
    this.modalEl.addClass("inkwell-scene-details-modal");
    const context = appContext(this);
    context.set("close", () => this.close());
    context.set("openCodex", (path?: string) => {
      this.close();
      this.onCodex(path);
    });
    context.set(
      "chooseCodexEntry",
      (entries: CodexEntry[], onSelect: (entry: CodexEntry) => void) => {
        new CodexEntryPicker(this.app, entries, onSelect).open();
      },
    );
    this.component = mount(SceneDetails, {
      target: this.contentEl,
      context,
      props: { file: this.file, project: this.project, entries: readCodex(this.app, this.project) },
    });
  }

  override onClose(): void {
    if (this.component) {
      void unmount(this.component);
      this.component = null;
    }
    this.contentEl.empty();
  }
}
