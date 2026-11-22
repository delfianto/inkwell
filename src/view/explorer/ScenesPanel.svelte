<script lang="ts">
  import { newSceneFieldVisible, sceneViewMode } from "../stores";
  import { type MultipleSceneProject } from "src/model/types";
  import NewSceneField from "./NewSceneField.svelte";
  import SceneCards from "./SceneCards.svelte";
  import SceneList from "./SceneList.svelte";
  import SceneOutline from "./SceneOutline.svelte";
  import SceneTimeline from "./SceneTimeline.svelte";

  const { project }: { project: MultipleSceneProject } = $props();
</script>

{#if $newSceneFieldVisible}
  <NewSceneField />
{/if}
{#if $sceneViewMode === "cards"}
  <SceneCards />
{:else if $sceneViewMode === "outline"}
  <SceneOutline />
{:else if $sceneViewMode === "timeline"}
  {#key project.vaultPath}
    <SceneTimeline {project} />
  {/key}
{:else}
  <SceneList />
{/if}
