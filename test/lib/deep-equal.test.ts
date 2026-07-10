import { describe, expect, it } from "vitest";

import { deepEqual } from "src/lib/deep-equal";

describe("deepEqual", () => {
  it("compares primitives", () => {
    expect(deepEqual(1, 1)).toBe(true);
    expect(deepEqual("a", "a")).toBe(true);
    expect(deepEqual(true, true)).toBe(true);
    expect(deepEqual(1, 2)).toBe(false);
    expect(deepEqual("a", "b")).toBe(false);
    expect(deepEqual(1, "1")).toBe(false);
  });

  it("treats NaN as equal to itself (matching lodash isEqual)", () => {
    expect(deepEqual(NaN, NaN)).toBe(true);
  });

  it("handles null and undefined", () => {
    expect(deepEqual(null, null)).toBe(true);
    expect(deepEqual(undefined, undefined)).toBe(true);
    expect(deepEqual(null, undefined)).toBe(false);
    expect(deepEqual(null, {})).toBe(false);
  });

  it("compares arrays element-wise", () => {
    expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
    expect(deepEqual([1, 2, 3], [1, 3, 2])).toBe(false);
    expect(deepEqual([], [])).toBe(true);
  });

  it("does not treat arrays and objects as equal", () => {
    expect(deepEqual([], {})).toBe(false);
    expect(deepEqual({ 0: "a", length: 1 }, ["a"])).toBe(false);
  });

  it("compares nested objects structurally", () => {
    const a = { title: "Novel", scenes: [{ title: "Ch 1", indent: 0 }], ebook: { author: "X" } };
    const b = { title: "Novel", scenes: [{ title: "Ch 1", indent: 0 }], ebook: { author: "X" } };
    expect(deepEqual(a, b)).toBe(true);
  });

  it("detects nested differences", () => {
    const a = { title: "Novel", scenes: [{ title: "Ch 1", indent: 0 }] };
    const b = { title: "Novel", scenes: [{ title: "Ch 1", indent: 1 }] };
    expect(deepEqual(a, b)).toBe(false);
  });

  it("detects differing key sets", () => {
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(deepEqual({ a: undefined }, {})).toBe(false);
  });

  it("returns true for a structuredClone round-trip (the sync-loop pairing)", () => {
    const project = {
      title: "Novel",
      scenes: [
        { title: "Ch 1", indent: 0 },
        { title: "Ch 2", indent: 1 },
      ],
      ebook: { author: "X", subjects: ["fiction"] },
    };
    expect(deepEqual(project, structuredClone(project))).toBe(true);
  });
});
