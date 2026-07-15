import { type App, FuzzySuggestModal, type Instruction, Keymap, type PaneType } from "obsidian";

declare module "obsidian" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- cannot declare otherwise
  interface FuzzySuggestModal<T> {
    chooser?: {
      useSelectedItem: (evt: KeyboardEvent) => boolean;
      moveDown: (count: number) => void;
      moveUp: (count: number) => void;
    };
  }
}

export class JumpModal<T> extends FuzzySuggestModal<string> {
  items: Map<string, T>;
  onSelect: (value: T, modEvent: boolean | PaneType) => void;

  constructor(
    app: App,
    items: Map<string, T>,
    instructions: Instruction[],
    onSelect: (value: T, modEvent: boolean | PaneType) => void,
  ) {
    super(app);

    this.items = items;
    this.onSelect = onSelect;

    this.scope.register(["Meta"], "Enter", (evt) => {
      const result = this.containerEl.querySelectorAll(".suggestion-item.is-selected");
      if (result.length > 0) {
        const selected = result[0].innerHTML;
        this.onChooseItem(selected, evt);
      }
      this.close();
      return false;
    });

    // navigate up/down with Tab and Shift+Tab
    this.scope.register([], "Tab", (): void => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    });
    this.scope.register(["Shift"], "Tab", (): void => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }));
    });

    this.setInstructions(instructions);
  }

  getItems(): string[] {
    return [...this.items.keys()];
  }

  getItemText(item: string): string {
    return item;
  }

  onChooseItem(item: string, evt: MouseEvent | KeyboardEvent): void {
    const value = this.items.get(item);
    if (value === undefined) return;
    this.onSelect(value, Keymap.isModEvent(evt));
  }
}
