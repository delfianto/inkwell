import { type App, type FuzzyMatch, FuzzySuggestModal, renderMatches } from "obsidian";
import { type CodexEntry } from "src/model/codex";

const SEPARATOR = " · ";

export class CodexEntryPicker extends FuzzySuggestModal<CodexEntry> {
  constructor(
    app: App,
    private entries: CodexEntry[],
    private onSelect: (entry: CodexEntry) => void,
    placeholder = "Search the Codex…",
  ) {
    super(app);
    this.setPlaceholder(placeholder);
  }

  getItems(): CodexEntry[] {
    return this.entries;
  }

  getItemText(entry: CodexEntry): string {
    return [entry.title, ...entry.aliases, entry.path].join(SEPARATOR);
  }

  override renderSuggestion({ item, match }: FuzzyMatch<CodexEntry>, el: HTMLElement): void {
    el.addClass("mod-complex");
    const content = el.createDiv("suggestion-content");
    const detailStart = item.title.length + SEPARATOR.length;
    renderMatches(content.createDiv("suggestion-title"), item.title, match.matches);
    renderMatches(
      content.createDiv("suggestion-note"),
      this.getItemText(item).slice(detailStart),
      match.matches,
      -detailStart,
    );
  }

  onChooseItem(entry: CodexEntry): void {
    this.onSelect(entry);
  }
}
