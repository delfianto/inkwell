import { compileCurrent, compileSelection } from "./compile";
import {
  focusCurrentProject,
  previousScene,
  previousSceneAtIndent,
  nextScene,
  nextSceneAtIndent,
  jumpToProject,
  showInkwell,
  jumpToScene,
  revealProjectFolder,
  focusNewSceneField,
} from "./navigation";
import { indentScene, unindentScene } from "./indentation";
import type InkwellPlugin from "src/main";
import { insertMultiSceneTemplate, insertSingleSceneTemplate } from "./templates";

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
