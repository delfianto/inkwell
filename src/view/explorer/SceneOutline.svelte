<script lang="ts">
  import { activeFile, selectElementContents, useApp } from "src/view";
  import { type EnrichedScene, enrichScenes } from "./scene-items";
  import {
    formatSceneNumber,
    groupByAct,
    type IndentedScene,
    type MultipleSceneProject,
    projects,
    projectWordCounts,
    scenePath,
    selectedProject,
  } from "src/model";
  import { getContext, onDestroy } from "svelte";
  import { Keymap, type PaneType, Platform, TFile } from "obsidian";
  import type Sortable from "sortablejs";
  import SortableList from "../sortable/SortableList.svelte";

  const app = useApp();

  let metadataTick = $state(0);
  const metadataEventRef = app.metadataCache.on("changed", (file: TFile) => {
    if (file && file.extension === "md") {
      metadataTick += 1;
    }
  });
  onDestroy(() => app.metadataCache.offref(metadataEventRef));

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

  interface OutlineRow {
    id: string;
    indent: number;
    scene: EnrichedScene;
    /** Rolled-up subtree total for an act header; null for leaf rows. */
    actTotal: number | null;
  }

  const rows: OutlineRow[] = $derived.by(() => {
    const out: OutlineRow[] = [];
    for (const act of groupByAct(scenes)) {
      const total =
        (act.header.wordCount ?? 0) +
        act.children.reduce((t, c) => t + (c.wordCount ?? 0), 0);
      out.push({
        id: act.header.name,
        indent: act.header.indent,
        scene: act.header,
        actTotal: act.children.length > 0 ? total : null,
      });
      for (const child of act.children) {
        out.push({ id: child.name, indent: child.indent, scene: child, actTotal: null });
      }
    }
    return out;
  });

  const currentProjectIndex = $derived(
    $selectedProject
      ? $projects.findIndex((p) => p.vaultPath === $selectedProject.vaultPath)
      : -1
  );

  const sortableOptions: Sortable.Options = {
    animation: 150,
    ghostClass: "scene-drag-ghost",
    chosenClass: "scene-drag-chosen",
  };

  function itemOrderChanged(newItems: OutlineRow[]) {
    if (currentProjectIndex < 0 || $selectedProject?.format !== "scenes") return;
    const newScenes: IndentedScene[] = newItems.map((r) => ({
      title: r.scene.name,
      indent: r.scene.indent,
    }));
    ($projects[currentProjectIndex] as MultipleSceneProject).scenes = newScenes;
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

<div class="inkwell-outline">
  {#if rows.length === 0}
    <p class="inkwell-outline-empty">No scenes yet.</p>
  {:else}
    <SortableList
      items={rows}
      {sortableOptions}
      onorderChanged={itemOrderChanged}
      class="inkwell-outline-list"
    >
      {#snippet children(row)}
        <div
          class="inkwell-outline-row"
          class:act={row.actTotal !== null}
          class:selected={$activeFile && $activeFile.path === row.scene.path}
          style="padding-left: calc({row.indent} * 1.25em + var(--size-4-1));"
          role="button"
          tabindex="0"
          data-scene-path={row.scene.path}
          data-scene-status={row.scene.status}
          onclick={(e) => openScene(row.scene.path, e)}
          onkeydown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && !editingPath) {
              e.preventDefault();
              openScene(row.scene.path, e);
            }
          }}
          oncontextmenu={(e) => onContext(e, row.scene.path)}
        >
          <span class="inkwell-outline-number">{formatSceneNumber(row.scene.numbering)}</span>
          <span
            class="inkwell-outline-title"
            class:editing={row.scene.path === editingPath}
            data-item-path={row.scene.path}
            data-item-name={row.scene.name}
            role={row.scene.path === editingPath ? "textbox" : undefined}
            contenteditable={row.scene.path === editingPath}
            onkeydown={row.scene.path === editingPath ? onTitleKeydown : null}
            onblur={row.scene.path === editingPath ? onTitleBlur : null}
            onclick={(e) => {
              if (row.scene.path === editingPath) e.stopPropagation();
            }}
            title={row.scene.displayName !== row.scene.name
              ? row.scene.name
              : undefined}
          >{row.scene.path === editingPath ? row.scene.name : row.scene.displayName}</span>
          {#if row.actTotal !== null}
            {#if row.actTotal > 0}
              <span class="inkwell-outline-total">{row.actTotal.toLocaleString()} w</span>
            {/if}
          {:else if typeof row.scene.wordCount === "number" && row.scene.wordCount > 0}
            <span class="inkwell-outline-wordcount">{row.scene.wordCount.toLocaleString()}</span>
          {/if}
          {#if row.scene.status}
            <span class="inkwell-scene-status"></span>
          {/if}
        </div>
      {/snippet}
    </SortableList>
  {/if}
</div>

<style>
  .inkwell-outline {
    margin: var(--size-4-1) 0;
  }

  .inkwell-outline-empty {
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
  }

  .inkwell-outline :global(.inkwell-outline-list) {
    list-style-type: none;
    padding: 0;
    margin: 0;
  }

  .inkwell-outline-row {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: var(--size-4-1);
    border-radius: var(--radius-s);
    cursor: grab;
    color: var(--nav-item-color);
    font-size: var(--nav-item-size);
    line-height: var(--line-height-tight);
    padding: var(--size-4-1) var(--size-4-2);
  }

  .inkwell-outline-row:hover,
  .inkwell-outline-row.selected {
    background-color: var(--background-secondary-alt);
    color: var(--text-normal);
  }

  .inkwell-outline-row.act {
    margin-top: var(--size-4-1);
    font-weight: 600;
    color: var(--text-normal);
  }

  .inkwell-outline-number {
    flex-shrink: 0;
    color: var(--text-faint);
    font-variant-numeric: tabular-nums;
    min-width: var(--size-4-6);
  }

  .inkwell-outline-title {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .inkwell-outline-title.editing {
    overflow: visible;
    text-overflow: clip;
    white-space: normal;
  }

  .inkwell-outline-wordcount,
  .inkwell-outline-total {
    flex-shrink: 0;
    font-variant-numeric: tabular-nums;
  }

  .inkwell-outline-wordcount {
    color: var(--text-faint);
    font-size: var(--font-smaller);
  }

  .inkwell-outline-total {
    color: var(--text-muted);
    font-size: var(--font-smaller);
  }
</style>
