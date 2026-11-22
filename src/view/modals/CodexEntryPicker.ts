import { type App, FuzzySuggestModal } from "obsidian";
import { type CodexEntry } from "src/model/codex";

export class CodexEntryPicker extends FuzzySuggestModal<CodexEntry> {
  constructor(
    app: App,
    private entries: CodexEntry[],
    private onSelect: (entry: CodexEntry) => void,
  ) {
    super(app);
    this.setPlaceholder("Search the Codex…");
  }

  getItems(): CodexEntry[] {
    return this.entries;
  }

  getItemText(entry: CodexEntry): string {
    return [entry.title, ...entry.aliases, entry.path].join(" · ");
  }

  onChooseItem(entry: CodexEntry): void {
    this.onSelect(entry);
  }
}
