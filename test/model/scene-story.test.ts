import { type App, TFile } from "obsidian";
import { describe, expect, it } from "vite-plus/test";
import {
  readSceneStory,
  readSceneSummary,
  saveSceneStory,
  sceneReferencePaths,
  sortStoryScenes,
} from "src/model/scene-story";

function appForProperties(properties: Record<string, unknown>): App {
  return {
    fileManager: {
      processFrontMatter(_file: TFile, update: (data: Record<string, unknown>) => void) {
        update(properties);
        return Promise.resolve();
      },
    },
  } as unknown as App;
}

describe("scene details", () => {
  it("saves only changed story fields and preserves existing properties", async () => {
    const properties = {
      characters: "[[Mara]]",
      status: "draft",
      storyWhen: "Dusk",
      storyOrder: 10,
    };
    const original = readSceneStory(properties);
    properties.status = "revising";
    properties.storyWhen = "Night";

    await saveSceneStory(appForProperties(properties), new TFile(), original, {
      ...original,
      storyOrder: 5,
    });

    expect(properties).toEqual({
      characters: "[[Mara]]",
      status: "revising",
      storyWhen: "Night",
      storyOrder: 5,
    });
  });

  it("rejects a conflicting edit before saving any of its changes", async () => {
    const properties = { storyOrder: 10 };
    const original = readSceneStory(properties);
    properties.storyOrder = 20;

    await expect(
      saveSceneStory(appForProperties(properties), new TFile(), original, {
        ...original,
        storyOrder: 30,
        storyWhen: "Dusk",
      }),
    ).rejects.toThrow("These scene details changed elsewhere");
    expect(properties).toEqual({ storyOrder: 20 });
  });

  it("normalizes edited chapter properties while preserving the types of untouched fields", async () => {
    const properties: Record<string, unknown> = {
      mood: "Quiet",
      tags: "#Chapter/WAFF-K01, book",
      version: 1,
      prev: "[[Opening]]",
      custom: { continuity: "keep" },
    };
    const original = readSceneStory(properties);
    expect(original.mood).toEqual(["Quiet"]);
    expect(original.tags).toEqual(["Chapter/WAFF-K01", "book"]);
    expect(original.version).toBe("1");

    await saveSceneStory(appForProperties(properties), new TFile(), original, {
      ...original,
      mood: ["Quiet", "Warm"],
      tags: ["Chapter/WAFF-K01"],
    });
    expect(properties).toEqual({
      mood: ["Quiet", "Warm"],
      tags: ["Chapter/WAFF-K01"],
      version: 1,
      prev: "[[Opening]]",
      custom: { continuity: "keep" },
    });
  });

  it("rejects conflicting chapter property edits without overwriting other fields", async () => {
    const properties = { version: "1.0.1", tags: ["Chapter"] };
    const original = readSceneStory(properties);
    properties.version = "1.0.2";

    await expect(
      saveSceneStory(appForProperties(properties), new TFile(), original, {
        ...original,
        version: "1.0.3",
        tags: ["Chapter/WAFF-K01"],
      }),
    ).rejects.toThrow("These scene details changed elsewhere");
    expect(properties).toEqual({ version: "1.0.2", tags: ["Chapter"] });
  });

  it("counts one appearance per resolved file, even when the POV is in the cast", () => {
    const app = {
      metadataCache: {
        getFirstLinkpathDest: (target: string) => ({ path: `${target}.md` }),
      },
    } as unknown as App;
    const first = "Codex/Characters/Mara";
    const second = "Codex/Characters/Other/Mara";
    const story = readSceneStory({
      pov: `[[${first}|Mara]]`,
      characters: [`[[${first}]]`, `[[${second}]]`],
    });
    expect([...sceneReferencePaths(app, "Novel/Opening.md", story)]).toEqual([
      `${first}.md`,
      `${second}.md`,
    ]);
  });

  it("keeps a linked legacy POV when adding a narration style", async () => {
    const properties: Record<string, unknown> = { pov: "[[Mara]]", location: "[[Harbour]]" };
    const original = readSceneStory(properties);
    expect(original.pov).toBeUndefined();
    expect(original.povCharacter).toBe("[[Mara]]");
    expect(original.locations).toEqual(["[[Harbour]]"]);

    await saveSceneStory(appForProperties(properties), new TFile(), original, {
      ...original,
      pov: "3rd Person (Limited)",
    });
    expect(properties).toEqual({
      pov: "3rd Person (Limited)",
      povCharacter: "[[Mara]]",
      location: "[[Harbour]]",
    });
  });

  it("replaces a legacy location with a list and lets the writer clear every location", async () => {
    const properties: Record<string, unknown> = { location: "[[Munich]]" };
    const original = readSceneStory(properties);
    await saveSceneStory(appForProperties(properties), new TFile(), original, {
      ...original,
      locations: ["[[Munich]]", "[[Bamberg]]"],
    });
    expect(properties).toEqual({ locations: ["[[Munich]]", "[[Bamberg]]"] });

    const linked = readSceneStory(properties);
    await saveSceneStory(appForProperties(properties), new TFile(), linked, {
      ...linked,
      locations: [],
    });
    expect(readSceneStory(properties).locations).toEqual([]);
  });

  it("derives the weekday when setting a start and rejects a finish before it", async () => {
    const properties: Record<string, unknown> = {};
    const start = "2025-12-18T08:00:00";
    const original = readSceneStory(properties);
    await expect(
      saveSceneStory(appForProperties(properties), new TFile(), original, {
        ...original,
        start,
        finish: "2025-12-18T07:30:00",
      }),
    ).rejects.toThrow("Finish must be at or after the start.");
    expect(properties).toEqual({});

    await saveSceneStory(appForProperties(properties), new TFile(), original, {
      ...original,
      start,
      finish: "2025-12-18T11:30:00",
    });
    expect(properties).toEqual({ start, finish: "2025-12-18T11:30:00", day: "Thursday" });
  });

  it("reads a chapter summary before falling back to an older synopsis", () => {
    expect(readSceneSummary({ summary: "Train journey", synopsis: "Old draft" })).toBe(
      "Train journey",
    );
    expect(readSceneSummary({ summary: "", synopsis: "Old draft" })).toBe("Old draft");
  });
});

describe("story order", () => {
  it("keeps ties and unplaced scenes in manuscript order without mutating the input", () => {
    const scenes = [
      { title: "First", story: readSceneStory({ storyOrder: 3 }) },
      { title: "Unplaced", story: readSceneStory() },
      { title: "Earlier", story: readSceneStory({ storyOrder: -2 }) },
      { title: "Same time", story: readSceneStory({ storyOrder: 3 }) },
      { title: "Invalid order", story: readSceneStory({ storyOrder: Number.NaN }) },
    ];
    const { placed, unplaced } = sortStoryScenes(scenes);
    expect(placed.map(({ title }) => title)).toEqual(["Earlier", "First", "Same time"]);
    expect(unplaced.map(({ title }) => title)).toEqual(["Unplaced", "Invalid order"]);
    expect(scenes.map(({ title }) => title)).toEqual([
      "First",
      "Unplaced",
      "Earlier",
      "Same time",
      "Invalid order",
    ]);
  });

  it("sorts calendar scenes by their start across timestamp formats", () => {
    const scenes = [
      { title: "Later", story: readSceneStory({ start: "2025-12-18T11:30:00", storyOrder: 1 }) },
      {
        title: "Invalid date",
        story: readSceneStory({ start: "2025-02-30T08:00:00", storyOrder: 2 }),
      },
      { title: "Earlier", story: readSceneStory({ start: "2025-12-18 08:00:00", storyOrder: 3 }) },
      { title: "Same time", story: readSceneStory({ start: "2025-12-18T08:00" }) },
    ];
    const { placed, unplaced } = sortStoryScenes(scenes, "calendar");
    expect(placed.map(({ title }) => title)).toEqual(["Earlier", "Same time", "Later"]);
    expect(unplaced.map(({ title }) => title)).toEqual(["Invalid date"]);
  });
});
