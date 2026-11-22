<script lang="ts">
  import { type CodexField, emptyProperty, PROPERTY_TYPES, type PropertyDraft, type PropertyType, type ScalarDraft } from "src/model/codex-properties";
  import CodexTextValue from "./CodexTextValue.svelte";
  import Icon from "../components/Icon.svelte";
  import { tick } from "svelte";

  const { field, value, sourcePath, onChange }: {
    field: CodexField;
    value: PropertyDraft | null;
    sourcePath: string;
    onChange: (draft: PropertyDraft) => void;
  } = $props();
  const fieldId = $props.id();

  function updateItem(items: ScalarDraft[], index: number, item: ScalarDraft) {
    onChange({ type: "list", items: items.map((previous, i) => i === index ? item : previous) });
  }

  async function addItem(items: ScalarDraft[], event: MouseEvent & { currentTarget: HTMLButtonElement }) {
    const document = event.currentTarget.ownerDocument;
    const type = items.at(-1)?.type ?? "text";
    const item: ScalarDraft = type === "checkbox" ? { type, value: false } : { type, value: "" };
    onChange({ type: "list", items: [...items, item] });
    await tick();
    document.querySelector<HTMLElement>(`[id="${fieldId}-${items.length}"]`)?.focus();
  }
</script>

{#snippet scalar(draft: ScalarDraft, id: string, label: string, set: (draft: ScalarDraft) => void)}
  {#if draft.type === "checkbox"}
    <input {id} type="checkbox" aria-label={label} checked={draft.value}
      onchange={(event) => set({ type: "checkbox", value: event.currentTarget.checked })} />
  {:else if draft.type === "text"}
    <CodexTextValue {id} {label} value={draft.value} {sourcePath}
      onChange={(value) => set({ type: "text", value })} />
  {:else}
    <input {id} aria-label={label} type={draft.type === "datetime" ? "datetime-local" : draft.type === "date" ? "date" : "text"}
      inputmode={draft.type === "number" ? "decimal" : undefined}
      step={draft.type === "datetime" ? "1" : undefined} value={draft.value}
      oninput={(event) => set({ type: draft.type, value: event.currentTarget.value })} />
  {/if}
{/snippet}

<div class="property">
  {#if value?.type === "list"}
    {@const { items } = value}
    <span class="label" id={fieldId} title={field.key}>{field.label}</span>
    <div class="items" role="group" aria-labelledby={fieldId}>
      {#each items as item, index}
        <div class="item">
          {@render scalar(item, `${fieldId}-${index}`, `${field.label} item ${index + 1}`, (next) => updateItem(items, index, next))}
          <button type="button" class="clickable-icon" aria-label="Remove {field.label} item {index + 1}"
            onclick={() => onChange({ type: "list", items: items.filter((_, i) => i !== index) })}>
            <Icon iconName="x" />
          </button>
        </div>
      {/each}
      <button type="button" class="add-item" onclick={(event) => addItem(items, event)}>
        <Icon iconName="plus" /> Add item
      </button>
    </div>
  {:else if field.structured}
    <span class="label" title={field.key}>{field.label}</span>
    <span class="hint" title="Edit this property in the Markdown note">Structured value</span>
  {:else}
    <label class="label" for={fieldId} title={field.key}>{field.label}</label>
    {#if value}
      {@render scalar(value, fieldId, field.label, onChange)}
    {:else}
      <select id={fieldId} class="dropdown" value="" onchange={(event) => {
        const type = event.currentTarget.value as PropertyType;
        onChange(emptyProperty(type));
      }}>
        <option value="" disabled hidden>Choose a type</option>
        {#each PROPERTY_TYPES as [type, label] (type)}
          <option value={type}>{label}</option>
        {/each}
      </select>
    {/if}
  {/if}
</div>

<style>
  .property {
    display: grid;
    align-items: start;
    gap: var(--size-4-1);
    padding-block: var(--size-4-2);
    border-bottom: 1px solid var(--background-modifier-border);
    font-size: var(--font-ui-small);
  }

  .label {
    overflow-wrap: anywhere;
    font-weight: var(--font-medium);
  }

  .hint {
    color: var(--text-muted);
  }

  .items {
    display: grid;
    gap: var(--size-4-1);
  }

  .item {
    display: flex;
    align-items: center;
    gap: var(--size-4-1);
  }

  .add-item {
    justify-self: start;
    gap: var(--size-4-1);
  }

  .add-item :global(svg) {
    width: var(--icon-s);
    height: var(--icon-s);
  }

  input:not([type="checkbox"]), select {
    width: 100%;
    min-width: 0;
    min-height: var(--input-height);
  }

  @container (min-width: 440px) {
    .property {
      grid-template-columns: minmax(9em, 1fr) minmax(0, 2fr);
      align-items: baseline;
      gap: var(--size-4-3);
    }
  }
</style>
