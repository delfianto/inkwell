<script lang="ts">
  import { getContext, tick, untrack } from "svelte";
  import {
    readSceneStory,
    readSceneSummary,
    saveSceneStory,
    sceneReferenceLabel,
    sceneReferenceLink,
    sceneReferencePath,
  } from "src/model/scene-story";
  import { type CodexEntry } from "src/model/codex";
  import { deepEqual } from "src/lib/deep-equal";
  import Icon from "../components/Icon.svelte";
  import { type MultipleSceneProject } from "src/model/types";
  import { scenePathForLocation } from "src/model/scene-navigation";
  import { storyWeekday } from "src/model/story-time";
  import { type TFile } from "obsidian";
  import { useApp } from "../utils";

  const { file, project, entries }: {
    file: TFile;
    project: MultipleSceneProject;
    entries: CodexEntry[];
  } = $props();
  const app = useApp();
  const close: () => void = getContext("close");
  const openCodex: (path?: string) => void = getContext("openCodex");
  const chooseEntry: (entries: CodexEntry[], select: (entry: CodexEntry) => void) => void =
    getContext("chooseCodexEntry");

  const properties = untrack(() => app.metadataCache.getFileCache(file)?.frontmatter);
  const original = readSceneStory(properties);
  const fields = $state({ ...original });
  const title = $derived(fields.title?.trim() || file.basename);
  let saving = $state(false);
  let error = $state("");
  const draft = $derived(readSceneStory(fields));
  const dirty = $derived(!deepEqual(original, draft));
  const cast = $derived(entries.filter((entry) => entry.kind === "character"));
  const places = $derived(entries.filter((entry) => entry.kind === "location"));
  const availableCast = $derived(unassigned(cast, fields.characters));
  const availablePlaces = $derived(unassigned(places, fields.locations));
  const weekday = $derived(storyWeekday(draft.start));
  const tabs = [
    { id: "chapter", label: "Chapter" },
    { id: "people", label: "People and places" },
    { id: "timing", label: "Timing" },
  ] as const;
  type TabId = (typeof tabs)[number]["id"];
  const dialogId = $props.id();
  let activeTab: TabId = $state(untrack(() =>
    project.sceneTemplateMode === "chapter" || Object.hasOwn(properties ?? {}, "chapter")
      ? "chapter"
      : "people",
  ));
  const previous = $derived(scenePathForLocation(
    { position: "previous", maintainIndent: false }, file.path, [project], app.vault,
  ));
  const next = $derived(scenePathForLocation(
    { position: "next", maintainIndent: false }, file.path, [project], app.vault,
  ));

  function unassigned(candidates: CodexEntry[], values: string[]) {
    const paths = new Set(values.map((value) => sceneReferencePath(app, file.path, value)));
    return candidates.filter((entry) => !paths.has(entry.path));
  }

  function openNeighbor(path: string) {
    close();
    void app.workspace.openLinkText(path, "/", false);
  }

  function onTabKey(event: KeyboardEvent, index: number) {
    const last = tabs.length - 1;
    let target: number;
    switch (event.key) {
      case "ArrowLeft": {
        target = index === 0 ? last : index - 1;
        break;
      }
      case "ArrowRight": {
        target = index === last ? 0 : index + 1;
        break;
      }
      case "Home": {
        target = 0;
        break;
      }
      case "End": {
        target = last;
        break;
      }
      default: {
        return;
      }
    }
    event.preventDefault();
    activeTab = tabs[target].id;
    const button = event.currentTarget as HTMLButtonElement;
    button.parentElement?.querySelectorAll<HTMLButtonElement>("[role=tab]")[target]?.focus();
  }

  async function save(event: SubmitEvent & { currentTarget: HTMLFormElement }) {
    event.preventDefault();
    if (!dirty || saving) return;
    const invalid = event.currentTarget.querySelector<HTMLInputElement>("input:invalid, textarea:invalid");
    if (invalid) {
      const panel = invalid.closest("[role=tabpanel]");
      const tab = tabs.find(({ id }) => panel?.id === `${dialogId}-panel-${id}`);
      if (tab) activeTab = tab.id;
      await tick();
      invalid.reportValidity();
      return;
    }
    saving = true;
    error = "";
    try {
      if (app.vault.getAbstractFileByPath(file.path) !== file) {
        throw new Error("This scene is no longer available.");
      }
      await saveSceneStory(app, file, original, draft);
      close();
    } catch (error_) {
      error = error_ instanceof Error ? error_.message : "Could not save scene details.";
      saving = false;
    }
  }
</script>

{#snippet reference(value: string, remove: () => void)}
  {@const path = sceneReferencePath(app, file.path, value)}
  {@const entry = entries.find((candidate) => candidate.path === path)}
  {@const label = entry?.qualifier ? entry.title + " · " + entry.qualifier : entry?.title ?? sceneReferenceLabel(value)}
  <span class="reference">
    {#if entry && !dirty}
      <button type="button" class="reference-link" title="View in Codex" onclick={() => openCodex(entry.path)}>
        {label}
      </button>
    {:else}
      <span class="reference-label" title={value}>{label}</span>
    {/if}
    <button type="button" class="reference-remove" title="Remove {label}" aria-label="Remove {label}" onclick={remove}>
      <Icon iconName="x" />
    </button>
  </span>
{/snippet}

<form class="details" onsubmit={save} novalidate>
  <div class="scene-header">
    <p class="scene-title">{title}</p>
    {#if previous || next}
      <nav aria-label="Manuscript order">
        {#if previous}
          <button type="button" onclick={() => openNeighbor(previous)} disabled={dirty || saving} title={previous}>
            <Icon iconName="arrow-left" /> Previous chapter
          </button>
        {/if}
        {#if next}
          <button type="button" onclick={() => openNeighbor(next)} disabled={dirty || saving} title={next}>
            Next chapter <Icon iconName="arrow-right" />
          </button>
        {/if}
      </nav>
    {/if}
  </div>

  <div class="scene-tabs" role="tablist" aria-label="Scene details">
    {#each tabs as tab, index (tab.id)}
      <button
        type="button"
        role="tab"
        id={`${dialogId}-tab-${tab.id}`}
        aria-selected={activeTab === tab.id}
        aria-controls={`${dialogId}-panel-${tab.id}`}
        tabindex={activeTab === tab.id ? 0 : -1}
        onclick={() => (activeTab = tab.id)}
        onkeydown={(event) => onTabKey(event, index)}
      >{tab.label}</button>
    {/each}
  </div>

  <div class="scene-panels">
    <div class="scene-panel" role="tabpanel" tabindex="0" id={`${dialogId}-panel-chapter`}
      aria-labelledby={`${dialogId}-tab-chapter`} hidden={activeTab !== "chapter"}>
      <fieldset disabled={saving} aria-label="Chapter">
        <div class="field-group">
          <label><span class="field-label">Title</span><input type="text" bind:value={fields.title} placeholder={file.basename} /></label>
          <label><span class="field-label">Subtitle</span><input type="text" bind:value={fields.subtitle} /></label>
        </div>
        <div class="field-group chapter-numbering">
          <label><span class="field-label">Arc</span><input type="number" step="1" bind:value={fields.arc} /></label>
          <label><span class="field-label">Chapter number</span><input type="number" step="1" bind:value={fields.chapter} /></label>
          <label><span class="field-label">Status</span><input type="text" bind:value={fields.status} placeholder="draft" /></label>
        </div>
        <label class="stack">
          <span class="field-label">Context</span>
          <textarea rows="3" bind:value={fields.context}></textarea>
        </label>
        <label class="stack">
          <span class="field-label">Summary</span>
          <textarea rows="6" bind:value={fields.summary} placeholder={readSceneSummary(properties) ?? ""}></textarea>
        </label>
      </fieldset>
    </div>

    <div class="scene-panel" role="tabpanel" tabindex="0" id={`${dialogId}-panel-people`}
      aria-labelledby={`${dialogId}-tab-people`} hidden={activeTab !== "people"}>
      <fieldset disabled={saving} aria-label="People and places">
        <label class="detail-row">
          <span class="field-label">POV style</span>
          <input type="text" bind:value={fields.pov} />
        </label>
        {#if cast.length || fields.povCharacter}
          <div class="detail-row">
            <span class="field-label">POV character</span>
            <div class="references">
              {#if fields.povCharacter}
                {@render reference(fields.povCharacter, () => (fields.povCharacter = undefined))}
              {/if}
              {#if cast.length}
                <button type="button" onclick={() => chooseEntry(cast, (entry) => {
                  fields.povCharacter = sceneReferenceLink(entry.path);
                })}>
                  {fields.povCharacter ? "Change POV character" : "Choose POV character"}
                </button>
              {/if}
            </div>
          </div>
        {/if}
        {#if cast.length || fields.characters.length}
          <div class="detail-row">
            <span class="field-label">Cast</span>
            <div class="references">
              {#each fields.characters as value, i}
                {@render reference(value, () => (fields.characters = fields.characters.filter((_, index) => index !== i)))}
              {/each}
              {#if availableCast.length}
                <button type="button" onclick={() => chooseEntry(availableCast, (entry) => {
                  fields.characters = [...fields.characters, sceneReferenceLink(entry.path)];
                })}>Add character</button>
              {/if}
            </div>
          </div>
        {/if}
        {#if places.length || fields.locations.length}
          <div class="detail-row">
            <span class="field-label">Locations</span>
            <div class="references">
              {#each fields.locations as value, i}
                {@render reference(value, () => (fields.locations = fields.locations.filter((_, index) => index !== i)))}
              {/each}
              {#if availablePlaces.length}
                <button type="button" onclick={() => chooseEntry(availablePlaces, (entry) => {
                  fields.locations = [...fields.locations, sceneReferenceLink(entry.path)];
                })}>Add location</button>
              {/if}
            </div>
          </div>
        {/if}
        {#if !cast.length || !places.length}
          <div class="codex-prompt">
            <span>Add {cast.length ? "locations" : places.length ? "characters" : "characters and locations"} in the Codex.</span>
            {#if !dirty}<button type="button" onclick={() => openCodex()}>Open Codex</button>{/if}
          </div>
        {/if}
      </fieldset>
    </div>

    <div class="scene-panel" role="tabpanel" tabindex="0" id={`${dialogId}-panel-timing`}
      aria-labelledby={`${dialogId}-tab-timing`} hidden={activeTab !== "timing"}>
      <fieldset disabled={saving} aria-label="Timing">
        <div class="field-group">
          <label><span class="field-label">Start</span><input type="datetime-local" step="1" bind:value={fields.start} /></label>
          <label><span class="field-label">Finish</span><input type="datetime-local" step="1" bind:value={fields.finish} /></label>
        </div>
        <div class="field-group">
          {#if weekday}
            <label><span class="field-label">Day</span><input type="text" value={weekday} readonly /></label>
          {:else}
            <label><span class="field-label">Day</span><input type="text" bind:value={fields.day} /></label>
          {/if}
          <label><span class="field-label">When label</span><input type="text" bind:value={fields.storyWhen} placeholder="Day 3, dusk" /></label>
        </div>
      <label class="detail-row">
        <span class="field-label">Story order</span>
        <input type="number" step="any" bind:value={fields.storyOrder} placeholder="10" />
      </label>
      <p class="hint">Lower numbers come first in the Timeline's Story order view.</p>
      </fieldset>
    </div>
  </div>

  <footer class="scene-footer">
    {#if error}<p class="inkwell-story-error" role="alert">{error}</p>{/if}
    <div class="modal-button-container">
      <button type="button" onclick={close} disabled={saving}>Cancel</button>
      <button type="submit" class="mod-cta" disabled={!dirty || saving}>
        {saving ? "Saving…" : "Save scene details"}
      </button>
    </div>
  </footer>
</form>

<style>
  .details {
    display: grid;
    grid-template-rows: auto auto minmax(0, 1fr) auto;
    flex: 1;
    min-height: 0;
    gap: var(--size-4-3);
  }

  .scene-header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--size-4-2);
  }

  .scene-title, .hint {
    margin: 0;
    overflow-wrap: anywhere;
    color: var(--text-muted);
  }

  .scene-title {
    flex: 1 1 10em;
    color: var(--text-normal);
    font-weight: var(--font-medium);
  }

  .scene-tabs {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .scene-tabs button {
    min-height: var(--size-4-9);
    height: auto;
    padding: var(--size-4-1);
    background: transparent;
    box-shadow: none;
    border: 0;
    border-bottom: 2px solid transparent;
    border-radius: var(--radius-s) var(--radius-s) 0 0;
    color: var(--text-muted);
    font-weight: var(--font-medium);
    white-space: normal;
  }

  .scene-tabs button:hover {
    background: var(--background-modifier-hover);
  }

  .scene-tabs button[aria-selected="true"] {
    border-bottom-color: var(--interactive-accent);
    color: var(--text-accent);
  }

  .scene-tabs button:focus-visible, .scene-panel:focus-visible {
    outline: 2px solid var(--interactive-accent);
    outline-offset: -2px;
  }

  .scene-panels {
    display: grid;
    min-height: 0;
  }

  .scene-panel {
    min-width: 0;
    min-height: 0;
    overflow: auto;
  }

  .scene-panel[hidden] {
    display: none;
  }

  fieldset {
    display: grid;
    gap: var(--size-4-3);
    min-width: 0;
    margin: 0;
    padding: var(--size-4-1) var(--size-4-2) var(--size-4-3);
    border: 0;
  }

  .scene-footer {
    display: flex;
    flex-direction: column;
    gap: var(--size-4-2);
    padding-top: var(--size-4-2);
    border-top: 1px solid var(--background-modifier-border);
  }

  .scene-footer .modal-button-container {
    margin: 0;
  }

  nav {
    display: flex;
    flex-wrap: wrap;
    gap: var(--size-4-1);
  }

  nav button {
    gap: var(--size-4-1);
  }

  .detail-row {
    display: grid;
    grid-template-columns: minmax(6em, 25%) minmax(0, 1fr);
    align-items: baseline;
    gap: var(--size-4-2);
  }

  .field-label, .hint, .codex-prompt {
    color: var(--text-muted);
    font-size: var(--font-ui-small);
  }

  .references, .codex-prompt {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--size-4-1);
    min-width: 0;
  }

  .reference {
    display: inline-flex;
    align-items: center;
    max-width: 100%;
    background: var(--background-secondary);
    border-radius: var(--radius-s);
  }

  .reference-link, .reference-label {
    min-width: 0;
    overflow-wrap: anywhere;
    padding: var(--size-2-2) var(--size-4-1);
  }

  .reference-link, .reference-remove {
    box-shadow: none;
    height: auto;
    background: transparent;
    white-space: normal;
  }

  .reference-link {
    color: var(--text-accent);
  }

  .reference-link:hover {
    text-decoration: underline;
  }

  .reference-remove {
    padding: var(--size-2-2);
    color: var(--text-muted);
  }

  .codex-prompt {
    gap: var(--size-4-2);
  }

  .field-group {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 11em), 1fr));
    gap: var(--size-4-2);
  }

  .chapter-numbering {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .field-group label, .stack {
    display: grid;
    gap: var(--size-4-1);
    min-width: 0;
  }

  input, textarea {
    width: 100%;
    min-width: 0;
  }

  textarea {
    resize: vertical;
  }

  @media (max-width: 520px) {
    .detail-row {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
