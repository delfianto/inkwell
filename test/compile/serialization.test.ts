import { afterEach, describe, expect, it } from "vitest";

import { BUILTIN_STEPS } from "src/compile/steps";
import { PLACEHOLDER_MISSING_STEP } from "src/compile/steps/abstract-compile-step";
import { deserializeWorkflow, serializeWorkflow } from "src/compile/serialization";
import type { Workflow } from "src/compile/steps/abstract-compile-step";
import { userScriptSteps } from "src/model/stores";

const stepById = (id: string) => {
  const step = BUILTIN_STEPS.find((s) => s.id === id);
  if (!step) throw new Error(`builtin step ${id} missing`);
  return step;
};

const sampleWorkflow = (): Workflow => ({
  name: "Test Workflow",
  description: "A workflow used in tests.",
  steps: [
    { ...stepById("concatenate-text"), optionValues: { separator: "\n---\n" } },
    { ...stepById("strip-frontmatter"), optionValues: {} },
  ],
});

describe("serializeWorkflow", () => {
  it("emits id + optionValues per step plus name + description", () => {
    const w = sampleWorkflow();
    const s = serializeWorkflow(w);
    expect(s.name).toBe("Test Workflow");
    expect(s.description).toBe("A workflow used in tests.");
    expect(s.steps).toEqual([
      { id: "concatenate-text", optionValues: { separator: "\n---\n" } },
      { id: "strip-frontmatter", optionValues: {} },
    ]);
  });
});

describe("deserializeWorkflow", () => {
  afterEach(() => {
    userScriptSteps.set(null);
  });

  it("round-trips a workflow of built-in steps", () => {
    userScriptSteps.set([]);
    const original = sampleWorkflow();
    const restored = deserializeWorkflow(serializeWorkflow(original));

    expect(restored.name).toBe(original.name);
    expect(restored.description).toBe(original.description);
    expect(restored.steps.length).toBe(2);
    expect(restored.steps[0].description.canonicalID).toBe("concatenate-text");
    expect(restored.steps[0].optionValues).toEqual({ separator: "\n---\n" });
    expect(restored.steps[1].description.canonicalID).toBe("strip-frontmatter");
  });

  it("substitutes PLACEHOLDER_MISSING_STEP for unknown step IDs", () => {
    userScriptSteps.set([]);
    const restored = deserializeWorkflow({
      name: "broken",
      description: "",
      steps: [{ id: "does-not-exist", optionValues: {} }],
    });
    expect(restored.steps[0].description.canonicalID).toBe(
      PLACEHOLDER_MISSING_STEP.description.canonicalID,
    );
  });

  it("falls back to user scripts when no built-in matches", () => {
    // Fake a user-script-loaded step.
    const userStep = {
      ...stepById("concatenate-text"),
      id: "/path/to/my-script.js",
      description: {
        ...stepById("concatenate-text").description,
        canonicalID: "/path/to/my-script.js",
        name: "My User Step",
        isScript: true,
      },
    };
    userScriptSteps.set([userStep]);

    const restored = deserializeWorkflow({
      name: "uses-user-step",
      description: "",
      steps: [{ id: "/path/to/my-script.js", optionValues: { customFlag: true } }],
    });
    expect(restored.steps[0].description.canonicalID).toBe("/path/to/my-script.js");
    expect(restored.steps[0].optionValues).toEqual({ customFlag: true });
  });
});
