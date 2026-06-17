import {
  CompileStepKind,
  CompileStepOptionType,
  makeBuiltinStep,
  type CompileContext,
  type CompileInput,
  type CompileManuscriptInput,
} from "./abstract-compile-step";

export const AddFrontmatterStep = makeBuiltinStep({
  id: "add-frontmatter",
  description: {
    name: "Add Frontmatter",
    description: "Add YAML frontmatter to your manuscript",
    availableKinds: [CompileStepKind.Manuscript],
    options: [
      {
        id: "frontmatter",
        name: "Frontmatter",
        description: "YAML to be added to your manuscript's frontmatter.",
        type: CompileStepOptionType.MultilineText,
        default: "",
      },
    ],
  },
  compile(input: CompileInput, context: CompileContext): CompileInput {
    const msInput = input as CompileManuscriptInput;
    if (context.kind !== CompileStepKind.Manuscript) {
      throw new Error("Cannot add frontmatter to non-manuscript.");
    }

    const contents = [
      "---",
      context.optionValues["frontmatter"] as string,
      "---",
      msInput.contents,
    ].join("\n");

    return { contents };
  },
});
