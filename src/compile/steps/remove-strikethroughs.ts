import {
  type CompileContext,
  type CompileInput,
  type CompileManuscriptInput,
  type CompileSceneInput,
} from "..";
import { CompileStepKind, makeBuiltinStep } from "./abstract-compile-step";

const STRIKETHROUGH_REGEX = /~~(?<struck>.*?)~~/gmu;

export const RemoveStrikethroughsStep = makeBuiltinStep({
  id: "remove-strikethroughs",
  description: {
    name: "Remove Strikethroughs",
    description: "Removes struck-through ~~text~~.",
    availableKinds: [CompileStepKind.Scene, CompileStepKind.Manuscript],
    options: [],
  },
  compile(input: CompileInput, context: CompileContext): CompileInput {
    if (context.kind === CompileStepKind.Scene) {
      return (input as CompileSceneInput[]).map((sceneInput) =>
        Object.assign(sceneInput, {
          contents: sceneInput.contents.replace(STRIKETHROUGH_REGEX, () => ""),
        }),
      );
    }
    return {
      ...(input as CompileManuscriptInput),
      contents: (input as CompileManuscriptInput).contents.replace(STRIKETHROUGH_REGEX, () => ""),
    };
  },
});
