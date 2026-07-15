import { type App, ButtonComponent, Modal } from "obsidian";

export interface ConfirmActionOptions {
  title: string;
  explanation: string;
  yesText: string;
  yesAction: () => void;
  noText?: string;
  noAction?: () => void;
}

export default class ConfirmActionModal extends Modal {
  title: string;
  explanation: string;
  yesText: string;
  yesAction: () => void;
  noText: string;
  noAction: () => void;

  constructor(app: App, options: ConfirmActionOptions) {
    super(app);
    this.title = options.title;
    this.explanation = options.explanation;
    this.yesText = options.yesText;
    this.yesAction = options.yesAction;
    this.noText = options.noText ?? "Cancel";
    this.noAction = options.noAction ?? (() => this.close());
  }

  override onOpen(): void {
    const { contentEl } = this;

    contentEl.createEl("h1", { text: this.title });
    contentEl.createEl("p", { text: this.explanation });
    new ButtonComponent(contentEl).setButtonText(this.noText).onClick(this.noAction);
    new ButtonComponent(contentEl)
      .setButtonText(this.yesText)
      .setWarning()
      .onClick(() => {
        this.yesAction();
        this.close();
      });
  }

  override onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}
