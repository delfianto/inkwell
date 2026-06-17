<script lang="ts">
  import CompileView from "../compile/CompileView.svelte";

  import { selectedProject } from "src/model/stores";
  import { selectedTab } from "../stores";
  import { waitingForSync } from "src/model/stores";

  import NewSceneField from "./NewSceneField.svelte";
  import ProjectPicker from "./ProjectPicker.svelte";
  import SceneList from "./SceneList.svelte";
  import ProjectDetails from "./ProjectDetails.svelte";
  import Tab from "./Tab.svelte";

  $effect(() => {
    if (
      $selectedProject &&
      $selectedProject.format === "single" &&
      $selectedTab === "Scenes"
    ) {
      $selectedTab = "Project";
    }
  });
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
    {#if $selectedProject && $selectedProject.format === "scenes"}
      <div>
        <div class="tabs">
          <div class="tab-list">
            <Tab tab="Scenes" />
            <Tab tab="Project" />
            <Tab tab="Compile" />
          </div>
        </div>
        {#if $selectedTab === "Scenes"}
          <div class="tab-panel-container">
            <SceneList />
            <NewSceneField />
          </div>
        {:else if $selectedTab === "Project"}
          <div class="tab-panel-container">
            <ProjectDetails />
          </div>
        {:else}
          <div class="tab-panel-container disconnected">
            <CompileView />
          </div>
        {/if}
      </div>
    {:else}
      <div>
        <div class="tabs">
          <div class="tab-list">
            <Tab tab="Project" />
            <Tab tab="Compile" />
          </div>
        </div>
        {#if $selectedTab === "Project"}
          <div class="tab-panel-container">
            <ProjectDetails />
          </div>
        {:else}
          <div class="tab-panel-container">
            <CompileView />
          </div>
        {/if}
      </div>
    {/if}
  </div>
{/if}

<style>
  .inkwell-explorer {
    font-size: var(--inkwell-explorer-font-size);
  }

  .tab-list {
    margin: 0;
    font-size: 0; /* To remove spacing between tabs */
  }

  .tab-panel-container {
    background: var(--background-primary);
    padding: var(--size-4-1) var(--size-4-2);
  }

  .tab-panel-container.disconnected {
    background: none;
    padding: 0;
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
