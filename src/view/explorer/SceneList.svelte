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
    numberScenes,
    pluginSettings,
    projects,
    scenePath,
    selectedProject,
  } from "src/model";
  import { getContext, onDestroy } from "svelte";
  import { Keymap, Notice, type PaneType, Platform, TFile } from "obsidian";
  import Disclosure from "../components/Disclosure.svelte";
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

  const makeScenePath: (project: MultipleSceneProject, scene: string) => string =
    getContext("makeScenePath");

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
  }

  let collapsedItems: string[] = $state([]);
  // Bumped on every metadata-changed event so $derived items re-runs and
  // picks up edits to a scene's frontmatter `title`.
  let metadataTick = $state(0);

  let items: SceneItem[] = $derived(
    $selectedProject && $selectedProject.format === "scenes"
      ? itemsFromScenes($selectedProject.scenes, collapsedItems, metadataTick)
      : []
  );

  let ghostIndent = $state(0);
  let draggingIndent = $state(0);
  let draggingID: string | null = $state(null);

  function itemsFromScenes(
    indentedScenes: IndentedScene[],
    _collapsedItems: string[],
    _tick: number
  ): SceneItem[] {
    const scenes = numberScenes(indentedScenes);
    const itemsToReturn: SceneItem[] = [];
    let ignoringUntilIndent = Infinity;

    scenes.forEach(({ title, indent, numbering }, index) => {
      const hidden = indent > ignoringUntilIndent;
      if (!hidden) {
        ignoringUntilIndent = Infinity;
      }

      const collapsed = _collapsedItems.contains(title);
      if (collapsed) {
        ignoringUntilIndent = Math.min(ignoringUntilIndent, indent);
      }

      const nextScene = index < scenes.length - 1 ? scenes[index + 1] : false;
      const path = makeScenePath($selectedProject as MultipleSceneProject, title);
      const file = app.vault.getAbstractFileByPath(path);
      let status;
      let displayName = title;
      if (file && file instanceof TFile) {
        const metadata = app.metadataCache.getFileCache(file);
        if (metadata && metadata.frontmatter) {
          if (metadata.frontmatter["status"]) {
            status = `${metadata.frontmatter["status"]}`;
          }
          const fmTitle = metadata.frontmatter["title"];
          if (typeof fmTitle === "string" && fmTitle.trim().length > 0) {
            displayName = fmTitle.trim();
          }
        }
      }
      const item = {
        id: title,
        name: title,
        displayName,
        indent,
        path,
        collapsible: nextScene && nextScene.indent > indent,
        hidden,
        numbering,
        status,
      };
      itemsToReturn.push(item);
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
    let element = document.elementFromPoint(x, y);
    if (element?.id.startsWith("inkwell-scene-")) {
      element = element.parentElement;
    }
    const sPath =
      element && element instanceof HTMLElement && element.dataset.scenePath;
    if (!sPath) {
      return;
    }
    onContextClick(sPath, x, y, () => {
      if (element && element instanceof HTMLElement) {
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
      }
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
          style="padding-left: calc(({item.indent} * var(--inkwell-explorer-indent-size)) + 6px {item.collapsible ? '' : '+ var(--size-4-4)'});"
          class:selected={$activeFile && $activeFile.path === item.path}
          role="listitem"
          oncontextmenu={(e) => { e.preventDefault(); onContext(e); }}
          data-scene-path={item.path}
          data-scene-indent={item.indent}
          data-scene-name={item.name}
          data-scene-status={item.status}
        >
          {#if item.collapsible}
            <Disclosure
              collapsed={collapsedItems.contains(item.id)}
              onclick={() => collapseItem(item.id)}
            />
          {/if}
          <div
            style="width: 100%;"
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
            <div
              id={`inkwell-scene-${item.name}`}
              data-item-path={item.path}
              data-item-name={item.name}
              style="display: inline;"
              role={item.path === editingPath ? "textbox" : undefined}
              onkeydown={item.path === editingPath ? onKeydown : null}
              onblur={item.path === editingPath ? onBlur : null}
              contenteditable={item.path === editingPath}
              title={item.displayName !== item.name ? item.name : undefined}
            >
              {item.path === editingPath ? item.name : item.displayName}
            </div>
          </div>
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
    display: flex;
    flex-direction: row;
    align-items: center;
    border: var(--border-width) solid transparent;
    border-radius: var(--radius-s);
    cursor: pointer;
    color: var(--nav-item-color);
    font-size: var(--nav-item-size);
    font-weight: var(--nav-item-weight);
    line-height: var(--line-height-tight);
    padding: var(--size-4-1) var(--size-4-2);
    white-space: normal;
  }

  .scene-container.collapsible {
    display: flex;
    flex-direction: row;
    align-items: center;
    border: var(--border-width) solid transparent;
    border-radius: var(--radius-s);
    cursor: pointer;
    color: var(--nav-item-color);
    font-size: var(--nav-item-size);
    font-weight: var(--nav-item-weight);
    line-height: var(--line-height-tight);
    padding: var(--size-4-1) var(--size-4-2);
    white-space: normal;
  }

  .scene-container.hidden {
    display: none;
  }

  .scene-container *:nth-child(2) {
    margin-left: var(--size-4-2);
  }

  .selected,
  :not(.dragging) .scene-container:hover {
    background-color: var(--background-secondary-alt);
    color: var(--text-normal);
  }

  .scene-container:active {
    background-color: inherit;
    color: var(--text-muted);
  }

  .inkwell-scene-number {
    color: var(--text-muted);
    margin-right: var(--size-4-1);
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
