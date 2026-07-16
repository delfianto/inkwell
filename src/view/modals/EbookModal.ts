import { type App, Modal } from "obsidian";
import { mount, unmount } from "svelte";
import { appContext } from "src/view/utils";
import EbookModalContent from "./EbookModal.svelte";

export default class EbookModal extends Modal {
  private component: ReturnType<typeof mount> | null = null;

  constructor(app: App) {
    super(app);
  }

  override onOpen(): void {
    const { contentEl } = this;

    this.modalEl.addClass("inkwell-ebook-modal");
    this.setTitle("eBook metadata");
    const entrypoint = contentEl.createDiv("inkwell-ebook-root");

    const context = appContext(this);
    context.set("close", () => this.close());

    this.component = mount(EbookModalContent, {
      target: entrypoint,
      context,
    });
  }

  override onClose(): void {
    if (this.component) {
      unmount(this.component);
      this.component = null;
    }
    this.contentEl.empty();
  }
}
