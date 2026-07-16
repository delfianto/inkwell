<script lang="ts">
  import { Keymap, type PaneType } from "obsidian";
  import {
    projectsByTitle,
    selectedProject,
    selectedProjectPath,
  } from "../../model/stores";
  import { getContext } from "svelte";
  import Icon from "../components/Icon.svelte";
  import { useApp } from "../utils";

  const app = useApp();

  const openFileAtPath: (path: string, paneType: PaneType | boolean) => void =
    getContext("onSceneClick");

  function newProject() {
    // Full id: plugin id + the command id from commands/project.ts.
    app.commands.executeCommandById("inkwell:inkwell-create-project");
  }

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
    <div class="inkwell-empty-state">
      <div class="inkwell-empty-icon"><Icon iconName="book-text" /></div>
      <h3>No projects yet</h3>
      <p class="inkwell-empty-text">
        An Inkwell project turns a folder into a manuscript — scenes, word
        counts, and compile.
      </p>
      <button type="button" class="mod-cta" onclick={newProject}
        >＋ New project…</button
      >
      <p class="inkwell-empty-hint">
        or right-click any folder → <code>Create Inkwell Project</code>
      </p>
    </div>
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

  .inkwell-empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: var(--size-4-8) var(--size-4-4);
    gap: var(--size-4-2);
  }

  .inkwell-empty-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--size-4-16);
    height: var(--size-4-16);
    border-radius: 50%;
    background: var(--background-secondary-alt);
    color: var(--text-accent);
    margin-bottom: var(--size-4-1);
  }

  .inkwell-empty-icon :global(svg) {
    width: var(--icon-l);
    height: var(--icon-l);
  }

  .inkwell-empty-state h3 {
    margin: 0;
    font-size: var(--font-ui-medium);
    color: var(--text-normal);
  }

  .inkwell-empty-text {
    margin: 0;
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
    line-height: var(--line-height-tight);
  }

  .inkwell-empty-state .mod-cta {
    margin-top: var(--size-4-2);
  }

  .inkwell-empty-hint {
    margin: var(--size-4-1) 0 0;
    color: var(--text-faint);
    font-size: var(--font-ui-smaller);
  }
</style>
