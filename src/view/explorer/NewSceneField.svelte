<script lang="ts">
  import { getContext, onMount } from "svelte";
  import { invalidFilenameCharacters, isValidFilename } from "../utils";
  import { newSceneFieldVisible } from "../stores";
  import { selectedProject } from "src/model/stores";

  let newSceneName = $state("");
  let newSceneInput: HTMLInputElement | null = $state(null);
  let creating = $state(false);

  // Shown on demand from the toolbar's ＋ action, so grab focus on mount.
  onMount(() => newSceneInput?.focus());

  function dismiss() {
    newSceneName = "";
    newSceneFieldVisible.set(false);
  }

  const sceneNames = $derived(
    $selectedProject?.format === "scenes"
      ? $selectedProject.scenes.map((s) => s.title)
      : [],
  );

  const error: string | null = $derived.by(() => {
    const name = newSceneName.trim();
    if (name.length === 0) {
      return null;
    }
    if (sceneNames.contains(name)) {
      return "A scene with this name already exists in this project.";
    }
    if (!isValidFilename(name) || name === "." || name === "..") {
      return `A scene name cannot contain the characters: ${invalidFilenameCharacters()}`;
    }
    return null;
  });

  const onNewScene: (name: string, open: boolean) => Promise<boolean> =
    getContext("onNewScene");
  async function create(open: boolean) {
    const name = newSceneName.trim();
    if (!name || error || creating) return;
    creating = true;
    try {
      if (await onNewScene(name, open)) {
        if (open) dismiss();
        else newSceneName = "";
      }
    } finally {
      creating = false;
      if (!open) newSceneInput?.focus();
    }
  }
</script>

<form class="new-scene-container" onsubmit={(event) => {
  event.preventDefault();
  void create(true);
}}>
  <div class="new-scene-field" class:invalid={!!error}>
    <span class="new-scene-plus" aria-hidden="true">＋</span>
    <input
      id="new-scene"
      type="text"
      placeholder="New scene"
      aria-label="Scene title"
      readonly={creating}
      bind:value={newSceneName}
      bind:this={newSceneInput}
      onkeydown={(e) => {
        if (e.key === "Enter" && e.shiftKey) {
          e.preventDefault();
          void create(false);
        } else if (e.key === "Escape" && !creating) {
          dismiss();
        }
      }}
      onblur={() => {
        if (newSceneName.length === 0) dismiss();
      }}
    />
    <button type="submit" disabled={creating || !!error || !newSceneName.trim()}>
      {creating ? "Creating…" : "Create"}
    </button>
  </div>
  {#if error}
    <p class="new-scene-error">{error}</p>
  {/if}
</form>

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

  .new-scene-field button {
    flex-shrink: 0;
    height: var(--size-4-6);
    margin: var(--size-2-1) 0;
    font-size: var(--font-ui-smaller);
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
