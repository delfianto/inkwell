import {
  type CompileContext,
  CompileStepKind,
  CompileStepOptionType,
  makeBuiltinStep,
} from "./abstract-compile-step";
import { type CompileInput, type CompileSceneInput } from "..";
import { formatSceneNumber } from "src/model/project-utils";

export const PrependTitleStep = makeBuiltinStep({
  id: "prepend-title",
  description: {
    name: "Prepend Title",
    description: "Prepends the scene title to the scene text.",
    availableKinds: [CompileStepKind.Scene],
    options: [
      {
        id: "format",
        name: "Title Format",
        description:
          "Format of title. $1 will be replaced with title. $2, if present, will be replaced with scene number. Wrapping text in $3{} will repeat that text a number of times equal to the scene’s indentation level plus one—e.g., $3{#} for unindented scenes becomes “#”.",
        type: CompileStepOptionType.Text,
        default: "$1",
      },
      {
        id: "separator",
        name: "Separator",
        description: "Text to put between title and scene text.",
        type: CompileStepOptionType.Text,
        default: "\n\n",
      },
    ],
  },
  compile(input: CompileInput, context: CompileContext): CompileInput {
    const sceneInputs = input as CompileSceneInput[];
    const format = context.optionValues["format"] as string;
    const separator = context.optionValues["separator"] as string;

    return sceneInputs.map((sceneInput) => {
      let title = format;
      const regex = /\$3\{(?<torepeat>.*)\}/u;
      const match = format.match(regex);
      if (match) {
        const toRepeat = match.groups?.["torepeat"] ?? "";
        title = title.replace(regex, toRepeat.repeat((sceneInput.indentationLevel ?? -1) + 1));
      }
      title = title.replace("$1", sceneInput.name);
      if (sceneInput.numbering) {
        const formatted = formatSceneNumber(sceneInput.numbering);
        title = title.replace("$2", formatted);
      }

      const contents = `${title}${separator}${sceneInput.contents}`;
      return Object.assign(sceneInput, { contents });
    });
  },
});
