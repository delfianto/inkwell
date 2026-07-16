<script lang="ts">
  import { activeFile, selectElementContents, useApp } from "src/view";
  import { type EnrichedScene, enrichScenes } from "./scene-items";
  import {
    formatSceneNumber,
    groupByAct,
    type MultipleSceneProject,
    projectWordCounts,
    scenePath,
    selectedProject,
  } from "src/model";
  import { getContext, onDestroy } from "svelte";
  import { Keymap, type PaneType, Platform, TFile } from "obsidian";
  import Disclosure from "../components/Disclosure.svelte";

  const app = useApp();

  // Bumped on metadata changes so the derivation re-reads status/title/synopsis.
  let metadataTick = $state(0);
  const metadataEventRef = app.metadataCache.on("changed", (file: TFile) => {
    if (file && file.extension === "md") {
      metadataTick += 1;
    }
  });
  onDestroy(() => app.metadataCache.offref(metadataEventRef));

  let collapsedActs: string[] = $state([]);

  function computeScenes(
    project: MultipleSceneProject,
    _tick: number
  ): EnrichedScene[] {
    return enrichScenes(app, project, $projectWordCounts);
  }

  const scenes = $derived(
    $selectedProject && $selectedProject.format === "scenes"
      ? computeScenes($selectedProject, metadataTick)
      : []
  );
  // Acts only make sense when the project actually nests scenes; a flat project
  // renders as a single reflowing grid of cards with no headers.
  const hasNesting = $derived(scenes.some((s) => s.indent > 0));
  const acts = $derived(groupByAct(scenes));

  function actWordCount(children: EnrichedScene[]): number {
    return children.reduce((total, c) => total + (c.wordCount ?? 0), 0);
  }

  function toggleAct(name: string) {
    collapsedActs = collapsedActs.contains(name)
      ? collapsedActs.filter((n) => n !== name)
      : [...collapsedActs, name];
  }

  const onSceneClick: (path: string, paneType: boolean | PaneType) => void =
    getContext("onSceneClick");
  const onContextClick: (
    path: string,
    x: number,
    y: number,
    onRename: () => void
  ) => void = getContext("onContextClick");

  function openScene(path: string, event: MouseEvent | KeyboardEvent) {
    if (editingPath) return;
    onSceneClick(path, Keymap.isModEvent(event));
  }

  // ---- Inline rename (mirrors SceneList's contenteditable flow) ----
  let editingPath: string | null = $state(null);
  let originalName: string | null = $state(null);

  function onContext(event: MouseEvent, path: string) {
    if (Platform.isMobileApp) return;
    event.preventDefault();
    onContextClick(path, event.x, event.y, () => {
      editingPath = path;
      const el = activeDocument.querySelector(`[data-item-path='${path}']`);
      if (el instanceof HTMLElement) {
        originalName = el.dataset.itemName ?? null;
        setTimeout(() => selectElementContents(el), 0);
      }
    });
  }

  function onTitleKeydown(event: KeyboardEvent) {
    if (!editingPath || !(event.target instanceof HTMLElement)) return;
    if (event.key === "Enter") {
      event.preventDefault();
      const newName = event.target.textContent ?? "";
      const newPath = scenePath(
        newName,
        $selectedProject as MultipleSceneProject,
        app.vault
      );
      const file = app.vault.getAbstractFileByPath(editingPath);
      if (file) app.fileManager.renameFile(file, newPath);
      editingPath = null;
      originalName = null;
    } else if (event.key === "Escape") {
      event.target.blur();
    }
  }

  function onTitleBlur(event: FocusEvent) {
    if (event.target instanceof HTMLElement && originalName !== null) {
      event.target.textContent = originalName;
    }
    editingPath = null;
    originalName = null;
  }
</script>

{#snippet card(scene: EnrichedScene)}
  <div
    class="inkwell-card"
    class:selected={$activeFile && $activeFile.path === scene.path}
    role="button"
    tabindex="0"
    data-scene-path={scene.path}
    data-scene-status={scene.status}
    onclick={(e) => openScene(scene.path, e)}
    onkeydown={(e) => {
      if ((e.key === "Enter" || e.key === " ") && !editingPath) {
        e.preventDefault();
        openScene(scene.path, e);
      }
    }}
    oncontextmenu={(e) => onContext(e, scene.path)}
  >
    <div class="inkwell-card-head">
      <span class="inkwell-card-number">{formatSceneNumber(scene.numbering)}</span>
      <span
        class="inkwell-card-title"
        class:editing={scene.path === editingPath}
        data-item-path={scene.path}
        data-item-name={scene.name}
        role={scene.path === editingPath ? "textbox" : undefined}
        contenteditable={scene.path === editingPath}
        onkeydown={scene.path === editingPath ? onTitleKeydown : null}
        onblur={scene.path === editingPath ? onTitleBlur : null}
        onclick={(e) => {
          if (scene.path === editingPath) e.stopPropagation();
        }}
        title={scene.displayName !== scene.name ? scene.name : undefined}
      >{scene.path === editingPath ? scene.name : scene.displayName}</span>
    </div>
    {#if scene.synopsis}
      <p class="inkwell-card-synopsis">{scene.synopsis}</p>
    {/if}
    <div class="inkwell-card-foot">
      {#if scene.status}
        <span class="inkwell-scene-status"></span>
        <span class="inkwell-card-status-label">{scene.status}</span>
      {/if}
      {#if typeof scene.wordCount === "number" && scene.wordCount > 0}
        <span class="inkwell-card-wordcount">{scene.wordCount.toLocaleString()} w</span>
      {/if}
    </div>
  </div>
{/snippet}

<div class="inkwell-cards">
  {#if scenes.length === 0}
    <p class="inkwell-cards-empty">No scenes yet.</p>
  {:else if !hasNesting}
    <div class="inkwell-card-grid">
      {#each scenes as scene (scene.name)}
        {@render card(scene)}
      {/each}
    </div>
  {:else}
    {#each acts as act (act.header.name)}
      {@const collapsed = collapsedActs.contains(act.header.name)}
      <div class="inkwell-act">
        <div class="inkwell-act-header">
          <button
            type="button"
            class="inkwell-act-toggle"
            onclick={() => toggleAct(act.header.name)}
          >
            <Disclosure {collapsed} />
            <span class="inkwell-act-title">{act.header.displayName}</span>
          </button>
          <span class="inkwell-act-meta">
            {act.children.length} scene{act.children.length === 1 ? "" : "s"}
            {#if actWordCount(act.children) > 0}
              · {actWordCount(act.children).toLocaleString()} w
            {/if}
          </span>
        </div>
        {#if !collapsed && act.children.length > 0}
          <div class="inkwell-card-grid">
            {#each act.children as scene (scene.name)}
              {@render card(scene)}
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  {/if}
</div>

<style>
  .inkwell-cards {
    padding: var(--size-4-1) 0 var(--size-4-2);
  }

  .inkwell-cards-empty {
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
  }

  .inkwell-act {
    margin-bottom: var(--size-4-3);
  }

  .inkwell-act-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--size-4-2);
    padding: var(--size-4-1) 0;
    margin-top: var(--size-4-2);
  }

  .inkwell-act-toggle {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: var(--size-4-2);
    flex: 1;
    min-width: 0;
    background: none;
    border: none;
    box-shadow: none;
    padding: 0;
    cursor: pointer;
    text-align: left;
  }

  .inkwell-act-toggle:hover {
    background: none;
    box-shadow: none;
  }

  .inkwell-act-title {
    font-weight: 600;
    color: var(--text-normal);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .inkwell-act-meta {
    flex-shrink: 0;
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
    white-space: nowrap;
  }

  .inkwell-card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: var(--size-4-2);
  }

  .inkwell-card {
    display: flex;
    flex-direction: column;
    gap: var(--size-4-1);
    min-height: 92px;
    padding: var(--size-4-2);
    background: var(--background-secondary);
    border: var(--border-width) solid var(--background-modifier-border);
    border-radius: var(--radius-m);
    cursor: pointer;
    transition:
      border-color 0.1s ease-in-out,
      background-color 0.1s ease-in-out;
  }

  .inkwell-card:hover {
    background: var(--background-modifier-hover);
  }

  .inkwell-card.selected {
    border-color: var(--interactive-accent);
    background: var(--background-secondary-alt);
  }

  .inkwell-card-head {
    display: flex;
    align-items: baseline;
    gap: var(--size-4-1);
  }

  .inkwell-card-number {
    flex-shrink: 0;
    color: var(--text-faint);
    font-variant-numeric: tabular-nums;
  }

  .inkwell-card-title {
    font-weight: 600;
    color: var(--text-normal);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .inkwell-card-title.editing {
    overflow: visible;
    text-overflow: clip;
    white-space: normal;
  }

  .inkwell-card-synopsis {
    flex: 1;
    margin: 0;
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
    line-height: var(--line-height-tight);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .inkwell-card-foot {
    display: flex;
    align-items: center;
    gap: var(--size-4-1);
    margin-top: auto;
  }

  .inkwell-card-status-label {
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
    text-transform: capitalize;
  }

  .inkwell-card-wordcount {
    margin-left: auto;
    flex-shrink: 0;
    color: var(--text-faint);
    font-size: var(--font-ui-smaller);
    font-variant-numeric: tabular-nums;
  }
</style>
