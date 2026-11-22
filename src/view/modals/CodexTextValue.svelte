<script lang="ts">
  import Icon from "../components/Icon.svelte";
  import MarkdownPreview from "../components/MarkdownPreview.svelte";
  import { tick } from "svelte";

  const { id, label, value, sourcePath, onChange }: {
    id: string;
    label: string;
    value: string;
    sourcePath: string;
    onChange: (value: string) => void;
  } = $props();
  let editing = $state(false);
  let multiline = $state(false);
  const looksLikeMarkdown = $derived(
    /[*`[\\<]|~~|==|https?:\/\/|(?:^|\W)(?:_|#)\S|(?:^|\n) {0,3}(?:[#>+-]|\d+[.)])(?:\s|$)/u.test(value),
  );

  async function edit(event: MouseEvent & { currentTarget: HTMLButtonElement }) {
    const document = event.currentTarget.ownerDocument;
    multiline = value.includes("\n");
    editing = true;
    await tick();
    document.querySelector<HTMLElement>(`[id="${id}"]`)?.focus();
  }
</script>

<div class="text-value">
  {#if !editing && looksLikeMarkdown}
    <div class="formatted-value">
      <MarkdownPreview markdown={value} {sourcePath} />
      <button {id} type="button" class="clickable-icon" aria-label="Edit {label}" title="Edit {label}" onclick={edit}>
        <Icon iconName="pencil" />
      </button>
    </div>
  {:else if multiline || value.includes("\n")}
    <textarea {id} aria-label={label} rows="3" {value}
      onfocus={() => { multiline = true; editing = true; }}
      onblur={() => { editing = false; multiline = false; }}
      oninput={(event) => onChange(event.currentTarget.value)}></textarea>
  {:else}
    <input {id} type="text" aria-label={label} {value}
      onfocus={() => (editing = true)} onblur={() => (editing = false)}
      oninput={(event) => onChange(event.currentTarget.value)} />
  {/if}
</div>

<style>
  .text-value {
    flex: 1;
    min-width: 0;
  }

  .formatted-value {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: start;
    gap: var(--size-4-2);
    min-height: var(--input-height);
    padding: var(--size-4-1) var(--size-4-2);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    background: var(--background-secondary);
  }

  .formatted-value button {
    padding: var(--size-2-1);
  }

  input, textarea {
    display: block;
    width: 100%;
    min-width: 0;
    min-height: var(--input-height);
  }

  textarea {
    resize: vertical;
  }
</style>
