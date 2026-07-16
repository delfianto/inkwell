<script lang="ts">
  import { newSceneFieldVisible, sceneViewMode, selectedTab } from "../stores";
  import Icon from "../components/Icon.svelte";
  import { Platform } from "obsidian";
  import { type SceneViewMode } from "src/model/types";
  import { selectedProject } from "src/model/stores";
  import { useApp } from "../utils";

  const app = useApp();

  const isScenes = $derived($selectedProject?.format === "scenes");
  const showCompile = $derived(!Platform.isMobile);

  const viewModes: { id: SceneViewMode; label: string; icon: string }[] = [
    { id: "list", label: "List", icon: "list" },
    { id: "cards", label: "Cards", icon: "layout-grid" },
    { id: "outline", label: "Outline", icon: "list-tree" },
  ];

  function setView(mode: SceneViewMode) {
    sceneViewMode.set(mode);
    selectedTab.set("Scenes");
  }

  function newScene() {
    selectedTab.set("Scenes");
    newSceneFieldVisible.set(true);
  }

  function openCompile() {
    app.commands.executeCommandById("inkwell:inkwell-open-compile-builder");
  }
</script>

<div class="inkwell-toolbar">
  {#if isScenes}
    <button
      type="button"
      class="inkwell-toolbar-btn"
      title="New scene"
      aria-label="New scene"
      onclick={newScene}
    >
      <Icon iconName="file-plus" />
    </button>

    <div class="inkwell-toolbar-group" role="tablist" aria-label="Scene view">
      {#each viewModes as mode}
        <button
          type="button"
          role="tab"
          class="inkwell-toolbar-btn"
          class:active={$sceneViewMode === mode.id}
          aria-selected={$sceneViewMode === mode.id}
          title={`${mode.label} view`}
          aria-label={`${mode.label} view`}
          onclick={() => setView(mode.id)}
        >
          <Icon iconName={mode.icon} />
        </button>
      {/each}
    </div>
  {/if}

  <span class="inkwell-toolbar-spacer"></span>

  {#if showCompile}
    <button
      type="button"
      class="inkwell-toolbar-btn inkwell-toolbar-compile"
      title="Open compile builder"
      aria-label="Open compile builder"
      onclick={openCompile}
    >
      <Icon iconName="package" />
    </button>
  {/if}
</div>

<style>
  .inkwell-toolbar {
    display: flex;
    align-items: center;
    gap: var(--size-4-2);
    padding: var(--size-4-2);
    flex-shrink: 0;
  }

  .inkwell-toolbar-spacer {
    flex: 1;
  }

  /* The three view modes cluster tighter than the toolbar's own gap. */
  .inkwell-toolbar-group {
    display: flex;
    gap: var(--size-2-1);
  }

  .inkwell-toolbar-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--size-4-7);
    height: var(--size-4-7);
    padding: 0;
    background: none;
    border: none;
    box-shadow: none;
    border-radius: var(--radius-s);
    color: var(--text-muted);
    cursor: pointer;
  }

  .inkwell-toolbar-btn :global(svg) {
    width: var(--icon-s);
    height: var(--icon-s);
  }

  .inkwell-toolbar-btn:hover {
    color: var(--text-normal);
    background: var(--background-modifier-hover);
  }

  .inkwell-toolbar-btn:focus,
  .inkwell-toolbar-btn:focus-visible {
    box-shadow: none;
  }

  /* Active view mode: a subtle pill with an accent-colored icon — not a
     heavy filled block. */
  .inkwell-toolbar-group .inkwell-toolbar-btn.active {
    color: var(--text-accent);
    background: var(--background-secondary-alt);
  }

  .inkwell-toolbar-compile {
    color: var(--text-accent);
  }

  .inkwell-toolbar-compile:hover {
    color: var(--text-accent);
    background: var(--background-modifier-hover);
  }
</style>
