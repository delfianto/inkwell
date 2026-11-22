import { applyLoreEdits, readCodexLore } from "src/model/codex-lore";
import { describe, expect, it } from "vite-plus/test";
import { editedProperty, groupCodexProperties } from "src/model/codex-properties";
import { type HeadingCache } from "obsidian";

function heading(source: string, label: string, level = 2): HeadingCache {
  const text = `${"#".repeat(level)} ${label}`;
  const start = source.indexOf(text);
  return {
    heading: label,
    level,
    position: {
      start: { offset: start, line: 0, col: 0 },
      end: { offset: start + text.length, line: 0, col: text.length },
    },
  };
}

describe("Codex editor", () => {
  it("groups dynamic keys using the Infobox labels and leaves other properties visible", () => {
    const groups = groupCodexProperties(
      {
        armor_class: 20,
        magic: false,
        friends: ["[[Lore|Name]]", 2, false],
        extra: { key: "value" },
      },
      {
        labels: { armor_class: "AC" },
        sections: [{ label: "Combat", keys: ["Magic", "armor_class"] }],
      },
    );
    expect(groups.map(({ label, fields }) => [label, fields.map((field) => field.label)])).toEqual([
      ["Combat", ["Magic", "AC"]],
      ["Other properties", ["Friends", "Extra"]],
    ]);
    const [friends, extra] = groups[1].fields;
    expect(friends.initial && editedProperty(friends.initial, friends.label)).toEqual([
      "[[Lore|Name]]",
      2,
      false,
    ]);
    expect(extra.structured).toBe(true);
  });

  it("keeps numbers and date controls typed without coercing text", () => {
    expect(editedProperty({ type: "text", value: "+2" }, "Bonus")).toBe("+2");
    expect(editedProperty({ type: "date", value: "2024-02-29" }, "Born")).toBe("2024-02-29");
    expect(() => editedProperty({ type: "date", value: "2025-02-29" }, "Born")).toThrow("Born");
    expect(() => editedProperty({ type: "number", value: "two" }, "AC")).toThrow("AC");
  });

  it("edits prose on both sides of an infobox and fills a blank section", () => {
    const prefix = "---\r\nname: Test\r\n---\r\n";
    const block = "```infobox\r\ntemplate: character\r\n```\r\n";
    const source = `${prefix}## Intro\r\n\r\nBefore\r\n\r\n${block}\r\nAfter\r\n\r\n## Notes\r\n\r\n## Later\r\n\r\nUntouched\r\n`;
    const { sections, infoboxOptions } = readCodexLore(
      source,
      prefix.length,
      ["Intro", "Notes", "Later"].map((label) => heading(source, label)),
    );
    expect(sections.map((section) => section.label)).toEqual(["Intro", "Notes", "Later"]);
    expect(infoboxOptions).toBe("template: character\r\n");
    expect(sections[0].parts.map((part) => part.text)).toEqual(["Before", "After"]);
    const edits = new Map([
      [sections[0].parts[0], "First\nline"],
      [sections[0].parts[1], "Last"],
      [sections[1].parts[0], "Filled"],
    ]);
    expect(applyLoreEdits(source, edits, "\r\n")).toBe(
      `${prefix}## Intro\r\n\r\nFirst\r\nline\r\n\r\n${block}\r\nLast\r\n\r\n## Notes\r\nFilled\r\n\r\n\r\n## Later\r\n\r\nUntouched\r\n`,
    );
  });

  it("ignores pseudo-infoboxes inside other fences and protects an incomplete infobox", () => {
    const example = "````markdown\n```infobox\n```\n````";
    const infobox = "~~~infobox\ntemplate: person";
    const source = `${example}\n\n${infobox}`;
    const { sections, infoboxOptions } = readCodexLore(source, 0);
    expect(infoboxOptions).toBe("template: person");
    expect(sections[0].parts[0].text).toBe(example);
    expect(applyLoreEdits(source, new Map([[sections[0].parts[0], "Intro"]]), "\n")).toBe(
      `Intro\n\n${infobox}`,
    );
    const [blank] = readCodexLore(infobox, 0).sections[0].parts;
    expect(applyLoreEdits(infobox, new Map([[blank, "Intro"]]), "\n")).toBe(`Intro\n\n${infobox}`);
  });

  it("keeps parent introductions separate from their nested sections", () => {
    const source =
      "## Biography\n### Childhood\nA quiet childhood.\n##### Home\nA small town.\n### Career\n## Notes\n";
    const { sections } = readCodexLore(source, 0, [
      heading(source, "Biography"),
      heading(source, "Childhood", 3),
      heading(source, "Home", 5),
      heading(source, "Career", 3),
      heading(source, "Notes"),
    ]);

    expect(sections.map(({ path, children }) => [path, children])).toEqual([
      ["Biography", [1, 3]],
      ["Biography › Childhood", [2]],
      ["Biography › Childhood › Home", []],
      ["Biography › Career", []],
      ["Notes", []],
    ]);
    const [introduction] = sections[0].parts;
    const [childhood] = sections[1].parts;
    expect(introduction.text).toBe("");
    expect(childhood.text).toBe("A quiet childhood.");
    const edits = new Map([
      [introduction, "An introduction."],
      [childhood, "A busy childhood."],
    ]);
    expect(applyLoreEdits(source, edits, "\n")).toBe(
      "## Biography\nAn introduction.\n\n### Childhood\nA busy childhood.\n##### Home\nA small town.\n### Career\n## Notes\n",
    );
  });
});
