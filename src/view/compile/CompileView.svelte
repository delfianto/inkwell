<script lang="ts">
  import {
    calculateWorkflow,
    type CompileStatus,
    CompileStepKind,
    formatStepKind,
    type Workflow,
    WorkflowError,
    type WorkflowValidationResult,
  } from "src/compile";
  import {
    currentWorkflow,
    numberScenes,
    type Project,
    projectFolderPath,
    projects,
    scenePath,
    selectedProject,
    workflows,
  } from "src/model";
  import { normalizePath, Notice, TFile, type Vault } from "obsidian";
  import CompileStepView from "./CompileStepView.svelte";
  import { type ConfirmActionOptions } from "../modals/ConfirmActionModal";
  import { getContext } from "svelte";
  import Icon from "../components/Icon.svelte";
  import type Sortable from "sortablejs";
  import SortableList from "../sortable/SortableList.svelte";
  import { useApp } from "../utils";

  const app = useApp();

  let workflowContextButton: HTMLElement | null = $state(null);
  let workflowInputState: "hidden" | "new" | "rename" = $state("hidden");
  let workflowInputValue = $state("");
  let workflowInput: HTMLElement | null = $state(null);
  let allWorkflowNames: string[] = $state([]);
  let currentWorkflowName: string | null = $state(null);
  let compileStatus: HTMLElement | null = $state(null);
  let isDeletingWorkflow = $state(false);
  let selectedStepId: string | null = $state(null);

  const showConfirmModal: (options: ConfirmActionOptions) => void =
    getContext("showConfirmModal");

  const currentDraftIndex = $derived(
    $selectedProject
      ? $projects.findIndex((d) => d.vaultPath === $selectedProject.vaultPath)
      : -1
  );

  $effect(() => {
    allWorkflowNames = Object.keys($workflows).toSorted() ?? [];
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
        const [firstWorkflow] = allWorkflowNames;
        $projects[currentDraftIndex].workflow = firstWorkflow;
      }
    }
  });

  // Keep the selected step valid as steps change; default to the first step.
  $effect(() => {
    const steps = $currentWorkflow?.steps ?? [];
    if (steps.length === 0) {
      selectedStepId = null;
    } else if (!selectedStepId || !steps.some((s) => s.id === selectedStepId)) {
      selectedStepId = steps[0].id;
    }
  });

  const selectedIndex = $derived(
    $currentWorkflow ? $currentWorkflow.steps.findIndex((s) => s.id === selectedStepId) : -1
  );
  const selectedStep = $derived(
    selectedIndex >= 0 ? $currentWorkflow!.steps[selectedIndex] : null
  );

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
    if (type === "new") {
      workflowInputState = "new";
    } else if (type === "rename") {
      workflowInputValue = currentWorkflowName!;
      workflowInputState = "rename";
    } else if (type === "delete") {
      showConfirmModal({
        title: `Delete ${currentWorkflowName}?`,
        explanation: "Really delete this workflow? This can't be undone.",
        yesText: "Delete",
        yesAction: () => {
          isDeletingWorkflow = true;

          const toDelete = currentWorkflowName;
          const remaining = allWorkflowNames.filter((n) => n !== toDelete);
          const [firstRemaining] = remaining;
          $projects[currentDraftIndex].workflow = remaining.length > 0 ? firstRemaining : null;

          $workflows = (delete $workflows[toDelete!] && $workflows) as Record<string, Workflow>;

          isDeletingWorkflow = false;
        },
      });
    }
  }

  function onWorkflowInputEnter() {
    if (workflowInputValue.length === 0) {
      return;
    }

    if (workflowInputState === "new") {
      $workflows[workflowInputValue] = {
        name: workflowInputValue,
        description: "",
        steps: [],
      };
    } else if (workflowInputState === "rename") {
      const workflow = $workflows[currentWorkflowName!];
      workflow.name = workflowInputValue;
      $workflows[workflowInputValue] = workflow;
      $workflows = (delete $workflows[currentWorkflowName!] && $workflows) as Record<string, Workflow>;
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
        $selectedProject!.format === "scenes"
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
    if (validation.error !== WorkflowError.Valid && validation.stepPosition === index) {
      return validation.error;
    }
    return null;
  }

  function kindClass(kind: CompileStepKind | null): string {
    if (kind === CompileStepKind.Scene) return "kind-scene";
    if (kind === CompileStepKind.Join) return "kind-join";
    if (kind === CompileStepKind.Manuscript) return "kind-manuscript";
    return "";
  }

  interface StepItem {
    id: string;
    index: number;
  }
  const items: StepItem[] = $derived(
    $currentWorkflow
      ? $currentWorkflow.steps.map((step, index) => ({ id: step.id, index }))
      : []
  );

  const sortableOptions: Sortable.Options = {
    animation: 150,
    handle: ".inkwell-step-grip",
    ghostClass: "step-ghost",
    dragClass: "step-drag",
  };

  function itemOrderChanged(newItems: StepItem[]) {
    const newWorkflow = {
      ...$currentWorkflow!,
      steps: newItems.map(({ index }) => $currentWorkflow!.steps[index]),
    };
    $workflows[currentWorkflowName!] = newWorkflow;
  }

  function removeStep(index: number) {
    const newWorkflow = {
      ...$currentWorkflow!,
      steps: $currentWorkflow!.steps.filter((_e, i) => i !== index),
    };
    $workflows[currentWorkflowName!] = newWorkflow;
  }

  const kindBreakdown = $derived.by(() => {
    const counts = { Scene: 0, Join: 0, Manuscript: 0 };
    for (const kind of calculatedKinds) counts[kind] += 1;
    return counts;
  });

  const defaultCompileStatus = $derived(
    `Will run ${$currentWorkflow ? $currentWorkflow.steps.length : 0} steps.`
  );

  function onCompileStatusChange(status: CompileStatus) {
    if (status.kind === "CompileStatusError") {
      compileStatus!.textContent = `${status.error}. See dev console for more details.`;
      compileStatus!.classList.add("compile-status-error");
      restoreDefaultStatusAfter(10_000);
    } else if (status.kind === "CompileStatusStep") {
      compileStatus!.textContent = `Step ${status.stepIndex + 1}/${
        status.totalSteps
      } (${formatStepKind(status.stepKind)})`;
    } else if (status.kind === "CompileStatusSuccess") {
      compileStatus!.textContent = "Compiled manuscript.";
      compileStatus!.classList.add("compile-status-success");
      restoreDefaultStatusAfter();
      new Notice("Compile complete.");
    } else {
      compileStatus!.textContent = "default??";
    }
  }

  function restoreDefaultStatusAfter(ms = 3000) {
    setTimeout(() => {
      compileStatus!.textContent = defaultCompileStatus;
      compileStatus!.classList.remove("compile-status-error", "compile-status-success");
    }, ms);
  }

  const compile: (
    project: Project,
    workflow: Workflow,
    kinds: CompileStepKind[],
    statusCallback: (status: CompileStatus) => void
  ) => Vault = getContext("compile");
  function doCompile() {
    compile($selectedProject!, $currentWorkflow!, calculatedKinds, onCompileStatusChange);
  }

  // ---- Live preview (best-effort, Scene-kind transforms only) ----
  let previewText = $state("");
  let previewNote = $state("");

  $effect(() => {
    void computePreview(selectedStepId, calculatedKinds, $currentWorkflow, $selectedProject);
  });

  async function computePreview(
    _stepId: string | null,
    kinds: CompileStepKind[],
    workflow: Workflow | null,
    project: Project | null
  ) {
    previewNote = "";
    if (!project || !workflow || selectedIndex < 0) {
      previewText = "";
      return;
    }

    let firstPath: string;
    let firstName: string;
    if (project.format === "single") {
      firstPath = project.vaultPath;
      firstName = project.title;
    } else {
      if (project.scenes.length === 0) {
        previewText = "";
        previewNote = "No scenes to preview.";
        return;
      }
      const [first] = numberScenes(project.scenes);
      firstName = first.title;
      firstPath = scenePath(first.title, project, app.vault);
    }

    const file = app.vault.getAbstractFileByPath(firstPath);
    if (!(file instanceof TFile)) {
      previewText = "";
      previewNote = "First scene not found.";
      return;
    }

    const raw = await app.vault.cachedRead(file);

    const upToSelected = kinds.slice(0, selectedIndex + 1);
    const onlyScene = upToSelected.length > 0 && upToSelected.every((k) => k === CompileStepKind.Scene);

    if (!onlyScene) {
      previewNote = "Raw first scene — Join/Manuscript steps aren't previewed.";
      previewText = raw;
      return;
    }

    try {
      let result: any = [
        {
          path: firstPath,
          name: firstName,
          contents: raw,
          metadata: app.metadataCache.getCache(firstPath),
          indentationLevel: 0,
          numbering: [1],
        },
      ];
      for (let i = 0; i <= selectedIndex; i++) {
        const step = workflow.steps[i];
        result = await step.compile(result, {
          kind: CompileStepKind.Scene,
          optionValues: formatOptionValues(step.optionValues),
          projectPath: projectFolderPath(project, app.vault),
          project,
          app,
          utilities: { normalizePath },
        });
      }
      previewText = result[0]?.contents ?? raw;
      previewNote = `Steps 1–${selectedIndex + 1} applied to the first scene.`;
    } catch {
      previewNote = "Preview unavailable for this step.";
      previewText = raw;
    }
  }

  // Mirror compile/index.ts: convert literal "\n" option values to newlines.
  function formatOptionValues(values: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(values)) {
      const v = values[key];
      out[key] = typeof v === "string" ? v.split(String.raw`\n`).join("\n") : v;
    }
    return out;
  }
</script>

{#if $selectedProject}
  <div class="inkwell-builder">
    <!-- Top bar -->
    <div class="inkwell-builder-top">
      <div class="inkwell-builder-title">
        <span class="inkwell-builder-mark"><Icon iconName="book-open" /></span>
        <span class="inkwell-builder-name">Compile</span>
        <span class="inkwell-builder-project">· {$selectedProject.title}</span>
      </div>
      <div class="inkwell-workflow-picker">
        {#if workflowInputState !== "hidden"}
          <input
            type="text"
            class="inkwell-workflow-name-input"
            placeholder={workflowInputState === "new" ? "New Workflow…" : "My Cool Workflow"}
            bind:value={workflowInputValue}
            bind:this={workflowInput}
            onkeydown={(e) => {
              if (e.key === "Enter" && workflowInputValue.length > 0) {
                onWorkflowInputEnter();
              } else if (e.key === "Escape") {
                workflowInputValue = "";
                workflowInput!.blur();
                workflowInputState = "hidden";
              }
            }}
            use:focusOnInit
          />
        {:else}
          <span class="inkwell-workflow-label">Workflow</span>
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
              const rect = workflowContextButton!.getBoundingClientRect();
              showCompileActionsMenu(rect.x, rect.y, currentWorkflowName!, workflowAction);
            }}
          >
            <Icon iconName="more-vertical" />
          </button>
        {/if}
        <button
          class="inkwell-run-button"
          onclick={doCompile}
          disabled={!$currentWorkflow ||
            $currentWorkflow.steps.length === 0 ||
            validation.error !== WorkflowError.Valid}
          aria-label={validation.error || "Run compile"}
        >
          <Icon iconName="play" />Run
        </button>
      </div>
    </div>

    {#if $workflows[currentWorkflowName!]}
      <div class="inkwell-builder-body">
        <!-- Left: step list -->
        <div class="inkwell-builder-steps">
          <div class="inkwell-steps-header">
            <span class="inkwell-steps-label">Steps</span>
            <button class="inkwell-add-step" onclick={addStep}>＋ Add step</button>
          </div>

          {#if items.length === 0}
            <button class="inkwell-add-step-ghost" onclick={addStep}>＋ Add your first step</button>
          {:else}
            <SortableList
              {items}
              {sortableOptions}
              onorderChanged={itemOrderChanged}
              class="inkwell-step-rows"
            >
              {#snippet children(item)}
                {@const step = $workflows[currentWorkflowName!].steps[item.index]}
                {@const kind = kindAtIndex(item.index)}
                <div
                  class="inkwell-step-row"
                  class:selected={step.id === selectedStepId}
                  class:invalid={errorAtIndex(item.index) !== null}
                  role="button"
                  tabindex="0"
                  onclick={() => {
                    selectedStepId = step.id;
                  }}
                  onkeydown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      selectedStepId = step.id;
                    }
                  }}
                >
                  <span class="inkwell-step-grip" aria-hidden="true">⠿</span>
                  <span class="inkwell-step-ordinal">{item.index + 1}</span>
                  <span class="inkwell-step-name">{step.description.name}</span>
                  {#if kind !== null}
                    <span class="inkwell-kind-pill {kindClass(kind)}">{formatStepKind(kind)}</span>
                  {/if}
                  <button
                    class="inkwell-step-remove"
                    aria-label="Remove step"
                    onclick={(e) => {
                      e.stopPropagation();
                      removeStep(item.index);
                    }}
                  >
                    <Icon iconName="x" />
                  </button>
                </div>
              {/snippet}
            </SortableList>
            <button class="inkwell-add-step-ghost" onclick={addStep}>＋ Add step</button>
          {/if}

          <div
            class="inkwell-validity"
            class:valid={validation.error === WorkflowError.Valid}
            class:invalid={validation.error !== WorkflowError.Valid}
          >
            {#if validation.error === WorkflowError.Valid}
              ✓ Valid · runs {$currentWorkflow?.steps.length ?? 0} step{($currentWorkflow?.steps
                .length ?? 0) === 1
                ? ""
                : "s"}
            {:else}
              ✕ {validation.error}
            {/if}
          </div>
        </div>

        <!-- Right: selected step config + preview -->
        <div class="inkwell-builder-config">
          {#if selectedStep}
            <CompileStepView
              step={selectedStep}
              calculatedKind={kindAtIndex(selectedIndex)}
              kindClassName={kindClass(kindAtIndex(selectedIndex))}
              error={errorAtIndex(selectedIndex)}
            />
            <div class="inkwell-preview">
              <div class="inkwell-preview-label">Live preview · first scene</div>
              <pre class="inkwell-preview-body">{previewText || "…"}</pre>
              {#if previewNote}
                <div class="inkwell-preview-note">{previewNote}</div>
              {/if}
            </div>
          {:else}
            <div class="inkwell-config-empty">Select a step to edit its options.</div>
          {/if}
        </div>
      </div>
    {/if}

    <!-- Bottom status bar -->
    <div class="inkwell-builder-status">
      <span class="inkwell-status-left">
        <span
          class="inkwell-status-dot"
          class:ok={validation.error === WorkflowError.Valid}
          class:bad={validation.error !== WorkflowError.Valid}
        ></span>
        <span class="compile-status" bind:this={compileStatus}
          >{validation.error === WorkflowError.Valid
            ? defaultCompileStatus
            : validation.error}</span
        >
      </span>
      <span class="inkwell-status-right">
        {calculatedKinds.length} step{calculatedKinds.length === 1 ? "" : "s"} · Scene ×{kindBreakdown.Scene}
        · Join ×{kindBreakdown.Join} · Manuscript ×{kindBreakdown.Manuscript}
      </span>
    </div>
  </div>
{:else}
  <div class="inkwell-config-empty">Select an Inkwell project to compile.</div>
{/if}

<style>
  .inkwell-builder {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  /* Top bar */
  .inkwell-builder-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--size-4-2);
    flex-wrap: wrap;
    padding: var(--size-4-2) var(--size-4-4);
    border-bottom: var(--border-width) solid var(--background-modifier-border);
  }

  .inkwell-builder-title {
    display: flex;
    align-items: center;
    gap: var(--size-4-2);
    min-width: 0;
  }

  .inkwell-builder-mark {
    display: flex;
    color: var(--text-accent);
  }

  .inkwell-builder-name {
    font-size: var(--font-ui-large);
    font-weight: 600;
    color: var(--text-normal);
  }

  .inkwell-builder-project {
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .inkwell-workflow-picker {
    display: flex;
    align-items: center;
    gap: var(--size-4-2);
  }

  .inkwell-workflow-label {
    color: var(--text-faint);
    font-size: var(--font-ui-smaller);
  }

  .inkwell-workflow-picker .inkwell-hint {
    font-size: var(--font-ui-smaller);
    color: var(--text-muted);
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

  .inkwell-run-button {
    display: flex;
    align-items: center;
    gap: var(--size-2-2);
    font-weight: 600;
    background-color: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .inkwell-run-button:hover:not(:disabled) {
    background-color: var(--interactive-accent-hover);
    color: var(--text-on-accent);
  }

  .inkwell-run-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Body two columns */
  .inkwell-builder-body {
    display: grid;
    grid-template-columns: minmax(260px, 360px) 1fr;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .inkwell-builder-steps {
    display: flex;
    flex-direction: column;
    padding: var(--size-4-3) var(--size-4-4);
    border-right: var(--border-width) solid var(--background-modifier-border);
    overflow-y: auto;
  }

  .inkwell-steps-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--size-4-2);
  }

  .inkwell-steps-label {
    color: var(--text-faint);
    font-size: var(--font-ui-smaller);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .inkwell-add-step {
    background: none;
    border: var(--border-width) solid var(--background-modifier-border);
    box-shadow: none;
    color: var(--text-accent);
    font-size: var(--font-ui-smaller);
    font-weight: 600;
    padding: var(--size-2-1) var(--size-4-2);
  }

  .inkwell-add-step:hover {
    background: var(--background-modifier-hover);
  }

  .inkwell-builder-steps :global(.inkwell-step-rows) {
    list-style-type: none;
    padding: 0;
    margin: 0;
  }

  .inkwell-step-row {
    display: flex;
    align-items: center;
    gap: var(--size-4-2);
    padding: var(--size-4-2);
    border-radius: var(--radius-s);
    border-left: var(--size-2-1) solid transparent;
    cursor: pointer;
  }

  .inkwell-step-row:hover {
    background: var(--background-modifier-hover);
  }

  .inkwell-step-row.selected {
    background: var(--background-secondary-alt);
    border-left-color: var(--interactive-accent);
  }

  .inkwell-step-row.invalid {
    border-left-color: var(--text-error);
  }

  .inkwell-step-grip {
    color: var(--text-faint);
    cursor: grab;
    font-size: var(--font-smaller);
  }

  .inkwell-step-ordinal {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--size-4-5);
    height: var(--size-4-5);
    border-radius: 50%;
    background: var(--background-modifier-border);
    color: var(--text-muted);
    font-size: var(--font-smaller);
  }

  .inkwell-step-row.selected .inkwell-step-ordinal {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .inkwell-step-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--text-normal);
  }

  .inkwell-step-remove {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--size-4-5);
    height: var(--size-4-5);
    padding: 0;
    background: transparent;
    border: none;
    box-shadow: none;
    color: var(--text-faint);
    opacity: 0;
    cursor: pointer;
  }

  .inkwell-step-row:hover .inkwell-step-remove {
    opacity: 1;
  }

  .inkwell-step-remove:hover {
    color: var(--text-error);
    background: transparent;
  }

  .inkwell-add-step-ghost {
    margin-top: var(--size-4-2);
    padding: var(--size-4-2);
    background: none;
    border: var(--border-width) dashed var(--background-modifier-border);
    border-radius: var(--radius-s);
    box-shadow: none;
    color: var(--text-faint);
    width: 100%;
  }

  .inkwell-add-step-ghost:hover {
    color: var(--text-accent);
    border-color: var(--text-accent);
  }

  .inkwell-validity {
    margin-top: auto;
    padding-top: var(--size-4-3);
    font-size: var(--font-ui-smaller);
  }

  .inkwell-validity.valid {
    color: var(--interactive-success);
  }

  .inkwell-validity.invalid {
    color: var(--text-error);
  }

  /* Right config panel */
  .inkwell-builder-config {
    display: flex;
    flex-direction: column;
    padding: var(--size-4-4);
    overflow-y: auto;
  }

  .inkwell-config-empty {
    padding: var(--size-4-4);
    color: var(--text-muted);
  }

  .inkwell-preview {
    margin-top: var(--size-4-4);
    padding-top: var(--size-4-3);
    border-top: var(--border-width) solid var(--background-modifier-border);
  }

  .inkwell-preview-label {
    color: var(--text-faint);
    font-size: var(--font-ui-smaller);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: var(--size-4-2);
  }

  .inkwell-preview-body {
    margin: 0;
    padding: var(--size-4-3);
    max-height: 260px;
    overflow: auto;
    background: var(--background-primary-alt);
    border: var(--border-width) solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    font-family: var(--font-monospace);
    font-size: var(--font-ui-smaller);
    white-space: pre-wrap;
    color: var(--text-normal);
  }

  .inkwell-preview-note {
    margin-top: var(--size-4-1);
    color: var(--text-faint);
    font-size: var(--font-ui-smaller);
  }

  /* Bottom status bar */
  .inkwell-builder-status {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--size-4-2);
    padding: var(--size-4-2) var(--size-4-4);
    border-top: var(--border-width) solid var(--background-modifier-border);
  }

  .inkwell-status-left {
    display: flex;
    align-items: center;
    gap: var(--size-4-2);
    min-width: 0;
  }

  .inkwell-status-dot {
    flex-shrink: 0;
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .inkwell-status-dot.ok {
    background: var(--interactive-success);
  }

  .inkwell-status-dot.bad {
    background: var(--text-error);
  }

  .inkwell-builder-status .compile-status {
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .inkwell-status-right {
    flex-shrink: 0;
    color: var(--text-faint);
    font-size: var(--font-ui-smaller);
  }

  :global(.compile-status-error) {
    color: var(--text-error) !important;
  }

  :global(.compile-status-success) {
    color: var(--interactive-success) !important;
  }

  :global(.step-ghost) {
    opacity: 0.5;
  }
</style>
