import { type App, FuzzySuggestModal, TFolder } from "obsidian";

export class ProjectFolderPicker extends FuzzySuggestModal<TFolder> {
  constructor(
    app: App,
    private onSelect: (folder: TFolder) => void,
  ) {
    super(app);
    this.setPlaceholder("Choose a vault folder…");
  }

  getItems(): TFolder[] {
    return this.app.vault
      .getAllLoadedFiles()
      .filter((file): file is TFolder => file instanceof TFolder)
      .toSorted((a, b) => a.path.localeCompare(b.path));
  }

  getItemText(folder: TFolder): string {
    return folder.isRoot() ? "/ (Vault root)" : folder.path;
  }

  onChooseItem(folder: TFolder): void {
    this.onSelect(folder);
  }
}
