<script lang="ts">
  import { CodexEntryPicker } from "../modals/CodexEntryPicker";
  import { type EnrichedScene } from "./scene-items";
  import Icon from "../components/Icon.svelte";
  import { Menu } from "obsidian";
  import { type MultipleSceneProject } from "src/model/types";
  import { sortStoryScenes } from "src/model/scene-story";
  import StorySceneRow from "./StorySceneRow.svelte";
  import { updateScenesProject } from "src/model/stores";
  import { useApp } from "../utils";
  import { useStoryProject } from "./story-project.svelte";

  const { project }: { project: MultipleSceneProject } = $props();
  const app = useApp();
  const story = useStoryProject(app, () => project);
  const orders = [
    { id: "story", label: "Story order" },
    { id: "calendar", label: "Start date" },
    { id: "manuscript", label: "Manuscript order" },
  ] as const;
  type TimelineOrder = (typeof orders)[number]["id"];
  let manuscriptOrder = $state(false);
  const order = $derived(manuscriptOrder ? "manuscript" : project.storyTime ?? "story");
  const orderLabel = $derived(orders.find(({ id }) => id === order)?.label ?? orders[0].label);
  let orderMenu = $state.raw<Menu | null>(null);
  let filterButton = $state<HTMLButtonElement>();
  let filter = $state("");
  const selectedEntry = $derived(story.current.entries.find((entry) => entry.path === filter));
  const filterLabel = $derived(selectedEntry?.qualifier
    ? `${selectedEntry.title} · ${selectedEntry.qualifier}`
    : selectedEntry?.title ?? "");
  const scenes = $derived(selectedEntry
    ? story.current.appearances.get(selectedEntry.path) ?? []
    : story.current.scenes);
  const grouped = $derived(sortStoryScenes(scenes, project.storyTime));

  $effect(() => () => orderMenu?.hide());

  function changeOrder(value: TimelineOrder) {
    manuscriptOrder = value === "manuscript";
    if (manuscriptOrder) return;
    const next = value === "calendar" ? "calendar" : undefined;
    if (next === project.storyTime) return;
    updateScenesProject(project.vaultPath, (current) => {
      if (next) current.storyTime = next;
      else delete current.storyTime;
    });
  }

  function openOrderMenu(event: MouseEvent & { currentTarget: HTMLButtonElement }) {
    const button = event.currentTarget;
    const menu = new Menu();
    for (const { id, label } of orders) {
      menu.addItem((item) => item.setTitle(label).setChecked(id === order).onClick(() => changeOrder(id)));
    }
    menu.onHide(() => { orderMenu = null; });
    const bounds = button.getBoundingClientRect();
    orderMenu = menu;
    menu.showAtPosition({ x: bounds.left, y: bounds.bottom + 4 }, button.ownerDocument);
  }

  function openFilter() {
    new CodexEntryPicker(
      app,
      story.current.entries,
      (entry) => { filter = entry.path; },
      "Find a character or location…",
    ).open();
  }

  function clearFilter() {
    filter = "";
    filterButton?.focus();
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
  <div class="controls" role="group" aria-label="Timeline controls">
    <div class="control-row">
      <button type="button" class="inkwell-scene-action order-action" title={orderLabel}
        aria-label="Timeline order, {orderLabel}" aria-haspopup="menu" aria-expanded={orderMenu !== null}
        onclick={openOrderMenu}>
        <span class="control-label">{orderLabel}</span>
        <Icon iconName="chevron-down" />
      </button>
      {#if story.current.entries.length}
        <button type="button" class="inkwell-scene-action filter-action" class:filtered={!!selectedEntry}
          bind:this={filterButton}
          aria-haspopup="dialog"
          aria-label={selectedEntry ? `Change timeline filter, ${filterLabel}` : "Filter by character or location"}
          title="Filter by character or location"
          onclick={openFilter}>
          <Icon iconName="filter" />
          <span class="filter-label">Filter</span>
        </button>
      {/if}
    </div>
    {#if selectedEntry}
      <div class="filter-chip">
        <span class="control-label" title={filterLabel}>{filterLabel}</span>
        <button type="button" class="inkwell-scene-action clear-filter" title="Clear filter"
          aria-label="Clear timeline filter" onclick={clearFilter}>
          <Icon iconName="x" />
        </button>
      </div>
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
    grid-template-columns: minmax(0, 1fr);
    gap: var(--size-4-2);
    padding-top: var(--size-4-1);
    container-type: inline-size;
  }

  .controls {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--size-4-2);
    padding-bottom: var(--size-4-2);
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .control-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--size-4-1);
  }

  .order-action {
    flex-shrink: 1;
  }

  .control-label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .filtered, .filter-chip {
    color: var(--text-accent);
  }

  .filter-chip {
    display: flex;
    align-items: center;
    justify-self: start;
    gap: var(--size-4-1);
    min-width: 0;
    max-width: 100%;
    padding-inline-start: var(--size-4-2);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    background: color-mix(in srgb, var(--interactive-accent) 8%, transparent);
    font-size: var(--font-ui-smaller);
  }

  .filter-chip .clear-filter {
    height: calc(var(--inkwell-action-size) - var(--size-4-1));
    min-width: calc(var(--inkwell-action-size) - var(--size-4-1));
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
  }

  .filter-chip .clear-filter:hover {
    background: var(--background-modifier-hover);
  }

  @container (max-width: 205px) {
    .order-action, .filter-action {
      padding-inline: var(--size-4-1);
    }

    .filter-label {
      display: none;
    }
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
