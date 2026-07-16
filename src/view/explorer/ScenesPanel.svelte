<script lang="ts">
  import NewSceneField from "./NewSceneField.svelte";
  import SceneCards from "./SceneCards.svelte";
  import SceneList from "./SceneList.svelte";
  import SceneOutline from "./SceneOutline.svelte";
  import { type SceneViewMode } from "src/model/types";
  import { sceneViewMode } from "../stores";
  import { selectedProject } from "src/model/stores";

  const sceneCount = $derived(
    $selectedProject?.format === "scenes" ? $selectedProject.scenes.length : 0
  );

  const viewModes: { id: SceneViewMode; label: string }[] = [
    { id: "list", label: "List" },
    { id: "cards", label: "Cards" },
    { id: "outline", label: "Outline" },
  ];
</script>

<div class="scene-view-controls">
  <span class="scene-count">{sceneCount} scene{sceneCount === 1 ? "" : "s"}</span>
  <div class="scene-view-switcher" role="tablist">
    {#each viewModes as mode}
      <button
        type="button"
        role="tab"
        aria-selected={$sceneViewMode === mode.id}
        class:active={$sceneViewMode === mode.id}
        onclick={() => sceneViewMode.set(mode.id)}>{mode.label}</button
      >
    {/each}
  </div>
</div>
{#if $sceneViewMode === "cards"}
  <SceneCards />
{:else if $sceneViewMode === "outline"}
  <SceneOutline />
{:else}
  <SceneList />
{/if}
<NewSceneField />

<style>
  .scene-view-controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--size-4-2);
    padding: var(--size-4-1) 0;
  }

  .scene-count {
    color: var(--text-faint);
    font-size: var(--font-ui-smaller);
    white-space: nowrap;
  }

  /* Segmented List · Cards · Outline control. */
  .scene-view-switcher {
    display: flex;
    flex-shrink: 0;
    background: var(--background-secondary);
    border: var(--border-width) solid var(--background-modifier-border);
    border-radius: var(--radius-m);
    padding: var(--size-2-1);
    gap: var(--size-2-1);
  }

  .scene-view-switcher button {
    background: none;
    border: none;
    box-shadow: none;
    padding: var(--size-2-1) var(--size-4-2);
    border-radius: var(--radius-s);
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
    line-height: 1.4;
    cursor: pointer;
  }

  .scene-view-switcher button:hover {
    color: var(--text-normal);
    background: var(--background-modifier-hover);
  }

  .scene-view-switcher button.active {
    color: var(--text-on-accent);
    background: var(--interactive-accent);
  }
</style>
