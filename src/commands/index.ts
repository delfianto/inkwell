import { compileCurrent, compileSelection } from "./compile";
import {
  focusCurrentProject,
  focusNewSceneField,
  jumpToProject,
  jumpToScene,
  nextScene,
  nextSceneAtIndent,
  previousScene,
  previousSceneAtIndent,
  revealProjectFolder,
  showInkwell,
} from "./navigation";
import { indentScene, unindentScene } from "./indentation";
import { insertMultiSceneTemplate, insertSingleSceneTemplate } from "./templates";
import type InkwellPlugin from "src/main";

const commandBuilders = [
  compileCurrent,
  compileSelection,
  focusCurrentProject,
  previousScene,
  previousSceneAtIndent,
  nextScene,
  nextSceneAtIndent,
  indentScene,
  unindentScene,
  jumpToProject,
  jumpToScene,
  showInkwell,
  revealProjectFolder,
  focusNewSceneField,
  insertMultiSceneTemplate,
  insertSingleSceneTemplate,
];

export function addCommands(plugin: InkwellPlugin) {
  commandBuilders.forEach((c) => {
    plugin.addCommand(c(plugin));
  });
}
