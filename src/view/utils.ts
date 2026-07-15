import { type App, type Modal, Platform, type View } from "obsidian";
import { getContext } from "svelte";

export function selectElementContents(el: HTMLElement) {
  const range = document.createRange();
  range.selectNodeContents(el);
  const sel = globalThis.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

export function invalidFilenameCharacters(): string {
  if (Platform.isWin) {
    return String.raw`* " \ / : < > | ?`;
  }
  return String.raw`\ / :`;
}

export function isValidFilename(name: string): boolean {
  return !invalidFilenameCharacters()
    .split(" ")
    .some((c) => name.contains(c));
}

export function appContext(view: View | Modal): Map<string, any> {
  return new Map<string, any>([["app", view.app]]);
}

export function useApp(): App {
  return getContext("app") as App;
}
