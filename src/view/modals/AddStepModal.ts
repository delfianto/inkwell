import { App, Modal } from "obsidian";
import { mount } from "svelte";

import AddStepModalContent from "./AddStepModal.svelte";
import { appContext } from "src/view/utils";

export default class AddStepModal extends Modal {
  constructor(app: App) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;

    contentEl.createEl("h1", { text: "Add Compile Step to Workflow" });
    const entrypoint = contentEl.createDiv("inkwell-add-step-root");

    const context = appContext(this);
    context.set("close", () => this.close());

    mount(AddStepModalContent, {
      target: entrypoint,
      context,
    });
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}
