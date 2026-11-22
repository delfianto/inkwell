import { type HeadingCache } from "obsidian";

export interface LoreRange {
  start: number;
  end: number;
  text: string;
}

export interface LoreSection {
  label: string;
  level: number;
  path: string;
  children: number[];
  parts: LoreRange[];
}

interface InfoboxBlock {
  start: number;
  end: number;
  options: string;
  closed: boolean;
}

function findInfoboxBlocks(source: string, start: number): InfoboxBlock[] {
  const blocks: InfoboxBlock[] = [];
  let offset = start;
  let fence: { marker: string; start: number; body: number; infobox: boolean } | undefined;

  for (const match of source.slice(start).matchAll(/[^\n]*\n|[^\n]+$/gu)) {
    const [line] = match;
    const next = offset + line.length;
    const opening = /^ {0,3}(?<marker>`{3,}|~{3,})(?<info>[^\r\n]*)/u.exec(line);
    if (opening) {
      const [, marker, info] = opening;
      if (!fence && (marker[0] !== "`" || !info.includes("`"))) {
        fence = {
          marker,
          start: offset,
          body: next,
          infobox: /^infobox(?:\s|$)/u.test(info.trim()),
        };
      } else if (
        fence &&
        marker[0] === fence.marker[0] &&
        marker.length >= fence.marker.length &&
        !info.trim()
      ) {
        if (fence.infobox) {
          blocks.push({
            start: fence.start,
            end: next,
            options: source.slice(fence.body, offset),
            closed: true,
          });
        }
        fence = undefined;
      }
    }
    offset = next;
  }

  if (fence?.infobox) {
    blocks.push({
      start: fence.start,
      end: source.length,
      options: source.slice(fence.body),
      closed: false,
    });
  }
  return blocks;
}

function range(source: string, start: number, end: number): LoreRange {
  const text = source.slice(start, end);
  const leading = /^(?:[ \t]*\r?\n)*/u.exec(text)?.[0].length ?? 0;
  const newline = text.indexOf("\n", text.trimEnd().length);
  const trailing = newline === -1 ? text.length : newline - (text[newline - 1] === "\r" ? 1 : 0);
  const from = start + leading;
  const to = Math.max(from, start + trailing);
  return { start: from, end: to, text: source.slice(from, to).replaceAll("\r\n", "\n") };
}

interface LoreHeading {
  start: number;
  end: number;
  label: string;
  level: number;
}

function cachedHeadings(
  source: string,
  start: number,
  headings: readonly HeadingCache[],
): LoreHeading[] {
  return headings.flatMap(({ heading, level, position }) => {
    const from = position.start.offset;
    const to = position.end.offset;
    if (from < start || to <= from || to > source.length) return [];
    const line = source.slice(from, to);
    const atx = /^ {0,3}#{1,6}[ \t]+(?<label>[^\r\n]+)\r?\n?$/u.exec(line);
    const setext = /^(?<label>[^\r\n]+)\r?\n {0,3}(?:=+|-+)[ \t]*\r?\n?$/u.exec(line);
    // Positions from an out-of-date cache must not strand part of a heading in the editor.
    const label = atx?.[1].trim().replace(/[ \t]+#+$/u, "") ?? setext?.[1].trim();
    if (label !== heading) return [];
    const lineEnd = source.indexOf("\n", to - 1);
    return [
      { start: from, end: lineEnd === -1 ? source.length : lineEnd + 1, label: heading, level },
    ];
  });
}

function newSection(label: string, level: number): LoreSection {
  return { label, level, path: label, children: [], parts: [] };
}

export function readCodexLore(
  source: string,
  start: number,
  headings: readonly HeadingCache[] = [],
): { sections: LoreSection[]; infoboxOptions?: string } {
  const infoboxes = findInfoboxBlocks(source, start);
  const markers = [...cachedHeadings(source, start, headings), ...infoboxes].toSorted(
    (left, right) => left.start - right.start,
  );
  const sections: LoreSection[] = [];
  const ancestors: LoreSection[] = [];
  let cursor = start;
  let section = newSection("Overview", 0);

  function append(end: number) {
    const part = range(source, cursor, end);
    if (part.text.trim()) section.parts.push(part);
  }

  function finish() {
    if (section.level === 0 && section.parts.length === 0) return;
    if (section.parts.length === 0) section.parts.push(range(source, cursor, cursor));
    if (section.level > 0) {
      while ((ancestors.at(-1)?.level ?? 0) >= section.level) ancestors.pop();
      const parent = ancestors.at(-1);
      if (parent) {
        parent.children.push(sections.length);
        section.path = `${parent.path} › ${section.label}`;
      }
      ancestors.push(section);
    }
    sections.push(section);
  }

  for (const marker of markers) {
    if (marker.start < cursor) continue;
    append(marker.start);
    if ("label" in marker) {
      finish();
      section = newSection(marker.label, marker.level);
    }
    cursor = marker.end;
  }
  const last = infoboxes.at(-1);
  if (!last || last.closed) append(source.length);
  else cursor = last.start;
  finish();
  if (sections.length === 0) {
    sections.push({ ...section, parts: [range(source, cursor, cursor)] });
  }
  return { sections, infoboxOptions: infoboxes[0]?.options };
}

export function applyLoreEdits(
  source: string,
  edits: ReadonlyMap<LoreRange, string>,
  newline: string,
): string {
  if (edits.size === 0) return source;
  const chunks: string[] = [];
  let cursor = 0;
  for (const [part, text] of [...edits].toSorted(([a], [b]) => a.start - b.start)) {
    const empty = part.start === part.end;
    const prefix =
      empty && text && part.start > 0 && source[part.start - 1] !== "\n" ? newline : "";
    const suffix = empty && text && part.end < source.length ? newline + newline : "";
    chunks.push(source.slice(cursor, part.start), prefix, text.replaceAll("\n", newline), suffix);
    cursor = part.end;
  }
  chunks.push(source.slice(cursor));
  return chunks.join("");
}
