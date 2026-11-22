import { type App, Modal, type TFile } from "obsidian";
import { type CodexEntry, readCodex } from "src/model/codex";
import { mount, unmount } from "svelte";
import { appContext } from "../utils";
import { CodexEntryPicker } from "./CodexEntryPicker";
import ConfirmActionModal from "./ConfirmActionModal";
import { type MultipleSceneProject } from "src/model/types";
import SceneDetails from "./SceneDetails.svelte";

export class SceneDetailsModal extends Modal {
  private component: ReturnType<typeof SceneDetails> | null = null;
  private discardDialog: ConfirmActionModal | null = null;

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
    context.set("requestClose", () => this.close());
    context.set("closeAfterSave", () => super.close());
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
    queueMicrotask(() => this.contentEl.querySelector("h2")?.focus({ preventScroll: true }));
  }

  override close(): void {
    const state = this.component?.closeState();
    if (state === "saving" || this.discardDialog?.containerEl.isConnected) return;
    if (state === "dirty") {
      this.discardDialog = new ConfirmActionModal(this.app, {
        title: "Discard scene edits?",
        explanation: "Your changes to this scene will be lost.",
        yesText: "Discard changes",
        noText: "Keep editing",
        yesAction: () => queueMicrotask(() => super.close()),
      });
      this.discardDialog.open();
      return;
    }
    super.close();
  }

  override onClose(): void {
    this.discardDialog = null;
    if (this.component) {
      void unmount(this.component);
      this.component = null;
    }
    this.contentEl.empty();
  }
}
