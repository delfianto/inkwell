<script lang="ts">
  import { type ExplorerTab, selectedTab } from "src/view/stores";

  const { tab }: { tab: ExplorerTab } = $props();
</script>

<button
  class="tab-button"
  class:selected={$selectedTab === tab}
  onclick={() => selectedTab.set(tab)}
>
  {#if tab == "Scenes"}
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="clickable-icon lucide lucide-gallery-horizontal-end"
      ><path d="M2 7v10" /><path d="M6 5v14" /><rect
        width="12"
        height="18"
        x="10"
        y="3"
        rx="2"
      /></svg
    >
  {/if}
  {#if tab == "Project"}
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="clickable-icon lucide lucide-book-text"
      ><path
        d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"
      /><path d="M8 11h8" /><path d="M8 7h6" /></svg
    >
  {/if}
  {#if tab == "Compile"}
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="clickable-icon lucide lucide-blocks"
      ><rect width="7" height="7" x="14" y="3" rx="1" /><path
        d="M10 21V8a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5a1 1 0 0 0-1-1H3"
      /></svg
    >
  {/if}
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
    gap: var(--size-4-1);
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

  .tab-button svg {
    flex-shrink: 0;
    width: var(--icon-s);
    height: var(--icon-s);
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
