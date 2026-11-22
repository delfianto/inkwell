import {
  type App,
  getFrontMatterInfo,
  MarkdownView,
  parseYaml,
  stringifyYaml,
  type TFile,
} from "obsidian";
import { applyLoreEdits, type LoreRange, readCodexLore } from "./codex-lore";
import { type CodexPropertyLayout } from "./codex-properties";

export type { LoreRange } from "./codex-lore";

interface InfoboxEditorLayout {
  getEditorLayout: (
    properties: Record<string, unknown>,
    blockSource?: string,
  ) => Promise<CodexPropertyLayout>;
}

export interface CodexNote {
  source: string;
  bodyStart: number;
  hasFrontmatter: boolean;
  newline: string;
  properties: Record<string, unknown>;
  lore: ReturnType<typeof readCodexLore>;
  layout?: CodexPropertyLayout;
}

export async function readCodexNote(app: App, file: TFile): Promise<CodexNote> {
  if (typeof getFrontMatterInfo !== "function") {
    throw new TypeError("The Codex editor requires Obsidian 1.5.7 or later.");
  }
  const source = await app.vault.read(file);
  const info = getFrontMatterInfo(source);
  const raw: unknown = info.exists ? parseYaml(info.frontmatter) : null;
  if (raw !== null && raw !== undefined && (typeof raw !== "object" || Array.isArray(raw))) {
    throw new Error("The note's frontmatter must contain named properties.");
  }
  const properties: Record<string, unknown> = { ...raw };
  const bodyStart = info.exists ? info.contentStart : Number(source.startsWith("\uFEFF"));
  const lore = readCodexLore(source, bodyStart, app.metadataCache.getFileCache(file)?.headings);
  const plugin = app.plugins.getPlugin("advanced-infobox") as Partial<InfoboxEditorLayout> | null;
  let layout: CodexPropertyLayout | undefined;
  if (typeof plugin?.getEditorLayout === "function") {
    try {
      layout = await plugin.getEditorLayout(properties, lore.infoboxOptions);
    } catch (error) {
      console.warn("[Inkwell] Could not load the Advanced Infobox layout", error);
    }
  }
  return {
    source,
    bodyStart,
    hasFrontmatter: info.exists,
    newline: source.includes("\r\n") ? "\r\n" : "\n",
    properties,
    lore,
    layout,
  };
}

export async function saveCodexNote(
  app: App,
  file: TFile,
  note: CodexNote,
  properties: ReadonlyMap<string, unknown>,
  lore: ReadonlyMap<LoreRange, string>,
): Promise<void> {
  if (app.vault.getAbstractFileByPath(file.path) !== file) {
    throw new Error("This Codex note is no longer available.");
  }
  const conflict =
    "This note changed elsewhere. Copy your edits before reopening the Codex editor.";
  const edited = applyLoreEdits(note.source, lore, note.newline);
  let contents = edited;
  if (properties.size > 0) {
    const values = Object.fromEntries([...Object.entries(note.properties), ...properties]);
    const { newline } = note;
    const yaml = stringifyYaml(values).replaceAll("\n", newline);
    const endOfYaml = yaml.endsWith(newline) ? "" : newline;
    const bom = note.source.startsWith("\uFEFF") ? "\uFEFF" : "";
    const body = edited.slice(note.bodyStart);
    const separator = body && !note.hasFrontmatter ? newline : "";
    contents = `${bom}---${newline}${yaml}${endOfYaml}---${newline}${separator}${body}`;
  }
  await app.vault.process(file, (current) => {
    if (current !== note.source) throw new Error(conflict);
    const editorChanged = app.workspace
      .getLeavesOfType("markdown")
      .some(
        ({ view }) =>
          view instanceof MarkdownView &&
          view.file === file &&
          view.getMode() === "source" &&
          view.editor.getValue().replaceAll("\r\n", "\n") !== current.replaceAll("\r\n", "\n"),
      );
    if (editorChanged) throw new Error(conflict);
    return contents;
  });
}
