<script lang="ts">
  import { type ExplorerTab, selectedTab } from "src/view/stores";

  const { tab }: { tab: ExplorerTab } = $props();
</script>

<button
  class="tab-button"
  class:selected={$selectedTab === tab}
  onclick={() => selectedTab.set(tab)}
>
  <span class="tab-label">{tab}</span>
</button>

<style>
  /* Equal-width tab that shares its row via flex, so three tabs never wrap at
     narrow sidebar widths. Active state is a single accent underline (matching
     Obsidian's own tabs) rather than the old per-tab right-border dividers. */
  .tab-button {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    border-bottom: var(--size-2-1) solid transparent;
    border-radius: 0;
    box-shadow: none;
    margin: 0;
    padding: var(--size-4-1) var(--size-4-2);
    color: var(--text-muted);
    font-size: var(--tab-font-size);
    font-weight: var(--tab-font-weight);
    white-space: nowrap;
    cursor: pointer;
  }

  .tab-label {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tab-button:hover {
    color: var(--text-normal);
    background-color: var(--background-modifier-hover);
  }

  .tab-button.selected {
    color: var(--text-accent);
    border-bottom-color: var(--interactive-accent);
    background: none;
  }
</style>
