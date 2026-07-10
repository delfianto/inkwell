<script lang="ts">
  import {
    selectedProject,
    workflows,
    currentWorkflow,
    userScriptSteps,
  } from "src/model/stores";
  import { getContext } from "svelte";

  import { BUILTIN_STEPS } from "../../compile/steps";
  import type {
    CompileStep,
    Workflow,
  } from "../../compile/steps/abstract-compile-step";
  import {
    explainStepKind,
    formatStepKind,
  } from "../../compile/steps/abstract-compile-step";

  const close: () => void = getContext("close");
  function onStepClick(step: CompileStep) {
    const newWorkflow: Workflow = {
      ...$currentWorkflow,
      steps: [
        ...($currentWorkflow as Workflow).steps,
        { ...step, id: `${step.id}-${Date.now()}` },
      ],
    } as Workflow;
    const currentWorkflowName = $selectedProject.workflow;
    $workflows[currentWorkflowName] = newWorkflow;
    close();
  }
</script>

<div class="inkwell-add-step-modal-contents">
  <p>
    Choose a step from the following options to add to your current compile
    workflow.
  </p>

  <h2>Built-in Steps</h2>
  <div class="inkwell-steps-grid">
    {#each BUILTIN_STEPS as step}
      <div
        class="inkwell-compile-step"
        role="button"
        tabindex="0"
        onclick={() => onStepClick(step)}
        onkeydown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onStepClick(step);
          }
        }}
      >
        <h3>{step.description.name}</h3>
        <div class="inkwell-step-pill-container">
          {#each step.description.availableKinds as kind}
            <span class="inkwell-step-kind-pill" title={explainStepKind(kind)}
              >{formatStepKind(kind)}</span
            >
          {/each}
          <p>{step.description.description}</p>
        </div>
      </div>
    {/each}
  </div>
  {#if $userScriptSteps}
    <h2>User Script Steps</h2>
    <div class="inkwell-steps-grid">
      {#each $userScriptSteps as step}
        <div
          class="inkwell-compile-step"
          role="button"
          tabindex="0"
          onclick={() => onStepClick(step)}
          onkeydown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onStepClick(step);
            }
          }}
        >
          <h3>{step.description.name}</h3>
          <div class="inkwell-step-pill-container">
            {#each step.description.availableKinds as kind}
              <span
                class="inkwell-step-kind-pill"
                title={explainStepKind(kind)}>{formatStepKind(kind)}</span
              >
            {/each}
            <p>{step.description.description}</p>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .inkwell-add-step-modal-contents {
    padding-right: var(--size-4-4);
  }

  .inkwell-steps-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: var(--size-4-4);
    grid-auto-rows: auto;
  }

  .inkwell-compile-step {
    cursor: pointer;
    grid-column: auto;
    grid-row: auto;
    background-color: var(--background-secondary);
    border: var(--size-2-1) solid var(--background-modifier-border);
    border-radius: var(--size-4-4);
    padding: var(--size-4-2);
  }

  .inkwell-compile-step:hover {
    border: var(--size-2-1) solid var(--text-accent);
    background-color: var(--background-modifier-form-field);
  }

  .inkwell-compile-step h3 {
    padding: var(--size-4-2) 0;
    margin: 0;
  }

  .inkwell-compile-step .inkwell-step-kind-pill {
    background-color: var(--text-accent);
    color: var(--text-on-accent);
    border-radius: var(--radius-l);
    font-size: var(--font-smallest);
    font-weight: bold;
    padding: var(--size-4-1);
    margin-right: var(--size-4-1);
    height: var(--size-4-5);
  }
</style>
