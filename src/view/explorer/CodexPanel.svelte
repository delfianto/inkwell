<script lang="ts">
  import { CODEX_CATEGORIES, CODEX_KINDS, codexFolderPath, type CodexKind, ensureCodexFolders } from "src/model/codex";
  import { getContext, onMount } from "svelte";
  import { Keymap, type PaneType, TFile } from "obsidian";
  import { CodexEditorModal } from "../modals/CodexEditorModal";
  import { CreateCodexEntryModal } from "../modals/CreateCodexEntryModal";
  import Icon from "../components/Icon.svelte";
  import { type MultipleSceneProject } from "src/model/types";
  import StorySceneRow from "./StorySceneRow.svelte";
  import { useApp } from "../utils";
  import { useStoryProject } from "./story-project.svelte";

  const { project, entryPath, onSelect }: {
    project: MultipleSceneProject;
    entryPath: string | null;
    onSelect: (path: string | null) => void;
  } = $props();
  const app = useApp();
  const openFile: (path: string, paneType: PaneType | boolean) => void = getContext("onSceneClick");
  const story = useStoryProject(app, () => project);
  let kind: CodexKind = $state("character");
  let search = $state("");
  const entry = $derived(story.current.entries.find((candidate) => candidate.path === entryPath));
  const activeKindEntries = $derived(story.current.entries.filter((candidate) => candidate.kind === kind));
  const results = $derived.by(() => {
    const query = search.trim().toLowerCase();
    return activeKindEntries.filter((candidate) => [candidate.title, ...candidate.aliases, candidate.path]
      .some((value) => value.toLowerCase().includes(query)));
  });
  const appearances = $derived(entry ? story.current.appearances.get(entry.path) ?? [] : []);
  let folderError = $state("");

  onMount(async () => {
    try {
      await ensureCodexFolders(app.vault, codexFolderPath(project));
    } catch (error) {
      console.error("[Inkwell] Could not prepare Codex folders", error);
      folderError = "Could not set up the Codex folders. Check the path in Project.";
    }
  });

  function addEntry() {
    new CreateCodexEntryModal(app, codexFolderPath(project), kind, (file) => {
      onSelect(file.path);
      openFile(file.path, false);
    }).open();
  }

  function editEntry() {
    if (!entry) return;
    const file = app.vault.getAbstractFileByPath(entry.path);
    if (file instanceof TFile) new CodexEditorModal(app, file, entry.title).open();
  }
</script>

<div class="codex">
  {#if folderError}<p class="inkwell-story-error" role="alert">{folderError}</p>{/if}
  {#if entry}
    <div class="codex-actions">
      <button type="button" onclick={() => {
        kind = entry.kind;
        onSelect(null);
      }}>
        <Icon iconName="arrow-left" />
        {CODEX_CATEGORIES[entry.kind].label}
      </button>
      <div class="entry-actions">
        <button type="button" onclick={(event) => openFile(entry.path, Keymap.isModEvent(event))}>Open note</button>
        <button type="button" onclick={editEntry}>Edit entry</button>
      </div>
    </div>
    <h3>{entry.title}</h3>
    {#if entry.qualifier}<p class="muted">{entry.qualifier}</p>{/if}
    {#if entry.aliases.length}<p class="muted">{entry.aliases.join(" · ")}</p>{/if}
    <h4>Scenes</h4>
    {#if appearances.length}
      <ul>
        {#each appearances as scene, index (`${scene.path}-${index}`)}
          <li><StorySceneRow {scene} /></li>
        {/each}
      </ul>
    {:else}
      <p class="muted">Assign this {entry.kind} to a scene in Scene details.</p>
    {/if}
  {:else}
    <div class="codex-categories" role="group" aria-label="Codex category">
      {#each CODEX_KINDS as category (category)}
        <button type="button" aria-pressed={kind === category} onclick={() => (kind = category)}>
          {CODEX_CATEGORIES[category].label}
        </button>
      {/each}
    </div>
    <div class="codex-actions">
      <input type="search" aria-label="Search {CODEX_CATEGORIES[kind].label.toLowerCase()}"
        placeholder="Search {CODEX_CATEGORIES[kind].label.toLowerCase()}…" bind:value={search} />
      <button type="button" title="New {kind}" onclick={addEntry}>New {kind}</button>
    </div>
    {#if results.length}
      <ul>
        {#each results as candidate (candidate.path)}
          <li>
            <button type="button" class="entry" title={candidate.path} onclick={() => onSelect(candidate.path)}>
              <Icon iconName={kind === "character" ? "user" : "map-pin"} />
              <span class="entry-name">
                {candidate.title}
                {#if candidate.qualifier}<span class="muted">{candidate.qualifier}</span>{/if}
              </span>
              <span class="count" aria-label="{story.current.appearances.get(candidate.path)?.length ?? 0} scenes">
                {story.current.appearances.get(candidate.path)?.length ?? 0}
              </span>
              <Icon iconName="chevron-right" />
            </button>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="muted">{activeKindEntries.length ? "No matching notes." : `No ${CODEX_CATEGORIES[kind].label.toLowerCase()} yet.`}</p>
    {/if}
  {/if}
</div>

<style>
  .codex {
    display: grid;
    gap: var(--size-4-2);
    padding-top: var(--size-4-1);
  }

  .codex-categories, .codex-actions, .entry-actions {
    display: flex;
    gap: var(--size-4-1);
    align-items: center;
  }

  .codex-categories button {
    flex: 1;
    background: transparent;
    box-shadow: none;
    border: 1px solid var(--background-modifier-border);
  }

  .codex-categories button[aria-pressed="true"] {
    color: var(--text-accent);
    background: var(--background-modifier-hover);
  }

  .codex-actions {
    justify-content: space-between;
    flex-wrap: wrap;
  }

  .entry-actions {
    flex-wrap: wrap;
  }

  .codex-actions input {
    flex: 1 1 7em;
    min-width: 0;
  }

  .codex-actions button {
    display: inline-flex;
    gap: var(--size-4-1);
  }

  h3, h4, p {
    margin: 0;
    overflow-wrap: anywhere;
  }

  h3 { font-size: var(--font-ui-medium); }
  h4 { font-size: var(--font-ui-small); }

  .muted, .count {
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  li + li {
    border-top: 1px solid var(--background-modifier-border);
  }

  .entry {
    display: flex;
    gap: var(--size-4-2);
    width: 100%;
    height: auto;
    min-height: var(--size-4-8);
    padding: var(--size-4-1) var(--size-4-2);
    background: transparent;
    box-shadow: none;
  }

  .entry:hover { background: var(--background-modifier-hover); }

  .entry-name {
    display: grid;
    flex: 1;
    min-width: 0;
    text-align: left;
    white-space: normal;
    overflow-wrap: anywhere;
  }
</style>
