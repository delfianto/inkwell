import { type App, Modal, type TFile } from "obsidian";
import { mount, unmount } from "svelte";
import { appContext } from "../utils";
import CodexEditor from "./CodexEditor.svelte";
import ConfirmActionModal from "./ConfirmActionModal";
import { readCodexNote } from "src/model/codex-note";

export class CodexEditorModal extends Modal {
  private component: ReturnType<typeof CodexEditor> | null = null;
  private discardDialog: ConfirmActionModal | null = null;

  constructor(
    app: App,
    private file: TFile,
    private title: string,
  ) {
    super(app);
  }

  override async onOpen(): Promise<void> {
    this.setTitle("Edit Codex entry");
    this.modalEl.addClass("inkwell-codex-edit-modal");
    const status = this.contentEl.createEl("p", {
      cls: "inkwell-codex-load-status",
      text: "Loading…",
    });
    try {
      const note = await readCodexNote(this.app, this.file);
      if (!status.isConnected) return;
      const context = appContext(this);
      context.set("requestClose", () => this.close());
      context.set("closeAfterSave", () => super.close());
      this.component = mount(CodexEditor, {
        target: this.contentEl,
        context,
        props: { file: this.file, title: this.title, note },
      });
      status.remove();
      this.contentEl.querySelector("h2")?.focus({ preventScroll: true });
    } catch (error) {
      if (!status.isConnected) return;
      status.setAttribute("role", "alert");
      status.setText(error instanceof Error ? error.message : "Could not open this Codex entry.");
    }
  }

  override close(): void {
    const state = this.component?.closeState();
    if (state === "saving" || this.discardDialog?.containerEl.isConnected) return;
    if (state === "dirty") {
      this.discardDialog = new ConfirmActionModal(this.app, {
        title: "Discard Codex edits?",
        explanation: "Your changes to this note will be lost.",
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
