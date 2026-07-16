<script lang="ts">
  import { invalidFilenameCharacters, isValidFilename } from "../utils";
  import { getContext } from "svelte";
  import { selectedProject } from "src/model/stores";

  let newSceneName = $state("");
  let newSceneInput: HTMLElement | null = $state(null);

  const sceneNames =
    $selectedProject?.format === "scenes"
      ? $selectedProject.scenes.map((s) => s.title)
      : [];

  const error: string | null = $derived.by(() => {
    if (newSceneName.length === 0) {
      return null;
    }
    if (sceneNames.contains(newSceneName)) {
      return "A scene with this name already exists in this project.";
    }
    if (!isValidFilename(newSceneName)) {
      return `A scene name cannot contain the characters: ${invalidFilenameCharacters()}`;
    }
    return null;
  });

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
  <div class="new-scene-field" class:invalid={!!error}>
    <span class="new-scene-plus" aria-hidden="true">＋</span>
    <input
      id="new-scene"
      type="text"
      placeholder="New scene"
      bind:value={newSceneName}
      bind:this={newSceneInput}
      onkeydown={(e) => {
        if (e.key === "Enter") {
          onNewSceneEnter(!e.shiftKey);
        } else if (e.key === "Escape") {
          newSceneName = "";
          newSceneInput?.blur();
        }
      }}
    />
  </div>
  {#if error}
    <p class="new-scene-error">{error}</p>
  {/if}
</div>

<style>
  .new-scene-container {
    margin: 0;
    padding: var(--size-4-2) 0;
  }

  .new-scene-field {
    display: flex;
    align-items: center;
    gap: var(--size-4-1);
    width: 100%;
    background: var(--background-modifier-form-field);
    border: var(--input-border-width) solid var(--background-modifier-border);
    border-radius: var(--input-radius);
    padding: 0 var(--size-4-2);
  }

  .new-scene-field:focus-within {
    border-color: var(--background-modifier-border-focus);
    box-shadow: 0 0 0 2px var(--background-modifier-border-focus);
  }

  .new-scene-field.invalid {
    border-color: var(--text-error);
  }

  .new-scene-plus {
    flex-shrink: 0;
    color: var(--text-accent);
    font-weight: 600;
    line-height: 1;
  }

  #new-scene {
    flex: 1;
    min-width: 0;
    background: none;
    border: none;
    box-shadow: none;
    font-size: var(--font-ui-small);
    padding: var(--size-4-1) 0;
  }

  #new-scene:focus {
    box-shadow: none;
  }

  .new-scene-field.invalid #new-scene {
    color: var(--text-error);
  }

  .new-scene-error {
    color: var(--text-error);
    font-size: var(--font-ui-smaller);
    margin: var(--size-4-1) 0 0;
  }
</style>
