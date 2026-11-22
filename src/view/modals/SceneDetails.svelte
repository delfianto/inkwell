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
  import { readStoryDateTime, storyWeekday } from "src/model/story-time";
  import { type CodexEntry } from "src/model/codex";
  import { deepEqual } from "src/lib/deep-equal";
  import Icon from "../components/Icon.svelte";
  import { type MultipleSceneProject } from "src/model/types";
  import { scenePathForLocation } from "src/model/scene-navigation";
  import { TFile } from "obsidian";
  import { useApp } from "../utils";

  const { file: initialFile, project, entries }: {
    file: TFile;
    project: MultipleSceneProject;
    entries: CodexEntry[];
  } = $props();
  const app = useApp();
  const requestClose: () => void = getContext("requestClose");
  const closeAfterSave: () => void = getContext("closeAfterSave");
  const openCodex: (path?: string) => void = getContext("openCodex");
  const chooseEntry: (entries: CodexEntry[], select: (entry: CodexEntry) => void) => void =
    getContext("chooseCodexEntry");

  const initial = untrack(() => readScene(initialFile));
  let scene = $state.raw(initial);
  const { file, properties, original } = $derived(scene);
  const legacySummary = $derived(readSceneSummary({ synopsis: properties?.synopsis, description: properties?.description }));
  let fields = $state({ ...initial.original });
  const status = $derived(fields.status?.toLowerCase());
  const updated = $derived(readStoryDateTime(properties?.updated)?.replace("T", " ") ??
    (typeof properties?.updated === "string" ? properties.updated : undefined));
  const tabs = [
    { id: "chapter", label: "Chapter", icon: "file-text" },
    { id: "people", label: "People & places", icon: "users" },
    { id: "timing", label: "Timing", icon: "clock" },
    { id: "properties", label: "Properties", icon: "list" },
  ] as const;
  type TabId = (typeof tabs)[number]["id"];
  type ListKey = "mood" | "tags";
  const dialogId = $props.id();
  const tagPattern = String.raw`\s*#?(?!\p{Nd}+\s*$)(?:[a-zA-Z0-9_\/\-]|[^\x00-\x7F\s])+\s*`;
  let activeTab: TabId = $state("chapter");
  let bodyWidth = $state(0);
  const wide = $derived(bodyWidth >= 660);
  let saving = $state(false);
  let hasInvalidInput = $state(false);
  let error = $state("");
  let panels: HTMLDivElement;
  let finishInput: HTMLInputElement;
  const newValue = $state({ mood: "", tags: "" });
  const draft = $derived(readSceneStory({
    ...fields,
    mood: withPendingValue("mood"),
    tags: withPendingValue("tags"),
  }));
  const dirty = $derived(!deepEqual(original, draft) || hasInvalidInput);
  const weekday = $derived(storyWeekday(draft.start));
  const invalidRange = $derived(
    (draft.start !== original.start || draft.finish !== original.finish) &&
      draft.start && draft.finish && draft.finish < draft.start,
  );

  const cast = $derived(entries.filter((entry) => entry.kind === "character"));
  const places = $derived(entries.filter((entry) => entry.kind === "location"));
  const availableCast = $derived(unassigned(cast, fields.characters));
  const availablePlaces = $derived(unassigned(places, fields.locations));
  const previous = $derived(scenePathForLocation(
    { position: "previous", maintainIndent: false }, file.path, [project], app.vault,
  ));
  const next = $derived(scenePathForLocation(
    { position: "next", maintainIndent: false }, file.path, [project], app.vault,
  ));

  export function closeState() {
    if (saving) return "saving";
    return dirty ? "dirty" : "clean";
  }

  function readScene(target: TFile) {
    const frontmatter = app.metadataCache.getFileCache(target)?.frontmatter;
    return { file: target, properties: frontmatter, original: readSceneStory(frontmatter) };
  }

  function withPendingValue(key: ListKey): string[] {
    const values = fields[key];
    const value = (key === "tags" ? newValue[key].trim().replace(/^#/u, "") : newValue[key].trim());
    return value && !values.some((existing) => existing.toLowerCase() === value.toLowerCase())
      ? [...values, value]
      : values;
  }

  function addValue(key: ListKey, input: HTMLInputElement) {
    if (!input.reportValidity()) return;
    fields[key] = withPendingValue(key);
    newValue[key] = "";
    input.focus();
  }

  function onListKey(event: KeyboardEvent & { currentTarget: HTMLInputElement }, key: ListKey) {
    if (event.key !== "Enter" || event.isComposing) return;
    event.preventDefault();
    addValue(key, event.currentTarget);
  }

  function unassigned(candidates: CodexEntry[], values: string[]) {
    const paths = new Set(values.map((value) => sceneReferencePath(app, file.path, value)));
    return candidates.filter((entry) => !paths.has(entry.path));
  }

  function addReference(key: "characters" | "locations", candidates: CodexEntry[]) {
    chooseEntry(candidates, (entry) => {
      fields[key] = [...fields[key], sceneReferenceLink(entry.path)];
    });
  }

  function showNeighbor(path: string) {
    if (dirty || saving) return;
    const target = app.vault.getAbstractFileByPath(path);
    if (!(target instanceof TFile)) {
      error = "This scene is no longer available.";
      return;
    }
    const neighbor = readScene(target);
    scene = neighbor;
    fields = { ...neighbor.original };
    newValue.mood = "";
    newValue.tags = "";
    error = "";
    for (const panel of panels.children) panel.scrollTop = 0;
  }

  function onTabKey(event: KeyboardEvent & { currentTarget: HTMLButtonElement }, index: number) {
    const last = tabs.length - 1;
    let target: number;
    if (event.key === "Home") target = 0;
    else if (event.key === "End") target = last;
    else if (event.key === (wide ? "ArrowUp" : "ArrowLeft")) target = index === 0 ? last : index - 1;
    else if (event.key === (wide ? "ArrowDown" : "ArrowRight")) target = index === last ? 0 : index + 1;
    else return;
    event.preventDefault();
    activeTab = tabs[target].id;
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("[role=tab]")[target]?.focus();
  }

  async function save(event: SubmitEvent & { currentTarget: HTMLFormElement }) {
    event.preventDefault();
    if (!dirty || saving) return;
    error = "";
    const invalid = event.currentTarget.querySelector<HTMLInputElement>("input:invalid");
    if (invalid) {
      const panel = invalid.closest("[role=tabpanel]");
      const tab = tabs.find(({ id }) => panel?.id === `${dialogId}-panel-${id}`);
      if (tab) activeTab = tab.id;
      await tick();
      invalid.reportValidity();
      return;
    }
    if (invalidRange) {
      activeTab = "timing";
      await tick();
      finishInput.focus();
      return;
    }

    saving = true;
    try {
      if (app.vault.getAbstractFileByPath(file.path) !== file) {
        throw new Error("This scene is no longer available.");
      }
      await saveSceneStory(app, file, original, draft);
      closeAfterSave();
    } catch (error_) {
      error = error_ instanceof Error ? error_.message : "Could not save scene details.";
      saving = false;
    }
  }
</script>

{#snippet neighbor(path: string | null, label: string, icon: string)}
  <button type="button" class="icon-button" aria-label={label}
    title={path ? `${label}: ${path.split("/").at(-1)?.replace(/\.md$/u, "")}` : label}
    disabled={!path || dirty || saving}
    onclick={() => { if (path) showNeighbor(path); }}>
    <Icon iconName={icon} />
  </button>
{/snippet}

{#snippet chip(value: string, label: string, remove: () => void, entry?: CodexEntry)}
  <span class="chip">
    {#if entry}
      <button type="button" class="chip-link" title="View {label} in Codex"
        disabled={dirty || saving} onclick={() => openCodex(entry.path)}>{label}</button>
    {:else}
      <span class="chip-label" title={value}>{label}</span>
    {/if}
    <button type="button" class="chip-remove" title="Remove {label}" aria-label="Remove {label}" onclick={remove}>
      <Icon iconName="x" />
    </button>
  </span>
{/snippet}

{#snippet reference(value: string, remove: () => void)}
  {@const path = sceneReferencePath(app, file.path, value)}
  {@const entry = entries.find((candidate) => candidate.path === path)}
  {@const label = entry?.qualifier ? `${entry.title} · ${entry.qualifier}` : entry?.title ?? sceneReferenceLabel(value)}
  {@render chip(value, label, remove, entry)}
{/snippet}

{#snippet referenceList(key: "characters" | "locations", label: string, item: string, candidates: CodexEntry[])}
  <div class="reference-field">
    <span class="field-label" id={`${dialogId}-${key}`}>{label}</span>
    <div class="chips" role="group" aria-labelledby={`${dialogId}-${key}`}>
      {#each fields[key] as value, index}
        {@render reference(value, () => fields[key] = fields[key].filter((_, i) => i !== index))}
      {/each}
      {#if candidates.length}
        <button type="button" class="picker-button" onclick={() => addReference(key, candidates)}>
          <Icon iconName="plus" /> Add {item}
        </button>
      {:else if !fields[key].length}
        <span class="hint">No {label.toLowerCase()} linked</span>
      {/if}
    </div>
  </div>
{/snippet}

{#snippet listField(key: ListKey, label: string, placeholder: string)}
  <div class="reference-field">
    <label class="field-label" for={`${dialogId}-${key}`}>{label}</label>
    {#if fields[key].length}
      <div class="chips" role="group" aria-label={`Current ${label.toLowerCase()}`}>
        {#each fields[key] as value, index}
          {@render chip(value, key === "tags" ? `#${value}` : value, () => {
            fields[key] = fields[key].filter((_, i) => i !== index);
          })}
        {/each}
      </div>
    {/if}
    <div class="list-input">
      <input id={`${dialogId}-${key}`} type="text" {placeholder} autocomplete="off"
        pattern={key === "tags" ? tagPattern : undefined}
        title={key === "tags" ? "Use a tag like Chapter/Book-01, without spaces." : undefined}
        bind:value={newValue[key]} onkeydown={(event) => onListKey(event, key)} />
      <button type="button" class="picker-button" aria-label={key === "tags" ? "Add tag" : "Add mood"}
        disabled={!newValue[key].trim()} onclick={(event) => {
          const input = event.currentTarget.previousElementSibling;
          if (input instanceof HTMLInputElement) addValue(key, input);
        }}>
        <Icon iconName="plus" /> Add
      </button>
    </div>
  </div>
{/snippet}

<form class="details" onsubmit={save} novalidate
  oninput={(event) => { hasInvalidInput = !!event.currentTarget.querySelector("input:invalid"); }}>
  <header class="scene-header">
    <div class="scene-identity" aria-live="polite">
      <h2 tabindex="-1" title={file.path}>{original.title ?? file.basename}</h2>
      {#if original.subtitle}<p>{original.subtitle}</p>{/if}
    </div>
    {#if previous || next}
      <nav aria-label="Manuscript order">
        {@render neighbor(previous, "Previous scene", "chevron-left")}
        {@render neighbor(next, "Next scene", "chevron-right")}
      </nav>
    {/if}
  </header>

  <div class="scene-body" class:wide bind:clientWidth={bodyWidth}>
    <div class="scene-tabs" role="tablist" aria-label="Scene details" aria-orientation={wide ? "vertical" : "horizontal"}>
      {#each tabs as tab, index (tab.id)}
        <button type="button" role="tab" id={`${dialogId}-tab-${tab.id}`}
          aria-selected={activeTab === tab.id} aria-controls={`${dialogId}-panel-${tab.id}`}
          tabindex={activeTab === tab.id ? 0 : -1} onclick={() => (activeTab = tab.id)}
          onkeydown={(event) => onTabKey(event, index)}>
          <Icon iconName={tab.icon} />
          <span>{tab.label}</span>
        </button>
      {/each}
    </div>

    <div class="scene-panels" bind:this={panels}>
      <div class="scene-panel" role="tabpanel" tabindex="0" id={`${dialogId}-panel-chapter`}
        aria-labelledby={`${dialogId}-tab-chapter`} hidden={activeTab !== "chapter"}>
        <fieldset disabled={saving}>
          <legend>Chapter information</legend>
          <div class="field-grid">
            <label><span class="field-label">Title</span><input type="text" bind:value={fields.title} placeholder={file.basename} /></label>
            <label><span class="field-label">Subtitle</span><input type="text" bind:value={fields.subtitle} /></label>
          </div>
          <div class="field-grid chapter-numbering">
            <label><span class="field-label">Arc</span><input type="number" step="1" bind:value={fields.arc} /></label>
            <label><span class="field-label">Chapter number</span><input type="number" step="1" bind:value={fields.chapter} /></label>
            <label>
              <span class="field-label">Status</span>
              <select class="dropdown" value={status === "draft" || status === "complete" ? status : ""}
                onchange={(event) => (fields.status = event.currentTarget.value)}>
                <option value="" disabled hidden>{fields.status ?? "Choose status"}</option>
                <option value="draft">Draft</option>
                <option value="complete">Complete</option>
              </select>
            </label>
          </div>
        </fieldset>
        <fieldset disabled={saving}>
          <legend>Story notes</legend>
          <label>
            <span class="field-label">Summary</span>
            <textarea rows="5" bind:value={fields.summary} placeholder={legacySummary ?? ""}></textarea>
          </label>
          <label>
            <span class="field-label">Context</span>
            <textarea rows="2" bind:value={fields.context}></textarea>
          </label>
        </fieldset>
      </div>

      <div class="scene-panel" role="tabpanel" tabindex="0" id={`${dialogId}-panel-people`}
        aria-labelledby={`${dialogId}-tab-people`} hidden={activeTab !== "people"}>
        <fieldset disabled={saving}>
          <legend>Point of view</legend>
          <label class="short-field"><span class="field-label">POV style</span><input type="text" bind:value={fields.pov} /></label>
          <div class="reference-field">
            <span class="field-label" id={`${dialogId}-pov`}>POV character</span>
            <div class="chips" role="group" aria-labelledby={`${dialogId}-pov`}>
              {#if fields.povCharacter}
                {@render reference(fields.povCharacter, () => (fields.povCharacter = undefined))}
              {/if}
              {#if cast.length}
                <button type="button" class="picker-button" onclick={() => chooseEntry(cast, (entry) => {
                  fields.povCharacter = sceneReferenceLink(entry.path);
                })}>
                  <Icon iconName={fields.povCharacter ? "repeat" : "plus"} />
                  {fields.povCharacter ? "Change character" : "Choose character"}
                </button>
              {:else if !fields.povCharacter}
                <span class="hint">No character linked</span>
              {/if}
            </div>
          </div>
        </fieldset>
        <fieldset disabled={saving}>
          <legend>Scene appearances</legend>
          {@render referenceList("characters", "Cast", "character", availableCast)}
          {@render referenceList("locations", "Locations", "location", availablePlaces)}
          {#if !cast.length || !places.length}
            <div class="codex-prompt">
              <span class="hint">Create {cast.length ? "location" : places.length ? "character" : "character and location"} notes in the Codex to link them here.</span>
              <button type="button" onclick={() => openCodex()} disabled={dirty}>Open Codex</button>
            </div>
          {/if}
        </fieldset>
      </div>

      <div class="scene-panel" role="tabpanel" tabindex="0" id={`${dialogId}-panel-timing`}
        aria-labelledby={`${dialogId}-tab-timing`} hidden={activeTab !== "timing"}>
        <fieldset disabled={saving}>
          <legend>Story calendar</legend>
          <div class="field-grid">
            <label><span class="field-label">Start</span><input type="datetime-local" step="1" bind:value={fields.start} /></label>
            <label>
              <span class="field-label">Finish</span>
              <input type="datetime-local" step="1" bind:value={fields.finish} bind:this={finishInput}
                aria-invalid={!!invalidRange} aria-describedby={invalidRange ? `${dialogId}-range-error` : undefined} />
            </label>
          </div>
          {#if invalidRange}
            <p class="inkwell-story-error" id={`${dialogId}-range-error`} role="alert">Finish must be at or after the start.</p>
          {/if}
          <label class="short-field">
            <span class="field-label">Day</span>
            {#if weekday}
              <input type="text" value={weekday} readonly aria-describedby={`${dialogId}-weekday`} />
              <span class="hint" id={`${dialogId}-weekday`}>From the start date</span>
            {:else}
              <input type="text" bind:value={fields.day} />
            {/if}
          </label>
        </fieldset>
        <fieldset disabled={saving}>
          <legend>Manual timeline</legend>
          <div class="field-grid">
            <label>
              <span class="field-label">Story order</span>
              <input type="number" step="any" bind:value={fields.storyOrder} aria-describedby={`${dialogId}-order`} />
            </label>
            <label>
              <span class="field-label">When label</span>
              <input type="text" bind:value={fields.storyWhen} placeholder="Day 3, dusk" />
            </label>
          </div>
          <p class="hint" id={`${dialogId}-order`}>Smaller numbers appear earlier in the Timeline’s Story order view.</p>
        </fieldset>
      </div>

      <div class="scene-panel" role="tabpanel" tabindex="0" id={`${dialogId}-panel-properties`}
        aria-labelledby={`${dialogId}-tab-properties`} hidden={activeTab !== "properties"}>
        <fieldset disabled={saving}>
          <legend>Mood and tags</legend>
          {@render listField("mood", "Mood", "e.g. Quiet")}
          {@render listField("tags", "Tags", "e.g. Chapter/Book-01")}
        </fieldset>
        <fieldset disabled={saving}>
          <legend>Revision</legend>
          <label class="short-field"><span class="field-label">Version</span><input type="text" bind:value={fields.version} placeholder="e.g. 1.0.3" /></label>
          {#if updated}<p class="hint">Last updated <time datetime={readStoryDateTime(properties?.updated)}>{updated}</time></p>{/if}
        </fieldset>
      </div>
    </div>
  </div>

  <footer class="scene-footer">
    {#if error}<p class="inkwell-story-error" role="alert">{error}</p>{/if}
    <div class="footer-row">
      <span class="hint" role="status">{dirty && !saving ? "Unsaved changes" : ""}</span>
      <div class="modal-button-container">
        <button type="button" onclick={requestClose} disabled={saving}>Cancel</button>
        <button type="submit" class="mod-cta" disabled={!dirty || saving}>{saving ? "Saving…" : "Save changes"}</button>
      </div>
    </div>
  </footer>
</form>

<style>
  .details {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
  }

  .scene-header {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: var(--size-4-3);
    padding: 0 var(--scene-details-padding) var(--size-4-4);
  }

  .scene-identity {
    min-width: 0;
  }

  .scene-identity h2, .scene-identity p {
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .scene-identity h2 {
    font-size: max(20px, var(--font-ui-large, 20px));
    line-height: 1.3;
  }

  .scene-identity p {
    margin-top: var(--size-2-1);
    color: var(--text-muted);
    font-size: var(--font-ui-small);
  }

  nav {
    display: flex;
    gap: var(--size-2-2);
  }

  .icon-button {
    width: max(34px, var(--input-height));
    height: max(34px, var(--input-height));
    padding: 0;
  }

  .scene-body {
    display: grid;
    flex: 1;
    grid-template-rows: auto minmax(0, 1fr);
    min-height: 0;
    border-block: 1px solid var(--background-modifier-border);
  }

  .scene-body.wide {
    grid-template: minmax(0, 1fr) / 180px minmax(0, 1fr);
  }

  .scene-tabs {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--size-2-2);
    padding: var(--size-4-2) var(--scene-details-padding);
    background: var(--background-secondary);
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .wide .scene-tabs {
    display: flex;
    flex-direction: column;
    border: 0;
    border-inline-end: 1px solid var(--background-modifier-border);
    padding: var(--size-4-5) var(--size-4-3);
  }

  .scene-tabs button {
    display: flex;
    flex-direction: column;
    gap: var(--size-2-2);
    height: auto;
    min-height: var(--size-4-10);
    padding: var(--size-4-1);
    border: 1px solid transparent;
    border-radius: var(--radius-m);
    background: transparent;
    box-shadow: none;
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
    font-weight: var(--font-medium);
    line-height: 1.2;
    white-space: normal;
  }

  .wide .scene-tabs button {
    justify-content: start;
    flex-direction: row;
    gap: var(--size-4-2);
    min-height: var(--size-4-10);
    padding: var(--size-4-2);
    font-size: var(--font-ui-small);
  }

  .scene-tabs button:hover {
    background: var(--background-modifier-hover);
  }

  .scene-tabs button[aria-selected="true"] {
    border-color: color-mix(in srgb, var(--interactive-accent) 28%, transparent);
    background: color-mix(in srgb, var(--interactive-accent) 12%, transparent);
    color: var(--text-accent);
  }

  button:focus-visible, .scene-panel:focus-visible {
    outline: 2px solid var(--interactive-accent);
    outline-offset: -2px;
  }

  .scene-tabs :global(svg), .icon-button :global(svg), .picker-button :global(svg) {
    width: var(--icon-s);
    height: var(--icon-s);
  }

  .scene-panels {
    display: grid;
    min-height: 0;
    min-width: 0;
    container-type: inline-size;
  }

  .scene-panel {
    overflow: auto;
    overscroll-behavior: contain;
    padding: var(--size-4-5) var(--scene-details-padding);
  }

  .scene-panel[hidden] {
    display: none;
  }

  fieldset {
    display: grid;
    gap: var(--size-4-3);
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }

  fieldset + fieldset {
    margin-top: var(--size-4-5);
  }

  legend {
    width: 100%;
    margin-bottom: var(--size-4-3);
    padding: 0 0 var(--size-4-2);
    border-bottom: 1px solid var(--background-modifier-border);
    font-size: var(--font-ui-medium);
    font-weight: var(--font-semibold);
  }

  label, .reference-field {
    display: grid;
    align-content: start;
    gap: var(--size-2-3);
    min-width: 0;
  }

  .field-label {
    color: var(--text-normal);
    font-size: var(--font-ui-small);
    font-weight: var(--font-medium);
  }

  .field-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--size-4-3);
  }

  .chapter-numbering {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .chapter-numbering label:last-of-type {
    grid-column: 1 / -1;
  }

  .short-field {
    width: min(100%, 19em);
  }

  @container (min-width: 430px) {
    .field-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .chapter-numbering {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.4fr);
    }

    .chapter-numbering label:last-of-type {
      grid-column: auto;
    }
  }

  input, select, textarea {
    width: 100%;
    min-width: 0;
    font-size: var(--font-ui-small);
  }

  input, select {
    min-height: max(34px, var(--input-height));
  }

  input[readonly] {
    background: var(--background-secondary);
    color: var(--text-muted);
  }

  input[aria-invalid="true"] {
    border-color: var(--text-error);
  }

  textarea {
    display: block;
    resize: vertical;
    line-height: 1.5;
  }

  .hint {
    margin: 0;
    color: var(--text-muted);
    font-size: var(--font-ui-small);
  }

  .chips, .codex-prompt {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--size-4-1);
    min-width: 0;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    max-width: 100%;
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-m);
    background: var(--background-secondary);
    font-size: var(--font-ui-small);
  }

  .chip-link, .chip-label {
    min-width: 0;
    overflow-wrap: anywhere;
    padding: var(--size-2-2) var(--size-4-2);
  }

  .chip-link, .chip-remove {
    height: auto;
    min-height: 28px;
    background: transparent;
    box-shadow: none;
    white-space: normal;
  }

  .chip-link {
    color: var(--text-accent);
    text-align: start;
  }

  .chip-remove {
    padding: var(--size-4-1);
    color: var(--text-muted);
  }

  .chip-remove :global(svg) {
    width: var(--icon-xs);
    height: var(--icon-xs);
  }

  .chip-link:hover:not(:disabled), .chip-remove:hover:not(:disabled) {
    background: var(--background-modifier-hover);
  }

  .picker-button {
    gap: var(--size-4-1);
    flex-shrink: 0;
  }

  .list-input {
    display: flex;
    align-items: stretch;
    gap: var(--size-4-2);
  }

  .list-input button {
    height: auto;
  }

  .codex-prompt {
    gap: var(--size-4-2);
    padding-top: var(--size-4-1);
  }

  .scene-footer {
    display: grid;
    gap: var(--size-4-2);
    padding: var(--size-4-3) var(--scene-details-padding);
  }

  .footer-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--size-4-2);
  }

  .footer-row .modal-button-container {
    margin: 0 0 0 auto;
  }

  @media (pointer: coarse) {
    .icon-button, .chip-remove, .picker-button, .scene-footer button {
      min-height: 40px;
    }

    .chip-remove {
      min-width: 36px;
    }
  }
</style>
