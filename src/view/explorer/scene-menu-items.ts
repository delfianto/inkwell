import { projects, selectedProject } from "src/model/stores";
import { get } from "svelte/store";
import { type MultipleSceneProject } from "src/model/types";

const getSelectedProjectWithIndex = () => {
  const project = get(selectedProject) as MultipleSceneProject;
  if (!project) {
    return { index: -1, project };
  }
  const index = get(projects).findIndex((p) => p.vaultPath === project.vaultPath);
  return { index, project };
};

export const addScene = (fileName: string) => {
  const { index, project } = getSelectedProjectWithIndex();
  if (!project) return;
  if (index >= 0 && project.format === "scenes") {
    projects.update((ps) => {
      const target = ps[index] as MultipleSceneProject;
      (ps[index] as MultipleSceneProject).scenes = [
        ...target.scenes,
        { title: fileName, indent: 0 },
      ];
      (ps[index] as MultipleSceneProject).unknownFiles = target.unknownFiles.filter(
        (f) => f !== fileName,
      );
      return ps;
    });
  }
};

export const ignoreScene = (fileName: string) => {
  const { index, project } = getSelectedProjectWithIndex();
  if (!project) return;
  if (index >= 0 && project.format === "scenes") {
    projects.update((ps) => {
      const target = ps[index] as MultipleSceneProject;
      (ps[index] as MultipleSceneProject).scenes = target.scenes.filter(
        (it) => it.title !== fileName,
      );
      (ps[index] as MultipleSceneProject).ignoredFiles = [...(target.ignoredFiles ?? []), fileName];
      (ps[index] as MultipleSceneProject).unknownFiles = target.unknownFiles.filter(
        (f) => f !== fileName,
      );
      return ps;
    });
  }
};

export const addAll = () => {
  const { index, project } = getSelectedProjectWithIndex();
  if (!project) return;
  if (index >= 0 && project.format === "scenes") {
    projects.update((ps) => {
      const target = ps[index] as MultipleSceneProject;
      (ps[index] as MultipleSceneProject).scenes = [
        ...target.scenes,
        ...target.unknownFiles.map((f) => ({ title: f, indent: 0 })),
      ];
      (ps[index] as MultipleSceneProject).unknownFiles = [];
      return ps;
    });
  }
};

export const ignoreAll = () => {
  const { index, project } = getSelectedProjectWithIndex();
  if (!project) return;
  if (index >= 0 && project.format === "scenes") {
    projects.update((ps) => {
      const target = ps[index] as MultipleSceneProject;
      (ps[index] as MultipleSceneProject).ignoredFiles = [
        ...(target.ignoredFiles ?? []),
        ...target.unknownFiles,
      ];
      (ps[index] as MultipleSceneProject).unknownFiles = [];
      return ps;
    });
  }
};
