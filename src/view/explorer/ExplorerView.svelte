<script lang="ts">
  import { selectedProject, waitingForSync } from "src/model/stores";
  import ProjectDetails from "./ProjectDetails.svelte";
  import ProjectPicker from "./ProjectPicker.svelte";
  import ProjectToolbar from "./ProjectToolbar.svelte";
  import ScenesPanel from "./ScenesPanel.svelte";
  import { selectedTab } from "../stores";
  import Tab from "./Tab.svelte";
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
      <ProjectToolbar />
      {#if $selectedProject.format === "scenes"}
        <div class="tabs">
          <div class="tab-list">
            <Tab tab="Scenes" />
            <Tab tab="Project" />
          </div>
        </div>
        {#if $selectedTab === "Scenes"}
          <div class="tab-panel-container">
            <ScenesPanel />
          </div>
        {:else}
          <div class="tab-panel-container">
            <ProjectDetails />
          </div>
        {/if}
      {:else}
        <div class="tab-panel-container">
          <ProjectDetails />
        </div>
      {/if}
    {/if}
  </div>
{/if}

<style>
  .inkwell-explorer {
    font-size: var(--inkwell-explorer-font-size);
  }

  .tab-list {
    display: flex;
    margin: 0;
    border-bottom: var(--border-width) solid var(--background-modifier-border);
  }

  .tab-panel-container {
    background: var(--background-primary);
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
