<script lang="ts">
  import {
    type CompileStep,
    type CompileStepKind,
    CompileStepOptionType,
    explainStepKind,
    formatStepKind,
    PLACEHOLDER_MISSING_STEP,
  } from "src/compile/steps/abstract-compile-step";

  const {
    step,
    calculatedKind,
    kindClassName,
    error,
  }: {
    step: CompileStep;
    calculatedKind: CompileStepKind | null;
    kindClassName: string;
    error: string | null;
  } = $props();
</script>

{#if step.description.canonicalID === PLACEHOLDER_MISSING_STEP.description.canonicalID}
  <div class="inkwell-config">
    <h2 class="inkwell-config-title">Invalid step</h2>
    <p class="inkwell-config-error">
      This workflow contains a step that could not be loaded. Please remove it to
      run this workflow. On mobile, this may be a user-script step that did not
      load.
    </p>
  </div>
{:else}
  <div class="inkwell-config">
    <div class="inkwell-config-head">
      <h2 class="inkwell-config-title">{step.description.name}</h2>
      {#if calculatedKind !== null}
        <span class="inkwell-kind-pill {kindClassName}" title={explainStepKind(calculatedKind)}
          >{formatStepKind(calculatedKind)}</span
        >
      {/if}
    </div>
    <p class="inkwell-config-desc">{step.description.description}</p>

    {#if step.description.options.length > 0}
      <div class="inkwell-config-options">
        {#each step.description.options as option}
          <div class="inkwell-config-option">
            {#if option.type === CompileStepOptionType.Text}
              <label for={step.id + "-" + option.id}>{option.name}</label>
              <input
                id={step.id + "-" + option.id}
                type="text"
                placeholder={String(option.default).replace(/\n/gu, "\\n")}
                bind:value={step.optionValues[option.id]}
              />
            {:else if option.type === CompileStepOptionType.MultilineText}
              <label for={step.id + "-" + option.id}>{option.name}</label>
              <textarea
                id={step.id + "-" + option.id}
                placeholder="key: value"
                bind:value={step.optionValues[option.id]}
              ></textarea>
            {:else}
              <div class="inkwell-config-checkbox">
                <input
                  id={step.id + "-" + option.id}
                  type="checkbox"
                  bind:checked={
                    () => Boolean(step.optionValues[option.id]),
                    (v) => (step.optionValues[option.id] = v)
                  }
                />
                <label for={step.id + "-" + option.id}>{option.name}</label>
              </div>
            {/if}
            <p class="inkwell-config-option-desc">{option.description}</p>
          </div>
        {/each}
      </div>
    {:else}
      <p class="inkwell-config-desc">This step has no options.</p>
    {/if}

    {#if error}
      <p class="inkwell-config-error">{error}</p>
    {/if}
  </div>
{/if}

<style>
  .inkwell-config {
    display: flex;
    flex-direction: column;
  }

  .inkwell-config-head {
    display: flex;
    align-items: center;
    gap: var(--size-4-2);
  }

  .inkwell-config-title {
    margin: 0;
    font-size: var(--font-ui-large);
    font-weight: 600;
    color: var(--text-normal);
  }

  .inkwell-config-desc {
    margin: var(--size-4-1) 0 0;
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
  }

  .inkwell-config-options {
    display: flex;
    flex-direction: column;
    gap: var(--size-4-4);
    margin-top: var(--size-4-4);
    padding-top: var(--size-4-3);
    border-top: var(--border-width) solid var(--background-modifier-border);
  }

  .inkwell-config-option label {
    display: block;
    font-weight: 600;
    font-size: var(--font-ui-smaller);
    margin-bottom: var(--size-2-2);
  }

  .inkwell-config-option input[type="text"],
  .inkwell-config-option textarea {
    width: 100%;
    font-family: var(--font-monospace);
  }

  .inkwell-config-option textarea {
    resize: vertical;
    min-height: var(--size-4-16);
  }

  .inkwell-config-checkbox {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: var(--size-4-2);
  }

  .inkwell-config-checkbox label {
    margin-bottom: 0;
  }

  .inkwell-config-option-desc {
    margin: var(--size-4-1) 0 0;
    font-size: var(--font-ui-smaller);
    color: var(--text-faint);
  }

  .inkwell-config-error {
    margin-top: var(--size-4-3);
    padding: var(--size-4-2) var(--size-4-3);
    background-color: color-mix(in srgb, var(--text-error) 12%, transparent);
    border-radius: var(--radius-s);
    color: var(--text-error);
    font-size: var(--font-ui-smaller);
  }
</style>
