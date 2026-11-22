<script lang="ts">
  import { Keymap, type PaneType } from "obsidian";
  import { activeFile } from "../stores";
  import { type EnrichedScene } from "./scene-items";
  import { formatSceneNumber } from "src/model/project-utils";
  import { formatStoryRange } from "src/model/story-time";
  import { getContext } from "svelte";

  const { scene, showWhen = false, calendar = false }: {
    scene: EnrichedScene;
    showWhen?: boolean;
    calendar?: boolean;
  } = $props();
  const openFile: (path: string, paneType: PaneType | boolean) => void = getContext("onSceneClick");
  const range = $derived(formatStoryRange(scene.story.start, scene.story.finish));
  const when = $derived(calendar
    ? range ?? scene.story.storyWhen
    : scene.story.storyWhen ?? range ??
      (scene.story.storyOrder === undefined ? "" : `Order ${scene.story.storyOrder}`));
</script>

<button
  type="button"
  class="story-scene"
  aria-current={$activeFile?.path === scene.path ? "true" : undefined}
  onclick={(event) => openFile(scene.path, Keymap.isModEvent(event))}
>
  <span class="number">{formatSceneNumber(scene.numbering)}</span>
  <span class="summary">
    <span class="title">{scene.displayName}</span>
    {#if showWhen && when}<span class="when">{when}</span>{/if}
  </span>
</button>

<style>
  .story-scene {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    align-items: baseline;
    text-align: left;
    gap: var(--size-4-2);
    width: 100%;
    height: auto;
    min-height: var(--size-4-8);
    padding: var(--size-4-1) var(--size-4-2);
    background: transparent;
    box-shadow: none;
  }

  .story-scene:hover, .story-scene[aria-current="true"] {
    background: var(--background-modifier-hover);
  }

  .number, .when {
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
  }

  .number {
    font-variant-numeric: tabular-nums;
  }

  .summary {
    display: grid;
    gap: var(--size-2-1);
    white-space: normal;
    overflow-wrap: anywhere;
  }
</style>
