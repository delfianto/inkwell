<script lang="ts">
  import { Keymap, type PaneType } from "obsidian";
  import {
    projectsByTitle,
    selectedProject,
    selectedProjectPath,
  } from "../../model/stores";
  import { getContext } from "svelte";

  const openFileAtPath: (path: string, paneType: PaneType | boolean) => void =
    getContext("onSceneClick");

  const projectOptions = $derived(Object.keys($projectsByTitle));

  function projectSelected(event: Event) {
    const title = (event.target as HTMLSelectElement).value;
    if ($selectedProject && title === $selectedProject.title) {
      return;
    }
    const project = $projectsByTitle[title];
    if (!project) return;
    $selectedProjectPath = project.vaultPath;
    if (project.format === "single") {
      openFileAtPath(project.vaultPath, false);
    }
  }

  function onProjectClick(e: MouseEvent) {
    openFileAtPath($selectedProject!.vaultPath, Keymap.isModEvent(e));
  }
</script>

<div id="project-picker-container">
  {#if projectOptions.length > 0}
    <div id="project-picker">
      <div class="select" id="select-projects">
        <select
          name="projects"
          class="dropdown"
          value={$selectedProject?.title}
          onchange={projectSelected}
        >
          {#each projectOptions as projectOption}
            <option class="projectOption" value={projectOption}>{projectOption}</option>
          {/each}
        </select>
      </div>
    </div>
    {#if $selectedProject}
      <button type="button" class="current-project-path" onclick={(e) => onProjectClick(e)}>
        {$selectedProject.vaultPath}
      </button>
    {/if}
  {:else}
    <p>
      To begin, find or create a folder somewhere in your vault in which you
      would like to create your novel. Right-click it and select
      <code>Create Inkwell Project.</code>
    </p>
  {/if}
</div>

<style>
  #project-picker-container {
    margin-bottom: var(--size-4-2);
  }

  select {
    background-color: transparent;
    border: var(--input-border-width) solid var(--background-modifier-border);
    border-radius: var(--input-radius);
    padding: var(--size-4-2) var(--size-4-3);
    width: 100%;
    height: 100%;
    font-family: inherit;
    font-size: inherit;
    cursor: inherit;
    line-height: inherit;
    outline: none;
    box-shadow: none;
  }

  .select > select:hover {
    color: var(--text-normal);
    background-color: var(--background-modifier-hover);
    box-shadow: 0 0 0 2px var(--background-modifier-border-focus);
    border-color: var(--background-modifier-border-focus);
    transition:
      box-shadow 0.15s ease-in-out,
      border 0.15s ease-in-out;
  }

  .current-project-path {
    color: var(--text-faint);
    font-size: var(--font-smallest);
    padding: 0 0 var(--size-4-1) var(--size-4-3);
    background: none;
    border: none;
    box-shadow: none;
    outline: none;
    display: block;
    width: 100%;
    text-align: left;
    font-family: inherit;
  }

  .current-project-path:hover {
    color: var(--text-accent);
    cursor: pointer;
  }
</style>
