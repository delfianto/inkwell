import { type App, Modal, type TFile } from "obsidian";
import { codexCategoryPath, type CodexKind } from "src/model/codex";
import { createNote } from "src/model/note-create";

export class CreateCodexEntryModal extends Modal {
  constructor(
    app: App,
    private folder: string,
    private kind: CodexKind,
    private onCreated: (file: TFile) => void,
  ) {
    super(app);
  }

  override onOpen(): void {
    this.setTitle(`New ${this.kind}`);
    const form = this.contentEl.createEl("form", { cls: "inkwell-new-codex" });
    const label = form.createEl("label", { text: "Name" });
    const input = label.createEl("input", { type: "text", attr: { required: "" } });
    const error = form.createEl("div", { cls: "inkwell-story-error", attr: { role: "alert" } });
    const button = form.createEl("button", { text: "Create", type: "submit", cls: "mod-cta" });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (button.disabled) return;

      const name = input.value.trim();
      if (!name || name === "." || name === ".." || /[\\/:*?"<>|#^[\]]|%%/u.test(name)) {
        error.setText("Enter a name that can be used in an Obsidian note link.");
        return;
      }
      const path = `${codexCategoryPath(this.folder, this.kind)}/${name}.md`;
      if (this.app.vault.getAbstractFileByPath(path)) {
        error.setText("A note with that name already exists.");
        return;
      }

      button.disabled = true;
      error.empty();
      const template =
        this.kind === "character"
          ? "## Role in the story\n\n## Notes\n"
          : "## What it’s like\n\n## Notes\n";
      const file = await createNote(this.app, path, template);
      if (file) {
        this.close();
        this.onCreated(file);
      } else {
        error.setText("Could not create the note. Check the folder and try again.");
        button.disabled = false;
      }
    });
    input.focus();
  }

  override onClose(): void {
    this.contentEl.empty();
  }
}
