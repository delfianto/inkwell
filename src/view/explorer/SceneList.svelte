<script lang="ts">
  /* Note: VSCode doesn't love the use of generics + snippets here.
     It's valid svelte and doesn't typeerror on compile.
  */
  import {
    activeFile,
    addAll,
    addScene,
    ignoreAll,
    ignoreScene,
    selectElementContents,
    type UndoManager,
    useApp,
  } from "src/view";
  import {
    formatSceneNumber,
    type IndentedScene,
    type MultipleSceneProject,
    pluginSettings,
    projects,
    type ProjectWordCounts,
    projectWordCounts,
    scenePath,
    selectedProject,
  } from "src/model";
  import { getContext, onDestroy } from "svelte";
  import { Keymap, Notice, type PaneType, Platform, TFile } from "obsidian";
  import Disclosure from "../components/Disclosure.svelte";
  import { enrichScenes } from "./scene-items";
  import type Sortable from "sortablejs";
  import SortableList from "../sortable/SortableList.svelte";

  const app = useApp();

  let currentProjectIndex = $state(-1);
  $effect(() => {
    if ($selectedProject) {
      currentProjectIndex = $projects.findIndex(
        (d) => d.vaultPath === $selectedProject.vaultPath
      );
    }
  });

  interface SceneItem {
    id: string;
    name: string;
    displayName: string;
    path: string;
    indent: number;
    collapsible: boolean;
    hidden: boolean;
    numbering: number[];
    status: string | undefined;
    wordCount: number | undefined;
  }

  let collapsedItems: string[] = $state([]);
  // Bumped on every metadata-changed event so $derived items re-runs and
  // picks up edits to a scene's frontmatter `title`.
  let metadataTick = $state(0);

  let items: SceneItem[] = $derived(
    $selectedProject && $selectedProject.format === "scenes"
      ? itemsFromScenes(
          $selectedProject,
          collapsedItems,
          metadataTick,
          $projectWordCounts
        )
      : []
  );

  let ghostIndent = $state(0);
  let draggingIndent = $state(0);
  let draggingID: string | null = $state(null);

  function itemsFromScenes(
    project: MultipleSceneProject,
    _collapsedItems: string[],
    _tick: number,
    wordCounts: ProjectWordCounts
  ): SceneItem[] {
    const scenes = enrichScenes(app, project, wordCounts);
    const itemsToReturn: SceneItem[] = [];
    let ignoringUntilIndent = Infinity;

    scenes.forEach((scene, index) => {
      const { name, indent } = scene;
      const hidden = indent > ignoringUntilIndent;
      if (!hidden) {
        ignoringUntilIndent = Infinity;
      }

      const collapsed = _collapsedItems.contains(name);
      if (collapsed) {
        ignoringUntilIndent = Math.min(ignoringUntilIndent, indent);
      }

      const nextScene = index < scenes.length - 1 ? scenes[index + 1] : false;
      itemsToReturn.push({
        id: name,
        name,
        displayName: scene.displayName,
        indent,
        path: scene.path,
        collapsible: nextScene && nextScene.indent > indent,
        hidden,
        numbering: scene.numbering,
        status: scene.status,
        wordCount: scene.wordCount,
      });
    });

    return itemsToReturn;
  }

  // Re-render scene labels when frontmatter changes (e.g. user edits a scene's
  // `title` property). Filtered to .md files to avoid waking up on unrelated
  // metadata events.
  const metadataEventRef = app.metadataCache.on("changed", (file: TFile) => {
    if (file && file.extension === "md") {
      metadataTick += 1;
    }
  });
  onDestroy(() => app.metadataCache.offref(metadataEventRef));

  let isSorting = $state(false);
  const sortableOptions: Sortable.Options = {
    animation: 150,
    ghostClass: "scene-drag-ghost",
    chosenClass: "scene-drag-chosen",
    dragClass: "scene-drag-dragging",
    fallbackClass: "scene-drag-fallback",
    onStart: () => {
      isSorting = true;
    },
    onEnd: () => {
      isSorting = false;
    },
  };

  function itemOrderChanged(newItems: SceneItem[]) {
    if (currentProjectIndex >= 0 && $selectedProject!.format === "scenes") {
      const scenes: IndentedScene[] = newItems.map((d) => ({
        title: d.name,
        indent: d.name === draggingID ? draggingIndent : d.indent,
      }));
      ($projects[currentProjectIndex] as MultipleSceneProject).scenes = scenes;

      sceneHistory = [
        {
          projectVaultPath: $projects[currentProjectIndex].vaultPath,
          scenes: structuredClone(scenes),
        },
        ...sceneHistory,
      ].slice(0, 20);
      undoIndex = 0;

      if ($activeFile) {
        onSceneClick($activeFile.path, false);
      }
    }
  }

  function itemIndentChanged(detail: {
    itemID: string;
    itemIndex: number;
    newIndent: number;
    indentWidth: number;
  }) {
    draggingID = detail.itemID;
    draggingIndent = detail.newIndent || 0;
    ghostIndent = draggingIndent * detail.indentWidth;
  }

  function collapseItem(itemID: string) {
    collapsedItems = collapsedItems.contains(itemID)
      ? collapsedItems.filter((i) => i !== itemID)
      : [...collapsedItems, itemID];
  }

  const onSceneClick: (path: string, paneType: boolean | PaneType) => void =
    getContext("onSceneClick");
  function onItemClick(item: SceneItem, event: MouseEvent) {
    if (item.path) {
      if (
        Platform.isMobile &&
        item.collapsible &&
        item.path === $activeFile!.path
      ) {
        collapseItem(item.id);
      } else {
        onSceneClick(item.path, Keymap.isModEvent(event));
      }
    }
  }

  let editingPath: string | null = $state(null);
  let originalName: string | null = $state(null);

  const onContextClick: (
    path: string,
    x: number,
    y: number,
    onRename: () => void
  ) => void = getContext("onContextClick");
  function onContext(event: MouseEvent) {
    if (Platform.isMobileApp) {
      return;
    }
    const { x, y } = event;
    const target = document.elementFromPoint(x, y);
    // Walk up to the row container regardless of which child was clicked
    // (title, word count, status bullet, …).
    const element =
      target instanceof HTMLElement
        ? target.closest<HTMLElement>("[data-scene-path]")
        : null;
    const sPath = element?.dataset.scenePath;
    if (!element || !sPath) {
      return;
    }
    onContextClick(sPath, x, y, () => {
      const path = element.dataset.scenePath;
      editingPath = path ?? null;
      const innerElement = activeDocument.querySelector(
        `[data-item-path='${path}']`
      );
      if (!(innerElement instanceof HTMLElement)) {
        return;
      }
      originalName = innerElement.dataset.itemName ?? null;
      setTimeout(() => selectElementContents(innerElement), 0);
    });
  }

  function onKeydown(event: KeyboardEvent) {
    if (
      editingPath &&
      event.target instanceof HTMLElement &&
      $selectedProject!.format === "scenes"
    ) {
      const newName = event.target.textContent;
      if (event.key === "Enter") {
        const newPath = scenePath(newName, $selectedProject!, app.vault);
        const file = app.vault.getAbstractFileByPath(editingPath);
        app.fileManager.renameFile(file!, newPath);
        editingPath = null;
        originalName = null;
        return false;
      } else if (event.key === "Escape") {
        event.target.blur();
        return false;
      }
    }
    return true;
  }

  function onBlur(event: FocusEvent) {
    if (event.target instanceof HTMLElement) {
      event.target.textContent = originalName;
    }
    editingPath = null;
    originalName = null;
  }

  function doWithUnknown(fileName: string, action: "add" | "ignore") {
    if (!$selectedProject) return;
    if (action === "add") {
      addScene(fileName);
    } else {
      ignoreScene(fileName);
    }
  }

  function doWithAll(action: "add" | "ignore") {
    if (!$selectedProject) return;
    if (action === "add") {
      addAll();
    } else {
      ignoreAll();
    }
  }

  function numberLabel(item: SceneItem): string {
    return formatSceneNumber(item.numbering);
  }

  function wordCountLabel(item: SceneItem): string | null {
    return typeof item.wordCount === "number" && item.wordCount > 0
      ? item.wordCount.toLocaleString()
      : null;
  }

  // Undo/Redo
  const undoManager = getContext("undoManager") as UndoManager;
  let sceneHistory: { projectVaultPath: string; scenes: IndentedScene[] }[] = $state([]);
  let undoIndex = $state(0);

  undoManager.on((type, _evt, _ctx) => {
    const oldIndex = undoIndex;
    undoIndex =
      type === "undo"
        ? Math.max(Math.min(undoIndex + 1, sceneHistory.length - 1), 0)
        : Math.max(undoIndex - 1, 0);
    const newValue = sceneHistory[undoIndex];
    if (
      oldIndex !== undoIndex &&
      newValue &&
      currentProjectIndex >= 0 &&
      newValue.projectVaultPath === $projects[currentProjectIndex].vaultPath &&
      $projects[currentProjectIndex].format === "scenes"
    ) {
      const newScenes = sceneHistory[undoIndex].scenes;
      ($projects[currentProjectIndex] as MultipleSceneProject).scenes = newScenes;

      new Notice(`${type === "undo" ? "Undid" : "Redid"} scene reordering`);
    }
    return false;
  });

  const unsubscribe = selectedProject.subscribe((project) => {
    if (!project) {
      return;
    }
    sceneHistory = sceneHistory.filter(
      (s) => s.projectVaultPath === project.vaultPath
    );
    if (
      project.format === "scenes" &&
      (sceneHistory.length === 0 ||
        sceneHistory[0].projectVaultPath !== project.vaultPath)
    ) {
      sceneHistory = [
        {
          projectVaultPath: project.vaultPath,
          scenes: structuredClone((project as MultipleSceneProject).scenes),
        },
      ];
      undoIndex = 0;
    }
  });

  onDestroy(unsubscribe);
</script>

<div>
  <div
    id="scene-list"
    class:dragging={isSorting}
    style="--ghost-indent: {ghostIndent}px"
  >
    <SortableList
      trackIndents
      bind:items
      onorderChanged={itemOrderChanged}
      onindentChanged={itemIndentChanged}
      {sortableOptions}
      class="sortable-scene-list"
    >
      {#snippet children(item)}
        <div
          class="scene-container{item.hidden ? ' hidden' : ''}{item.collapsible ? ' collapsible' : ''}"
          style="padding-left: calc(({item.indent} * var(--inkwell-explorer-indent-size)) + var(--size-4-2));"
          class:selected={$activeFile && $activeFile.path === item.path}
          role="listitem"
          oncontextmenu={(e) => { e.preventDefault(); onContext(e); }}
          data-scene-path={item.path}
          data-scene-indent={item.indent}
          data-scene-name={item.name}
          data-scene-status={item.status}
        >
          <span class="inkwell-scene-grip" aria-hidden="true">⠿</span>
          <span class="inkwell-scene-lead">
            {#if item.collapsible}
              <Disclosure
                collapsed={collapsedItems.contains(item.id)}
                onclick={() => collapseItem(item.id)}
              />
            {/if}
          </span>
          <div
            class="inkwell-scene-click"
            role="button"
            tabindex="0"
            data-scene-path={item.path}
            onclick={(e) =>
              typeof item.path === "string" ? onItemClick(item, e) : {}}
            onkeydown={(e) => {
              if (e.key === "Enter" && typeof item.path === "string") onItemClick(item, e as unknown as MouseEvent);
            }}
          >
            {#if $pluginSettings.numberScenes}
              <span class="inkwell-scene-number">{numberLabel(item)}</span>
            {/if}
            <span
              id={`inkwell-scene-${item.name}`}
              class="inkwell-scene-title"
              class:editing={item.path === editingPath}
              data-item-path={item.path}
              data-item-name={item.name}
              role={item.path === editingPath ? "textbox" : undefined}
              onkeydown={item.path === editingPath ? onKeydown : null}
              onblur={item.path === editingPath ? onBlur : null}
              contenteditable={item.path === editingPath}
              title={item.displayName !== item.name ? item.name : undefined}
            >{item.path === editingPath ? item.name : item.displayName}</span>
          </div>
          {#if wordCountLabel(item)}
            <span class="inkwell-scene-wordcount">{wordCountLabel(item)}</span>
          {/if}
          {#if item.status}
            <span class="inkwell-scene-status" title={`status: ${item.status}`}
            ></span>
          {/if}
        </div>
      {/snippet}
    </SortableList>
  </div>
  {#if $selectedProject && $selectedProject.format === "scenes" && $selectedProject.unknownFiles.length > 0}
    <div id="inkwell-unknown-files-wizard">
      <div class="inkwell-unknown-inner">
        <p class="inkwell-unknown-explanation">
          Inkwell has found {$selectedProject.unknownFiles.length} new file{$selectedProject
            .unknownFiles.length === 1
            ? ""
            : "s"} in your scenes folder.
        </p>
        <div>
          <button class="inkwell-unknown-add" onclick={() => doWithAll("add")}
            >Add all</button
          >
          <button
            class="inkwell-unknown-ignore"
            onclick={() => doWithAll("ignore")}>Ignore all</button
          >
        </div>
        <ul>
          {#each $selectedProject.unknownFiles as fileName}
            <li>
              <div class="inkwell-unknown-file">
                <span>{fileName}</span>
                <div>
                  <button
                    class="inkwell-unknown-add"
                    onclick={() => doWithUnknown(fileName, "add")}>Add</button
                  >
                  <button
                    class="inkwell-unknown-ignore"
                    onclick={() => doWithUnknown(fileName, "ignore")}
                    >Ignore</button
                  >
                </div>
              </div>
            </li>
          {/each}
        </ul>
      </div>
    </div>
  {/if}
</div>

<style>
  :global(.group) {
    margin-left: var(--size-4-2);
  }

  #scene-list {
    margin: var(--size-4-1) 0;
  }

  #scene-list :global(.sortable-scene-list) {
    list-style-type: none;
    padding: 0;
    margin: 0;
  }

  .scene-container {
    position: relative;
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: var(--size-4-1);
    border: var(--border-width) solid transparent;
    border-radius: var(--radius-s);
    cursor: grab;
    color: var(--nav-item-color);
    font-size: var(--nav-item-size);
    font-weight: var(--nav-item-weight);
    line-height: var(--line-height-tight);
    padding: var(--size-4-1) var(--size-4-2);
  }

  .scene-container.hidden {
    display: none;
  }

  /* Discoverable drag: a grab handle fades in over the left gutter on hover
     (purely a signifier — the whole row is the SortableJS drag target). */
  .inkwell-scene-grip {
    position: absolute;
    left: var(--size-2-1);
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-faint);
    font-size: var(--font-smaller);
    line-height: 1;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.1s ease-in-out;
  }

  :not(.dragging) .scene-container:hover .inkwell-scene-grip {
    opacity: 1;
  }

  /* Fixed-width lead gutter holds the disclosure chevron (when collapsible) so
     numbers/titles align whether or not a row has children. */
  .inkwell-scene-lead {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    width: var(--size-4-3);
  }

  .inkwell-scene-click {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: baseline;
    gap: var(--size-4-1);
  }

  .inkwell-scene-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .inkwell-scene-title.editing {
    overflow: visible;
    text-overflow: clip;
    white-space: normal;
  }

  .inkwell-scene-wordcount {
    flex-shrink: 0;
    color: var(--text-faint);
    font-size: var(--font-smaller);
    font-variant-numeric: tabular-nums;
  }

  .selected,
  :not(.dragging) .scene-container:hover {
    background-color: var(--background-secondary-alt);
    color: var(--text-normal);
  }

  .selected .inkwell-scene-wordcount,
  :not(.dragging) .scene-container:hover .inkwell-scene-wordcount {
    color: var(--text-muted);
  }

  .scene-container:active {
    cursor: grabbing;
  }

  .inkwell-scene-number {
    flex-shrink: 0;
    color: var(--text-muted);
    font-weight: bold;
  }

  .inkwell-scene-number::after {
    content: ".";
  }

  #inkwell-unknown-files-wizard {
    border-top: var(--border-width) solid var(--text-muted);
    padding: var(--size-4-2) 0;
  }

  .inkwell-unknown-inner {
    border-left: var(--size-2-1) solid var(--text-accent);
    padding: 0 0 0 var(--size-4-1);
  }

  .inkwell-unknown-explanation {
    color: var(--text-muted);
    font-size: 1em;
  }

  #inkwell-unknown-files-wizard ul {
    list-style-type: none;
    padding: 0 0 0 var(--size-4-2);
  }

  .inkwell-unknown-file {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
  }

  .inkwell-unknown-add {
    color: var(--text-accent);
    font-weight: bold;
  }

  .inkwell-unknown-ignore {
    color: var(--text-muted);
    font-weight: bold;
  }

  :global(.scene-drag-ghost) {
    background-color: var(--interactive-accent-hover);
    color: var(--text-on-accent);
    margin-left: var(--ghost-indent);
  }
</style>
