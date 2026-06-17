<script lang="ts">
  import { getContext } from "svelte";
  import { selectedProject } from "src/model/stores";
  import { invalidFilenameCharacters, isValidFilename } from "../utils";

  let newSceneName = $state("");
  let newSceneInput: HTMLElement = $state(null);

  const sceneNames =
    $selectedProject?.format === "scenes"
      ? $selectedProject.scenes.map((s) => s.title)
      : [];

  let error: string | null = $derived(
    newSceneName.length === 0
      ? null
      : sceneNames.contains(newSceneName)
        ? "A scene with this name already exists in this project."
        : !isValidFilename(newSceneName)
          ? `A scene name cannot contain the characters: ${invalidFilenameCharacters()}`
          : null
  );

  const onNewScene: (name: string, open: boolean) => void =
    getContext("onNewScene");
  function onNewSceneEnter(open: boolean) {
    if (newSceneName.length > 0 && !error) {
      onNewScene(newSceneName, open);
      newSceneName = "";
    }
  }
</script>

<div class="new-scene-container">
  <input
    id="new-scene"
    type="text"
    placeholder="New Scene"
    bind:value={newSceneName}
    bind:this={newSceneInput}
    onkeydown={(e) => {
      if (e.key === "Enter") {
        onNewSceneEnter(!e.shiftKey);
      } else if (e.key === "Escape") {
        newSceneName = "";
        newSceneInput.blur();
      }
    }}
    class:invalid={!!error}
  />
  {#if error}
    <p>{error}</p>
  {/if}
</div>

<style>
  .new-scene-container {
    margin: 0;
    padding: var(--size-4-2) 0;
  }

  #new-scene {
    width: 100%;
    background: var(--background-modifier-form-field);
    border: var(--input-border-width) solid var(--background-modifier-border);
    border-radius: var(--input-radius);
    font-size: var(--font-ui-small);
    padding: var(--size-4-1) var(--size-4-2);
  }

  #new-scene.invalid {
    color: var(--text-error);
  }
</style>
