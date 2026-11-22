<script lang="ts">
  import { selectedProject, waitingForSync } from "src/model/stores";
  import CodexPanel from "./CodexPanel.svelte";
  import ProjectDetails from "./ProjectDetails.svelte";
  import ProjectPicker from "./ProjectPicker.svelte";
  import ProjectToolbar from "./ProjectToolbar.svelte";
  import ScenesPanel from "./ScenesPanel.svelte";
  import { selectedTab } from "../stores";
  import Tab from "./Tab.svelte";

  let codexSelection = $state<{ projectPath: string; entryPath: string } | null>(null);

  function openCodex(entryPath?: string) {
    const projectPath = $selectedProject?.vaultPath;
    codexSelection = projectPath && entryPath ? { projectPath, entryPath } : null;
    selectedTab.set("Codex");
  }
</script>

{#if $waitingForSync}
  <div class="inkwell-sync-wait">
    <div class="inkwell-spinner"></div>
    <div class="inkwell-sync-message">
      Waiting for Obsidian Sync to complete...
    </div>
  </div>
{:else}
  <div class="inkwell-explorer">
    <ProjectPicker />
    {#if $selectedProject}
      {#if $selectedProject.format === "scenes"}
        <div class="tabs">
          <div class="tab-list">
            <Tab tab="Scenes" />
            <Tab tab="Codex" />
            <Tab tab="Project" />
          </div>
        </div>
        {#if $selectedTab === "Scenes"}
          <ProjectToolbar onCodex={openCodex} />
        {/if}
        <div class="tab-panel-container">
          {#if $selectedTab === "Scenes"}
            <ScenesPanel project={$selectedProject} />
          {:else if $selectedTab === "Codex"}
            {@const project = $selectedProject}
            {#key project.vaultPath}
              <CodexPanel {project}
                entryPath={codexSelection?.projectPath === project.vaultPath ? codexSelection.entryPath : null}
                onSelect={(entryPath) => {
                  codexSelection = entryPath ? { projectPath: project.vaultPath, entryPath } : null;
                }}
              />
            {/key}
          {:else}
            {#key $selectedProject.vaultPath}<ProjectDetails />{/key}
          {/if}
        </div>
      {:else}
        <div class="tab-panel-container">
          {#key $selectedProject.vaultPath}<ProjectDetails />{/key}
        </div>
      {/if}
    {/if}
  </div>
{/if}

<style>
  /* Fixed-height flex column: the picker / toolbar / tabs stay pinned while
     only the panel below them (the scene list, etc.) scrolls. */
  .inkwell-explorer {
    display: flex;
    flex-direction: column;
    height: 100%;
    font-size: var(--inkwell-explorer-font-size);
  }

  .tabs {
    flex-shrink: 0;
  }

  .tab-list {
    display: flex;
    margin: 0;
    border-bottom: var(--border-width) solid var(--background-modifier-border);
  }

  /* Match the surrounding chrome (and, in a sidebar, the ambient) so the scroll
     area reads as one uniform surface top-to-bottom — no darker "well" whose
     empty bottom looks unbounded. Cards provide the contrast instead. */
  .tab-panel-container {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    background: var(--background-secondary);
    padding: var(--size-4-1) var(--size-4-2);
  }

  .inkwell-sync-wait {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 2rem;
    gap: 1rem;
  }

  .inkwell-spinner {
    border: 3px solid var(--background-modifier-border);
    border-top: 3px solid var(--text-accent);
    border-radius: 50%;
    width: 24px;
    height: 24px;
    animation: spin 1s linear infinite;
  }

  .inkwell-sync-message {
    color: var(--text-muted);
    font-size: 0.8em;
    text-align: center;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
</style>
