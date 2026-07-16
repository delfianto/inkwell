<script lang="ts">
  import { newSceneFieldVisible, sceneViewMode } from "../stores";
  import NewSceneField from "./NewSceneField.svelte";
  import SceneCards from "./SceneCards.svelte";
  import SceneList from "./SceneList.svelte";
  import SceneOutline from "./SceneOutline.svelte";
</script>

{#if $sceneViewMode === "cards"}
  <SceneCards />
{:else if $sceneViewMode === "outline"}
  <SceneOutline />
{:else}
  <SceneList />
{/if}
{#if $newSceneFieldVisible}
  <NewSceneField />
{/if}
