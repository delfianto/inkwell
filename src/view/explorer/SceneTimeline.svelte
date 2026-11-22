<script lang="ts">
  import { CODEX_CATEGORIES, CODEX_KINDS } from "src/model/codex";
  import { type EnrichedScene } from "./scene-items";
  import { type MultipleSceneProject } from "src/model/types";
  import { sortStoryScenes } from "src/model/scene-story";
  import StorySceneRow from "./StorySceneRow.svelte";
  import { updateScenesProject } from "src/model/stores";
  import { useApp } from "../utils";
  import { useStoryProject } from "./story-project.svelte";

  const { project }: { project: MultipleSceneProject } = $props();
  const story = useStoryProject(useApp(), () => project);
  let manuscriptOrder = $state(false);
  const order = $derived(manuscriptOrder ? "manuscript" : project.storyTime ?? "story");
  let filter = $state("");
  const selectedEntry = $derived(story.current.entries.find((entry) => entry.path === filter));
  const scenes = $derived(selectedEntry
    ? story.current.appearances.get(selectedEntry.path) ?? []
    : story.current.scenes);
  const grouped = $derived(sortStoryScenes(scenes, project.storyTime));

  function changeOrder(event: Event & { currentTarget: HTMLSelectElement }) {
    const { value } = event.currentTarget;
    manuscriptOrder = value === "manuscript";
    if (manuscriptOrder) return;
    const next = value === "calendar" ? "calendar" : undefined;
    if (next === project.storyTime) return;
    updateScenesProject(project.vaultPath, (current) => {
      if (next) current.storyTime = next;
      else delete current.storyTime;
    });
  }
</script>

{#snippet rows(items: EnrichedScene[])}
  <ul>
    {#each items as scene, index (`${scene.path}-${index}`)}
      <li><StorySceneRow {scene} showWhen calendar={project.storyTime === "calendar"} /></li>
    {/each}
  </ul>
{/snippet}

<div class="timeline">
  <div class="controls">
    <select class="dropdown" aria-label="Timeline order" value={order} onchange={changeOrder}>
      <option value="story">Story order</option>
      <option value="calendar">Start date</option>
      <option value="manuscript">Manuscript order</option>
    </select>
    {#if story.current.entries.length}
      <select
        class="dropdown"
        aria-label="Filter by character or location"
        value={selectedEntry?.path ?? ""}
        onchange={(event) => (filter = event.currentTarget.value)}
      >
        <option value="">All characters and locations</option>
        {#each CODEX_KINDS as kind (kind)}
          {@const entries = story.current.entries.filter((entry) => entry.kind === kind)}
          {#if entries.length}
            <optgroup label={CODEX_CATEGORIES[kind].label}>
              {#each entries as entry (entry.path)}
                <option value={entry.path}>
                  {entry.title}{entry.qualifier ? ` · ${entry.qualifier}` : ""}
                </option>
              {/each}
            </optgroup>
          {/if}
        {/each}
      </select>
    {/if}
  </div>

  {#if !scenes.length}
    <p>{selectedEntry ? `No scenes linked to ${selectedEntry.title}.` : "No scenes yet."}</p>
  {:else if order === "manuscript"}
    {@render rows(scenes)}
  {:else}
    {#if grouped.placed.length}
      {@render rows(grouped.placed)}
    {:else}
      <p>
        Open a scene and set {project.storyTime === "calendar" ? "its start date" : "its story order"}
        in Scene details.
      </p>
    {/if}
    {#if grouped.unplaced.length}
      <h3>Unplaced</h3>
      {@render rows(grouped.unplaced)}
    {/if}
  {/if}
</div>

<style>
  .timeline {
    display: grid;
    gap: var(--size-4-2);
    padding-top: var(--size-4-1);
  }

  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: var(--size-4-1);
  }

  select {
    min-width: 0;
    max-width: 100%;
  }

  h3, p {
    margin: 0;
    font-size: var(--font-ui-small);
    color: var(--text-muted);
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  li + li {
    border-top: 1px solid var(--background-modifier-border);
  }
</style>
