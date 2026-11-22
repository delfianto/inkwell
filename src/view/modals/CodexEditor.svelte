<script lang="ts">
  import {
    type CodexField,
    editedProperty,
    emptyProperty,
    groupCodexProperties,
    PROPERTY_TYPES,
    type PropertyDraft,
    propertyLabel,
    type PropertyType,
  } from "src/model/codex-properties";
  import { type CodexNote, type LoreRange, saveCodexNote } from "src/model/codex-note";
  import { getContext, tick, untrack } from "svelte";
  import { SvelteMap, SvelteSet } from "svelte/reactivity";
  import CodexProperty from "./CodexProperty.svelte";
  import { deepEqual } from "src/lib/deep-equal";
  import Icon from "../components/Icon.svelte";
  import MarkdownPreview from "../components/MarkdownPreview.svelte";
  import { type TFile } from "obsidian";
  import { useApp } from "../utils";

  const { file, title, note }: { file: TFile; title: string; note: CodexNote } = $props();
  const app = useApp();
  const close: () => void = getContext("requestClose");
  const saved: () => void = getContext("closeAfterSave");
  const propertyDrafts = new SvelteMap<string, PropertyDraft>();
  const loreDrafts = new SvelteMap<LoreRange, string>();
  const openIntroductions = new SvelteSet<number>();
  let addedFields = $state<CodexField[]>([]);
  const originalGroups = untrack(() => groupCodexProperties(note.properties, note.layout));
  const groups = $derived(addedFields.length > 0
    ? [...originalGroups, { label: "New properties", fields: addedFields }]
    : originalGroups);
  const allFields = $derived(groups.flatMap((group) => group.fields));
  const searchableFields = $derived(allFields.map((field) => ({
    field,
    text: `${field.label} ${field.key}`.toLowerCase(),
  })));

  let tab = $state<"properties" | "lore">("properties");
  let propertyGroup = $state(0);
  let loreSection = $state(untrack(() => Math.max(0, note.lore.sections.findIndex(
    (section) => section.parts.some((part) => part.text.length > 0),
  ))));
  let previewLore = $state(false);
  let search = $state("");
  let adding = $state(false);
  let name = $state("");
  let type = $state<PropertyType>("text");
  let nameInput = $state<HTMLInputElement>();
  let addingError = $state("");
  let saving = $state(false);
  let error = $state("");
  const dirty = $derived(propertyDrafts.size > 0 || loreDrafts.size > 0);
  const query = $derived(search.trim().toLowerCase());
  const visibleFields = $derived(query
    ? searchableFields.filter(({ text }) => text.includes(query)).map(({ field }) => field)
    : groups[propertyGroup].fields);

  export function closeState() {
    if (saving) return "saving";
    return dirty ? "dirty" : "clean";
  }

  function setProperty(field: CodexField, draft: PropertyDraft) {
    if (Object.hasOwn(note.properties, field.key) && deepEqual(draft, field.initial)) {
      propertyDrafts.delete(field.key);
    } else {
      propertyDrafts.set(field.key, draft);
    }
  }

  function setLore(part: LoreRange, value: string) {
    if (value === part.text) loreDrafts.delete(part);
    else loreDrafts.set(part, value);
  }

  async function addIntroduction(event: MouseEvent & { currentTarget: HTMLButtonElement }) {
    const section = event.currentTarget.closest("fieldset");
    openIntroductions.add(loreSection);
    previewLore = false;
    await tick();
    section?.querySelector("textarea")?.focus();
  }

  async function openAddProperty() {
    adding = true;
    await tick();
    nameInput?.focus();
  }

  function addProperty(event: SubmitEvent) {
    event.preventDefault();
    const key = name.trim();
    if (!key || allFields.some((field) => field.key.toLowerCase() === key.toLowerCase())) {
      addingError = key ? "A property with that name already exists." : "Enter a property name.";
      return;
    }
    const label = note.layout && Object.hasOwn(note.layout.labels, key.toLowerCase())
      ? note.layout.labels[key.toLowerCase()]
      : propertyLabel(key);
    const field = { key, label, initial: null, structured: false };
    addedFields = [...addedFields, field];
    setProperty(field, emptyProperty(type));
    propertyGroup = groups.length - 1;
    search = "";
    name = "";
    type = "text";
    adding = false;
    addingError = "";
  }

  async function save() {
    if (!dirty || saving) return;
    saving = true;
    error = "";
    try {
      const values = new Map<string, unknown>();
      for (const [index, group] of groups.entries()) {
        for (const field of group.fields) {
          const draft = propertyDrafts.get(field.key);
          if (!draft) continue;
          try {
            values.set(field.key, editedProperty(draft, field.label));
          } catch (error_) {
            tab = "properties";
            propertyGroup = index;
            search = "";
            throw error_;
          }
        }
      }
      await saveCodexNote(app, file, note, values, loreDrafts);
      saved();
    } catch (error_) {
      error = error_ instanceof Error ? error_.message : "Could not save the Codex entry.";
      saving = false;
    }
  }
</script>

<div class="codex-editor">
  <header>
    <h2 tabindex="-1" title={file.path}>{title}</h2>
    <div class="editor-tabs" role="group" aria-label="Edit Codex entry">
      <button type="button" aria-pressed={tab === "properties"} onclick={() => (tab = "properties")}>
        <Icon iconName="list" /> Properties
      </button>
      <button type="button" aria-pressed={tab === "lore"} onclick={() => (tab = "lore")}>
        <Icon iconName="book-open" /> Lore
      </button>
    </div>
  </header>

  <div class="editor-body">
    {#if tab === "properties"}
      <fieldset disabled={saving} aria-label="Properties">
        <div class="field-tools">
          <input type="search" aria-label="Find a property" placeholder="Find a property…" bind:value={search} />
          {#if !adding}
            <button type="button" onclick={openAddProperty}><Icon iconName="plus" /> Add property</button>
          {/if}
        </div>
        {#if adding}
          <form class="add-form" onsubmit={addProperty}>
            <label>
              Property name
              <input type="text" bind:this={nameInput} bind:value={name} />
            </label>
            <label>
              Type
              <select class="dropdown" bind:value={type}>
                {#each PROPERTY_TYPES as [value, label] (value)}
                  <option {value}>{label}</option>
                {/each}
              </select>
            </label>
            <div class="add-actions">
              <button type="button" onclick={() => { adding = false; addingError = ""; }}>Cancel</button>
              <button type="submit">Add</button>
            </div>
            {#if addingError}<p class="inkwell-story-error" role="alert">{addingError}</p>{/if}
          </form>
        {/if}
        {#if groups.length > 1 && !query}
          <label class="section-select">
            Section
            <select class="dropdown" bind:value={propertyGroup}>
              {#each groups as group, index (index)}
                <option value={index}>{group.label}</option>
              {/each}
            </select>
          </label>
        {/if}
        {#if !visibleFields.length}
          <p class="hint">{query ? "No matching properties." : "This note has no properties yet."}</p>
        {:else}
          {#each visibleFields as field (field.key)}
            <CodexProperty {field} value={propertyDrafts.get(field.key) ?? field.initial} sourcePath={file.path}
              onChange={(draft) => setProperty(field, draft)} />
          {/each}
        {/if}
      </fieldset>
    {:else}
      {@const section = note.lore.sections[loreSection]}
      {@const hasChildren = section.children.length > 0}
      {@const showProse = !hasChildren || openIntroductions.has(loreSection) || section.parts.some((part) => part.text)}
      <fieldset disabled={saving} aria-label="Lore">
        <div class="lore-tools">
          {#if note.lore.sections.length > 1}
            <label class="section-select">
              Section
              <select class="dropdown" title={section.path} bind:value={loreSection}>
                {#each note.lore.sections as section, index (index)}
                  <option value={index}>{section.path}</option>
                {/each}
              </select>
            </label>
          {/if}
          {#if showProse}
            <div class="editor-tabs lore-modes" role="group" aria-label="Lore display">
              <button type="button" aria-pressed={!previewLore} onclick={() => (previewLore = false)}>Edit</button>
              <button type="button" aria-pressed={previewLore} onclick={() => (previewLore = true)}>Preview</button>
            </div>
          {/if}
        </div>
        {#if showProse}
          {#each section.parts as part, index (part.start)}
            {@const text = loreDrafts.get(part) ?? part.text}
            {#if index > 0}<p class="hint block-divider">Infobox block</p>{/if}
            {#if previewLore}
              <div class="lore-preview">
                {#if text.trim()}
                  <MarkdownPreview markdown={text} sourcePath={file.path} />
                {:else}
                  <p class="hint">This section has no text to preview.</p>
                {/if}
              </div>
            {:else}
              <textarea class="lore" rows="12" aria-label={section.label}
                placeholder={hasChildren ? "Write an introduction…" : "Write lore for this section…"}
                value={text}
                oninput={(event) => setLore(part, event.currentTarget.value)}></textarea>
            {/if}
          {/each}
        {/if}
        {#if hasChildren}
          <div class="subsections">
            <h3>Subsections</h3>
            {#each section.children as child (child)}
              <button type="button" onclick={(event) => {
                loreSection = child;
                event.currentTarget.closest("fieldset")?.querySelector("select")?.focus();
              }}>
                <span>{note.lore.sections[child].label}</span>
                <Icon iconName="chevron-right" />
              </button>
            {/each}
          </div>
          {#if !showProse}
            <button type="button" onclick={addIntroduction}><Icon iconName="plus" /> Add introduction</button>
          {/if}
        {/if}
      </fieldset>
    {/if}
  </div>

  <footer>
    {#if error}<p class="inkwell-story-error" role="alert">{error}</p>{/if}
    <div class="footer-row">
      <span class="hint" role="status">{dirty ? "Unsaved changes" : ""}</span>
      <div class="modal-button-container">
        <button type="button" onclick={close} disabled={saving}>{dirty ? "Cancel" : "Close"}</button>
        <button type="button" class="mod-cta" onclick={save} disabled={!dirty || saving}>
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  </footer>
</div>

<style>
  .codex-editor {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    min-width: 0;
  }

  header {
    padding-inline: var(--inkwell-editor-padding);
    border-bottom: 1px solid var(--background-modifier-border);
  }

  h2 {
    margin: 0 0 var(--size-4-3);
    font-size: max(20px, var(--font-ui-large, 20px));
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .editor-tabs, .field-tools, .add-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--size-4-2);
  }

  .editor-tabs {
    margin-bottom: var(--size-4-2);
  }

  .editor-tabs button {
    background: transparent;
    box-shadow: none;
    border: 1px solid transparent;
    color: var(--text-muted);
  }

  .editor-tabs button[aria-pressed="true"] {
    color: var(--text-accent);
    border-color: var(--background-modifier-border);
    background: var(--background-modifier-hover);
  }

  button {
    gap: var(--size-4-1);
  }

  button :global(svg) {
    width: var(--icon-s);
    height: var(--icon-s);
  }

  .editor-body {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: var(--size-4-4) var(--inkwell-editor-padding);
    container-type: inline-size;
  }

  fieldset {
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }

  .field-tools, .section-select {
    margin-bottom: var(--size-4-3);
  }

  .field-tools input {
    flex: 1;
    min-width: min(10em, 100%);
  }

  .section-select {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--size-4-2);
    font-size: var(--font-ui-small);
  }

  .section-select select {
    min-width: 0;
    max-width: 100%;
  }

  .add-form {
    display: flex;
    align-items: end;
    flex-wrap: wrap;
    gap: var(--size-4-2);
    padding: var(--size-4-3);
    margin-bottom: var(--size-4-3);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    background: var(--background-secondary);
    font-size: var(--font-ui-small);
  }

  .add-form label {
    display: grid;
    gap: var(--size-4-1);
    min-width: 0;
    max-width: 100%;
  }

  .lore {
    display: block;
    width: 100%;
    padding: var(--size-4-3);
    resize: vertical;
    font-family: var(--font-text);
    line-height: 1.55;
  }

  .lore-tools {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--size-4-2);
    margin-bottom: var(--size-4-3);
  }

  .lore-tools .section-select, .lore-modes {
    min-width: 0;
    margin-bottom: 0;
  }

  .lore-modes {
    margin-inline-start: auto;
  }

  .lore-preview {
    min-height: 8em;
    padding: var(--size-4-3);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    font-family: var(--font-text);
    line-height: 1.55;
  }

  .block-divider {
    padding-block: var(--size-4-2);
  }

  .subsections {
    display: grid;
    gap: var(--size-4-1);
    margin-block: var(--size-4-3);
  }

  .subsections h3 {
    margin: 0;
    font-size: var(--font-ui-small);
  }

  .subsections button {
    justify-content: space-between;
    min-width: 0;
    min-height: var(--input-height);
    height: auto;
    text-align: start;
    white-space: normal;
    overflow-wrap: anywhere;
  }

  .hint {
    margin: 0;
    color: var(--text-muted);
    font-size: var(--font-ui-small);
  }

  footer {
    display: grid;
    gap: var(--size-4-2);
    padding: var(--size-4-3) var(--inkwell-editor-padding);
    border-top: 1px solid var(--background-modifier-border);
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
</style>
