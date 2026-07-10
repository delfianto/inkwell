<script lang="ts">
  // @ts-nocheck
  import type Sortable from "sortablejs";
  import { Notice, type Vault } from "obsidian";

  import {
    type CompileStatus,
    CompileStepKind,
    formatStepKind,
    type Workflow,
    WorkflowError,
    type WorkflowValidationResult,
    calculateWorkflow,
  } from "src/compile";
  import { getContext } from "svelte";
  import {
    projects,
    selectedProject,
    workflows,
    currentWorkflow,
  } from "src/model/stores";
  import CompileStepView from "./CompileStepView.svelte";
  import SortableList from "../sortable/SortableList.svelte";
  import AutoTextArea from "../components/AutoTextArea.svelte";
  import Icon from "../components/Icon.svelte";
  import type { Project } from "src/model/types";

  let workflowContextButton: HTMLElement = $state(null);
  let workflowInputState: "hidden" | "new" | "rename" = $state("hidden");
  let workflowInputValue = $state("");
  let workflowInput: HTMLElement = $state(null);
  let allWorkflowNames: string[] = $state([]);
  let currentWorkflowName: string | null = $state(null);
  let compileStatus: HTMLElement = $state(null);
  let isDeletingWorkflow = $state(false);

  const showConfirmModal: (
    title: string,
    description: string,
    yesText: string,
    yesAction: () => void
  ) => void = getContext("showConfirmModal");

  let currentDraftIndex = $derived(
    $selectedProject
      ? $projects.findIndex((d) => d.vaultPath === $selectedProject.vaultPath)
      : -1
  );

  $effect(() => {
    allWorkflowNames = Object.keys($workflows).sort() ?? [];
  });

  $effect(() => {
    if ($selectedProject) {
      currentWorkflowName = $selectedProject.workflow;

      if (
        !isDeletingWorkflow &&
        $selectedProject &&
        !currentWorkflowName &&
        allWorkflowNames.length > 0
      ) {
        const _currentDraftIndex = $projects.findIndex(
          (d) => d.vaultPath === $selectedProject.vaultPath
        );
        $projects[_currentDraftIndex].workflow = allWorkflowNames[0];
      }
    }
  });

  function selectedWorkflow(event: Event) {
    const title = (event.target as HTMLSelectElement).value;
    $projects[currentDraftIndex].workflow = title;
  }

  const showCompileActionsMenu: (
    x: number,
    y: number,
    currentWorkflowName: string,
    action: (type: "new" | "rename" | "delete") => void
  ) => void = getContext("showCompileActionsMenu");

  function workflowAction(type: "new" | "rename" | "delete") {
    if (type == "new") {
      workflowInputState = "new";
    } else if (type == "rename") {
      workflowInputValue = currentWorkflowName;
      workflowInputState = "rename";
    } else if (type == "delete") {
      showConfirmModal(
        `Delete ${currentWorkflowName}?`,
        "Really delete this workflow? This can't be undone.",
        "Delete",
        () => {
          isDeletingWorkflow = true;

          const toDelete = currentWorkflowName;
          const remaining = allWorkflowNames.filter((n) => n != toDelete);
          if (remaining.length > 0) {
            $projects[currentDraftIndex].workflow = remaining[0];
          } else {
            $projects[currentDraftIndex].workflow = null;
          }

          $workflows = delete $workflows[toDelete] && $workflows;

          isDeletingWorkflow = false;
        }
      );
    }
  }

  function onWorkflowInputEnter() {
    if (workflowInputValue.length == 0) {
      return;
    }

    if (workflowInputState == "new") {
      $workflows[workflowInputValue] = {
        name: workflowInputValue,
        description: "",
        steps: [],
      };
    } else if (workflowInputState == "rename") {
      const workflow = $workflows[currentWorkflowName];
      workflow.name = workflowInputValue;
      $workflows[workflowInputValue] = workflow;
      $workflows = delete $workflows[currentWorkflowName] && $workflows;
    }
    $projects[currentDraftIndex].workflow = workflowInputValue;
    workflowInputValue = "";
    workflowInputState = "hidden";
  }

  function focusOnInit(el: HTMLElement) {
    el.focus();
  }

  const openCompileStepMenu: () => Vault = getContext("openCompileStepMenu");
  function addStep() {
    openCompileStepMenu();
  }

  const VALID = {
    error: WorkflowError.Valid,
    stepPosition: 0,
  };
  let validation: WorkflowValidationResult = $state(VALID);
  let calculatedKinds: CompileStepKind[] = $state([]);

  $effect(() => {
    if ($currentWorkflow) {
      [validation, calculatedKinds] = calculateWorkflow(
        $currentWorkflow,
        $selectedProject.format === "scenes"
      );
    } else {
      validation = VALID;
      calculatedKinds = [];
    }
  });

  function kindAtIndex(index: number): CompileStepKind | null {
    return index < calculatedKinds.length ? calculatedKinds[index] : null;
  }

  function errorAtIndex(index: number): string | null {
    if (
      validation.error !== WorkflowError.Valid &&
      validation.stepPosition === index
    ) {
      return validation.error;
    }
    return null;
  }

  type StepItem = { id: string; index: number };
  let items: StepItem[] = $derived(
    $currentWorkflow
      ? $currentWorkflow.steps.map((step, index) => ({
          id: step.id,
          index,
        }))
      : []
  );

  const sortableOptions: Sortable.Options = {
    animation: 150,
    ghostClass: "step-ghost",
    dragClass: "step-drag",
  };

  function itemOrderChanged(newItems: StepItem[]) {
    const newWorkflow = {
      ...$currentWorkflow,
      steps: newItems.map(({ index }) => $currentWorkflow.steps[index]),
    };
    $workflows[currentWorkflowName] = newWorkflow;
  }

  let defaultCompileStatus = $derived(
    `Will run ${$currentWorkflow ? $currentWorkflow.steps.length : 0} steps.`
  );

  function onCompileStatusChange(status: CompileStatus) {
    if (status.kind == "CompileStatusError") {
      compileStatus.innerText = `${status.error}. See dev console for more details.`;
      compileStatus.classList.add("compile-status-error");
      restoreDefaultStatusAfter(10000);
    } else if (status.kind == "CompileStatusStep") {
      compileStatus.innerText = `Step ${status.stepIndex + 1}/${
        status.totalSteps
      } (${formatStepKind(status.stepKind)})`;
    } else if (status.kind == "CompileStatusSuccess") {
      compileStatus.innerText = "Compiled manuscript.";
      compileStatus.classList.add("compile-status-success");
      restoreDefaultStatusAfter();
      new Notice("Compile complete.");
    } else {
      compileStatus.innerText = "default??";
    }
  }

  function restoreDefaultStatusAfter(ms: number = 3000) {
    setTimeout(() => {
      compileStatus.innerText = defaultCompileStatus;
      compileStatus.classList.remove("compile-status-error");
      compileStatus.classList.remove("compile-status-success");
    }, ms);
  }

  const compile: (
    project: Project,
    workflow: Workflow,
    kinds: CompileStepKind[],
    statusCallback: (status: CompileStatus) => void
  ) => Vault = getContext("compile");
  function doCompile() {
    compile(
      $selectedProject,
      $currentWorkflow,
      calculatedKinds,
      onCompileStatusChange
    );
  }
</script>

{#if $selectedProject}
  <div class="inkwell-compile-container">
    <div class="inkwell-workflow-picker-container">
      <div class="inkwell-workflow-picker">
        {#if workflowInputState !== "hidden"}
          <input
            type="text"
            class="inkwell-workflow-name-input"
            placeholder={workflowInputState == "new"
              ? "New Workflow…"
              : "My Cool Workflow"}
            bind:value={workflowInputValue}
            bind:this={workflowInput}
            onkeydown={(e) => {
              if (e.key === "Enter" && workflowInputValue.length > 0) {
                onWorkflowInputEnter();
              } else if (e.key === "Escape") {
                workflowInputValue = "";
                workflowInput.blur();
                workflowInputState = "hidden";
              }
            }}
            use:focusOnInit
          />
        {:else}
          {#if allWorkflowNames.length == 0}
            <span class="inkwell-hint">No workflows yet — create one with ⋮</span>
          {:else}
            <select
              id="inkwell-workflows"
              class="dropdown"
              value={$selectedProject.workflow}
              onchange={selectedWorkflow}
            >
              {#each allWorkflowNames as workflowOption}
                <option value={workflowOption}>{workflowOption}</option>
              {/each}
            </select>
          {/if}
          <button
            class="options-button"
            title="Workflow options"
            aria-label="Workflow options"
            bind:this={workflowContextButton}
            onclick={() => {
              const rect = workflowContextButton.getBoundingClientRect();
              showCompileActionsMenu(
                rect.x,
                rect.y,
                currentWorkflowName,
                workflowAction
              );
            }}
          >
            <Icon iconName="more-vertical" />
          </button>
        {/if}
      </div>
      {#if $workflows[currentWorkflowName]}
        <AutoTextArea
          placeholder="Click here to leave a description of your workflow…"
          minRows={2}
          maxRows={5}
          bind:value={$workflows[currentWorkflowName].description}
        />
      {/if}
    </div>
    {#if $workflows[currentWorkflowName]}
      <SortableList
        {items}
        {sortableOptions}
        onorderChanged={itemOrderChanged}
        class="inkwell-sortable-step-list"
      >
        {#snippet children(item)}
          <CompileStepView
            ordinal={item.index + 1}
            step={$workflows[currentWorkflowName].steps[item.index]}
            onremoveStep={() => {
              const newWorkflow = {
                ...$currentWorkflow,
                steps: $currentWorkflow.steps.filter(
                  (_e, index) => item.index !== index
                ),
              };
              $workflows[currentWorkflowName] = newWorkflow;
            }}
            calculatedKind={kindAtIndex(item.index)}
            error={errorAtIndex(item.index)}
          />
        {/snippet}
      </SortableList>
      <div class="add-step-container">
        {#if Object.keys($workflows).length > 0}
          <button onclick={addStep}>+ Add Step</button>
        {/if}
      </div>
    {/if}

    <ul class="inkwell-compile-instructions">
      <li>
        Compile workflows run their steps in order.
      </li>
      <li>
        <strong>Scene</strong> workflows run once per scene.
      </li>
      <li>
        <strong>Join</strong> workflows run once and combine the rest of your scene steps into a single manuscript.
      </li>
      <li>
        <strong>Manuscript</strong> steps run once on the joined manuscript.
      </li>
      <li>
        Drag to rearrange. <a href="https://github.com/delfianto/inkwell/blob/main/docs/COMPILE.md">Documentation here.</a
      >
      </li>
    </ul>

    <div class="inkwell-compile-run-container">
      {#if $currentWorkflow && $currentWorkflow.steps.length > 0}
        <button
          class="compile-button"
          onclick={doCompile}
          disabled={validation.error !== WorkflowError.Valid}
          aria-label={validation.error}>Compile</button
        >
        <span class="compile-status" bind:this={compileStatus}
          >{validation.error === WorkflowError.Valid
            ? defaultCompileStatus
            : validation.error}</span
        >
      {/if}
    </div>
  </div>
{/if}

<style>
  .inkwell-workflow-picker-container {
    padding: var(--size-4-2);
    background: var(--background-primary);
    display: flex;
    flex-direction: column;
  }

  .inkwell-workflow-picker {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: var(--size-4-2);
    margin-bottom: var(--size-4-2);
  }

  .inkwell-workflow-picker select {
    flex: 1;
    min-width: 0;
  }

  .inkwell-workflow-picker .inkwell-workflow-name-input {
    flex: 1;
    min-width: 0;
  }

  .inkwell-workflow-picker .inkwell-hint {
    flex: 1;
    font-size: var(--font-ui-smaller);
    color: var(--text-muted);
  }

  .inkwell-compile-container :global(.inkwell-sortable-step-list) {
    list-style-type: none;
    padding: 0;
    margin: 0;
  }

  .options-button {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--size-4-6);
    height: var(--size-4-6);
    padding: 0;
    background: transparent;
    border: none;
    box-shadow: none;
    color: var(--text-muted);
    border-radius: var(--radius-s);
    cursor: pointer;
  }

  .options-button:hover {
    color: var(--text-normal);
    background: var(--background-modifier-hover);
  }

  .add-step-container {
    display: flex;
    padding: var(--size-4-2) var(--size-4-2) 0;
  }

  .add-step-container button {
    font-size: var(--font-ui-smaller);
    font-weight: 600;
    color: var(--text-accent);
  }

  .add-step-container button:hover {
    text-decoration: underline;
    color: var(--text-accent-hover);
  }

  .inkwell-compile-instructions {
    font-size: var(--font-smallest);
    padding: var(--size-4-2) var(--size-4-4) var(--size-4-2) var(--size-4-4);
    margin-top: var(--size-4-2);
    color: var(--text-muted);
    border-top: var(--border-width) solid var(--background-modifier-border);
  }

  .inkwell-compile-instructions li {
    margin-bottom: var(--size-4-1);
  }

  .inkwell-compile-instructions strong {
    color: var(--color-accent-2);
  }

  .compile-button {
    font-weight: bold;
    background-color: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .compile-button:hover {
    background-color: var(--interactive-accent-hover);
    color: var(--text-on-accent);
  }

  .compile-button:disabled {
    background-color: var(--text-muted);
    color: var(--text-faint);
  }

  .inkwell-compile-run-container {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    padding: var(--size-4-2);
    margin-top: var(--size-4-2);
    border-top: var(--border-width) solid var(--background-modifier-border);
  }

  .inkwell-compile-run-container .compile-status {
    color: var(--text-muted);
  }

  :global(.compile-status-error) {
    color: var(--text-error) !important;
  }

  :global(.compile-status-success) {
    color: var(--interactive-success) !important;
  }

  :global(.step-ghost) {
    background-color: var(--interactive-accent-hover);
    color: var(--text-on-accent);
  }
</style>
