import { type App, parseYaml, stringifyYaml, TFile } from "obsidian";
import { createNote } from "./note-create";

export const TEMPLATES_FOLDER = "Templates";
export const CHAPTER_TEMPLATE_PATH = `${TEMPLATES_FOLDER}/Inkwell Chapter.md`;

const CHAPTER_TEMPLATE = `---
arc:
chapter:
title:
subtitle:
day:
start:
finish:
pov: "3rd Person (Limited)"
povCharacter:
characters: []
locations: []
mood: []
status: draft
version:
updated:
context:
summary:
tags: []
---

`;

export async function prepareChapterTemplate(app: App): Promise<string> {
  const path = CHAPTER_TEMPLATE_PATH;
  const existing = app.vault.getAbstractFileByPath(path);
  if (existing instanceof TFile) return path;
  if (existing || !(await createNote(app, path, CHAPTER_TEMPLATE))) {
    throw new Error("Could not create the Chapter template.");
  }
  return path;
}

export async function createChapterNote(
  app: App,
  path: string,
  template: string,
  title: string,
): Promise<TFile | null> {
  const source = await app.vault.adapter.read(template);
  const opening = /^\uFEFF?---[ \t]*\r?\n/u.exec(source);
  const contents = opening ? source.slice(opening[0].length) : source;
  const closing = /^---[ \t]*(?:\r?\n|$)/mu.exec(contents);
  if (!opening || !closing) {
    throw new Error("The Chapter template must start with a complete YAML block.");
  }

  const parsed: unknown = parseYaml(contents.slice(0, closing.index));
  if (
    parsed !== null &&
    parsed !== undefined &&
    (typeof parsed !== "object" || Array.isArray(parsed))
  ) {
    throw new Error("The Chapter template needs a set of YAML properties.");
  }

  const properties: Record<string, unknown> = { ...parsed, title };
  if (Object.hasOwn(properties, "updated")) {
    properties.updated = globalThis.moment().format("YYYY-MM-DDTHH:mm:ss");
  }
  const body = contents.slice(closing.index + closing[0].length);
  const yaml = stringifyYaml(properties).trimEnd();
  return createNote(app, path, `---\n${yaml}\n---\n${body}`);
}
