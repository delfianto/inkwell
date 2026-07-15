import { type App, Modal } from "obsidian";
import AddStepModalContent from "./AddStepModal.svelte";
import { appContext } from "src/view/utils";
import { mount } from "svelte";

export default class AddStepModal extends Modal {
  constructor(app: App) {
    super(app);
  }

  override onOpen(): void {
    const { contentEl } = this;

    this.modalEl.addClass("inkwell-add-step-modal");
    this.setTitle("Add Compile Step to Workflow");
    const entrypoint = contentEl.createDiv("inkwell-add-step-root");

    const context = appContext(this);
    context.set("close", () => this.close());

    mount(AddStepModalContent, {
      target: entrypoint,
      context,
    });
  }

  override onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}
