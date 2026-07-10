<script lang="ts">
  // @ts-nocheck
  import {
    type CompileStep,
    CompileStepKind,
    CompileStepOptionType,
    explainStepKind,
    formatStepKind,
    PLACEHOLDER_MISSING_STEP,
  } from "src/compile/steps/abstract-compile-step";
  import Icon from "../components/Icon.svelte";

  let {
    step,
    ordinal,
    calculatedKind,
    error,
    onremoveStep,
  }: {
    step: CompileStep;
    ordinal: number;
    calculatedKind: CompileStepKind | null;
    error: string | null;
    onremoveStep?: () => void;
  } = $props();

  function removeStep() {
    onremoveStep?.();
  }
</script>

<div class="inkwell-compile-step">
  {#if step.description.canonicalID === PLACEHOLDER_MISSING_STEP.description.canonicalID}
    <div class="inkwell-compile-step-title-outer">
      <div class="inkwell-compile-step-title-container">
        <h4>Invalid Step</h4>
      </div>
      <button class="inkwell-remove-step-button" onclick={removeStep} aria-label="Remove step">
        <Icon iconName="x" />
      </button>
    </div>
    <div class="inkwell-compile-step-error-container">
      <p class="inkwell-compile-step-error">
        This workflow contains a step that could not be loaded. Please delete
        the step to be able to run this workflow. If you're on mobile, this may
        be a user script step that did not load.
      </p>
    </div>
  {:else}
    <div class="inkwell-compile-step-title-outer">
      <div class="inkwell-compile-step-title-container">
        <h4><span class="inkwell-compile-step-number">{ordinal}</span>{step.description.name}</h4>
        {#if calculatedKind !== null}
          <div
            class="inkwell-step-kind-pill"
            title={explainStepKind(calculatedKind)}
          >
            {formatStepKind(calculatedKind)}
          </div>
        {/if}
      </div>
      <button class="inkwell-remove-step-button" onclick={removeStep} aria-label="Remove step">
        <Icon iconName="x" />
      </button>
    </div>
    <p class="inkwell-compile-step-description">
      {step.description.description}
    </p>
    {#if step.description.options.length > 0}
      <div class="inkwell-compile-step-options">
        <div>
          {#each step.description.options as option}
            <div class="inkwell-compile-step-option">
              {#if option.type === CompileStepOptionType.Text}
                <label for={step.id + "-" + option.id}>{option.name}</label>
                <input
                  id={step.id + "-" + option.id}
                  type="text"
                  placeholder={option.default.replace(/\n/g, "\\n")}
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
                <div class="inkwell-compile-step-checkbox-container">
                  <input
                    id={step.id + "-" + option.id}
                    type="checkbox"
                    bind:checked={step.optionValues[option.id]}
                  />
                  <label for={step.id + "-" + option.id}>{option.name}</label>
                </div>
              {/if}
              <p class="inkwell-compile-step-option-description">
                {option.description}
              </p>
            </div>
          {/each}
        </div>
      </div>
    {/if}
    {#if error}
      <div class="inkwell-compile-step-error-container">
        <p class="inkwell-compile-step-error">{error}</p>
      </div>
    {/if}
  {/if}
</div>

<style>
  .inkwell-compile-step {
    background-color: var(--background-modifier-border);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    padding: 0;
    margin: var(--size-4-4) 0;
  }

  .inkwell-compile-step-title-outer {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    padding: var(--size-4-1) var(--size-4-1) var(--size-4-1) var(--size-4-2);
  }

  .inkwell-compile-step-title-container {
    display: flex;
    flex-direction: row;
    align-items: center;
    flex-wrap: wrap;
    font-size: var(--font-ui-smaller);
  }

  .inkwell-compile-step-title-container h4 {
    display: inline-block;
    margin: var(--size-4-1) var(--size-4-2) var(--size-4-1) 0;
    padding: 0;
    font-size: inherit;
    font-weight: 600;
  }

  .inkwell-compile-step-title-container .inkwell-step-kind-pill {
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: color-mix(in srgb, var(--text-accent) 50%, var(--background-modifier-border) 50%);
    color: var(--text-on-accent);
    border-radius: var(--radius-l);
    font-size: var(--font-smallest);
    font-weight: bold;
    padding: var(--size-4-1) var(--size-4-2);
    margin-right: var(--size-4-1);
    height: var(--h1-line-height);
  }

  .inkwell-compile-step-number {
    color: var(--text-faint);
    display: inline-block;
    width: var(--size-4-6);
    text-align: center;
  }

  .inkwell-remove-step-button {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--size-4-6);
    height: var(--size-4-6);
    padding: 0;
    margin: 0 var(--size-4-1) 0 0;
    background: transparent;
    border: none;
    box-shadow: none;
    color: var(--text-faint);
    border-radius: var(--radius-s);
    cursor: pointer;
  }

  .inkwell-remove-step-button:hover {
    color: var(--text-error);
    background: transparent;
  }

  .inkwell-compile-step p {
    margin: 0;
    background: var(--background-primary);
  }

  .inkwell-compile-step-description {
    font-size: var(--font-smallest);
    color: var(--text-muted);
    padding: var(--size-4-2) var(--size-4-2) var(--size-4-2) calc(var(--size-4-2) + var(--size-4-6));
  }

  .inkwell-compile-step-options {
    padding: var(--size-4-2) 0;
    background: var(--background-primary);
  }

  .inkwell-compile-step-options > div {
    margin: 0 var(--size-4-2) 0 calc(var(--size-4-2) + var(--size-4-6));
  }

  .inkwell-compile-step-option {
    margin: 0 var(--size-4-4) var(--size-4-4) 0;
  }

  .inkwell-compile-step-option label {
    display: block;
    font-weight: 600;
    font-size: var(--font-smallest);
  }

  .inkwell-compile-step-checkbox-container {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: flex-start;
  }

  .inkwell-compile-step-option input[type="text"] {
    margin: 0 0 var(--size-4-1) 0;
    width: 100%;
  }

  .inkwell-compile-step-option textarea {
    color: var(--text-accent);
    margin: 0 0 var(--size-4-1) 0;
    width: 100%;
    resize: vertical;
  }

  .inkwell-compile-step-option input[type="checkbox"] {
    margin: 0 var(--size-4-2) var(--size-2-1) 0;
  }

  .inkwell-compile-step-option input:focus {
    color: var(--text-accent-hover);
  }

  .inkwell-compile-step-option-description {
    font-size: var(--font-smallest);
    line-height: 1em;
    color: var(--text-faint);
  }

  .inkwell-compile-step-error-container {
    margin-top: var(--size-4-2);
  }

  .inkwell-compile-step-error {
    color: var(--text-error);
    font-size: var(--font-smallest);
    line-height: 1em;
  }
</style>
