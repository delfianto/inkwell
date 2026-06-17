import { get } from "svelte/store";
import { Notice } from "obsidian";

import type { CommandBuilder } from "./types";
import { currentWorkflow, projectsByTitle, selectedProject, workflows } from "src/model/stores";
import { WorkflowError, calculateWorkflow, compile, type CompileStatus } from "src/compile";
import { JumpModal } from "./helpers";
import type { Project } from "src/model/types";

export const compileCurrent: CommandBuilder = (plugin) => ({
  id: "inkwell-compile-current",
  name: "Compile current project with current workflow",
  checkCallback: (checking: boolean) => {
    const project = get(selectedProject);
    const workflow = get(currentWorkflow);
    if (checking) {
      return !!project && !!workflow;
    }
    if (!project || !workflow) {
      return;
    }

    const [validation, calculatedKinds] = calculateWorkflow(workflow, project.format === "scenes");
    if (validation.error !== WorkflowError.Valid) {
      new Notice(validation.error);
      return;
    }

    function onCompileStatusChange(status: CompileStatus) {
      if (status.kind == "CompileStatusSuccess") {
        new Notice("Compile complete.");
      }
    }

    compile(plugin.app, project, workflow, calculatedKinds, onCompileStatusChange);
  },
});

export const compileSelection: CommandBuilder = (plugin) => ({
  id: "inkwell-compile-selection",
  name: "Compile project…",
  checkCallback: (checking: boolean) => {
    const allProjects = get(projectsByTitle);
    const projectTitles = Object.keys(allProjects);
    if (checking) {
      return projectTitles.length > 0;
    }

    const opts = new Map(projectTitles.map((t) => [t, t]));

    // Choose project
    new JumpModal(
      plugin.app,
      opts,
      [
        { command: "↑↓", purpose: "to navigate" },
        { command: "↵", purpose: "to choose project" },
        { command: "esc", purpose: "to dismiss" },
      ],
      (k) => {
        const project: Project = allProjects[k];
        if (!project) return;

        // Choose workflow
        const allWorkflows = get(workflows);
        const workflowOpts = new Map(Object.entries(allWorkflows).map(([name, wf]) => [name, wf]));

        new JumpModal(
          plugin.app,
          workflowOpts,
          [
            { command: "↑↓", purpose: "to navigate" },
            { command: "↵", purpose: "to compile" },
            { command: "esc", purpose: "to dismiss" },
          ],
          (workflow) => {
            const [validation, calculatedKinds] = calculateWorkflow(
              workflow,
              project.format === "scenes",
            );
            if (validation.error !== WorkflowError.Valid) {
              new Notice(validation.error);
              return;
            }

            function onCompileStatusChange(status: CompileStatus) {
              if (status.kind == "CompileStatusSuccess") {
                new Notice("Compile complete.");
              }
            }

            compile(plugin.app, project, workflow, calculatedKinds, onCompileStatusChange);
          },
        ).open();
      },
    ).open();
  },
});
