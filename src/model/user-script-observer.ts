import debounce from "lodash/debounce";
import type { Vault, TAbstractFile } from "obsidian";
import type { CompileStep, Workflow } from "src/compile";
import { CompileStepKind, CompileStepOptionType, makeBuiltinStep } from "src/compile";
import { userScriptSteps, workflows } from "src/model/stores";
import { inkwellDataDir } from "src/lib/path";
import { get } from "svelte/store";

const DEBOUNCE_SCRIPT_LOAD_DELAY_MS = 10_000;

/**
 * Watches `<vault>/.obsidian/inkwell/` for `*.js` files and loads them
 * as user compile steps. The folder is a fixed convention, colocated
 * with `workflows.json`.
 */
export class UserScriptObserver {
  private vault: Vault;
  private onScriptModify: () => void;

  constructor(vault: Vault) {
    this.vault = vault;
    this.onScriptModify = debounce(() => {
      console.log(`[Inkwell] File in user script folder modified, reloading scripts…`);
      this.loadUserSteps();
    }, DEBOUNCE_SCRIPT_LOAD_DELAY_MS);
  }

  private get folder(): string {
    return inkwellDataDir(this.vault);
  }

  async loadUserSteps(): Promise<CompileStep[] | undefined> {
    if (!(await this.vault.adapter.exists(this.folder))) {
      return;
    }

    // Get all .js files in folder
    const { files } = await this.vault.adapter.list(this.folder);
    const scripts = files.filter((f) => f.endsWith("js"));

    const userSteps: CompileStep[] = [];
    for (const file of scripts) {
      try {
        const step = await this.loadScript(file);
        userSteps.push(step);
      } catch (e) {
        console.error(`[Inkwell] skipping user script ${file} due to error:`, e);
      }
    }

    console.log(`[Inkwell] Loaded ${userSteps.length} user script steps.`);
    userScriptSteps.set(userSteps);

    // if workflows have loaded, merge in user steps to get updated values
    const _workflows = get(workflows);
    const workflowNames = Object.keys(_workflows);
    const mergedWorkflows: Record<string, Workflow> = {};
    workflowNames.forEach((name) => {
      const workflow = _workflows[name];
      const workflowSteps = workflow.steps.map((step) => {
        const userStep = userSteps.find(
          (u) => step.description.canonicalID === u.description.canonicalID,
        );
        if (userStep) {
          let mergedStep = {
            ...userStep,
            id: step.id,
            optionValues: userStep.optionValues,
          };
          // Copy existing step's option values into the merged step
          for (const key of Object.keys(step.optionValues)) {
            if (mergedStep.optionValues[key]) {
              mergedStep = {
                ...mergedStep,
                optionValues: {
                  ...mergedStep.optionValues,
                  [key]: step.optionValues[key],
                },
              };
            }
          }
          return mergedStep;
        } else {
          return step;
        }
      });
      mergedWorkflows[name] = {
        ...workflow,
        steps: workflowSteps,
      };
    });
    workflows.set(mergedWorkflows);

    return userSteps;
  }

  private async loadScript(path: string): Promise<CompileStep> {
    const js = await this.vault.adapter.read(path);

    // eslint-disable-next-line prefer-const
    let _require = (s: string) => {
      return window.require && window.require(s);
    };
    // eslint-disable-next-line prefer-const
    let exports: any = {};
    // eslint-disable-next-line prefer-const
    let module = {
      exports,
    };

    const evaluateScript = window.eval(
      "(function anonymous(require, module, exports){" + js + "\n})",
    );
    evaluateScript(_require, module, exports);
    const loadedStep: any = exports["default"] || module.exports;

    if (!loadedStep) {
      console.error(`[Inkwell] Failed to load user script ${path}. No exports detected.`);
      throw new Error(`Failed to load user script ${path}. No exports detected.`);
    }

    const step = makeBuiltinStep(
      {
        ...loadedStep,
        id: path,
        description: {
          ...loadedStep.description,
          availableKinds: loadedStep.description.availableKinds.map(
            (v: string) => CompileStepKind[v as keyof typeof CompileStepKind],
          ),
          options: loadedStep.description.options
            ? loadedStep.description.options.map((o: any) => ({
                ...o,
                type: CompileStepOptionType[o.type as keyof typeof CompileStepOptionType],
              }))
            : [],
        },
      },
      true,
    );

    return {
      ...step,
      id: path,
      description: {
        ...step.description,
        canonicalID: path,
        isScript: true,
      },
    };
  }

  fileEventCallback(file: TAbstractFile): void {
    if (!file.path.endsWith("js")) return;
    if (file.path.startsWith(this.folder)) {
      this.onScriptModify();
    }
  }
}
