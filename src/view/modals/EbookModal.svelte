<script lang="ts">
  import { selectedProject, selectedProjectPath, updateProject } from "src/model/stores";
  import { type EbookStringKey } from "src/model/types";
  import { FileSuggest } from "../settings/file-suggest";
  import { getContext } from "svelte";
  import { TFile } from "obsidian";
  import { useApp } from "../utils";

  const app = useApp();
  const close: () => void = getContext("close");

  const ebook = $derived($selectedProject?.ebook ?? {});
  const projectTitle = $derived($selectedProject?.title ?? "");

  function updateEbook(mutator: (e: Record<string, any>) => void) {
    if (!$selectedProjectPath) return;
    updateProject($selectedProjectPath, (p) => {
      const next = { ...p.ebook };
      mutator(next);
      p.ebook = next;
    });
  }

  function ebookStringChanged(field: EbookStringKey) {
    return (event: Event) => {
      const raw = (event.target as HTMLInputElement | HTMLTextAreaElement).value;
      const trimmed = raw.trim();
      updateEbook((e) => {
        if (trimmed.length > 0) {
          e[field] = trimmed;
        } else {
          delete e[field];
        }
      });
    };
  }

  function seriesIndexChanged(event: Event) {
    const raw = (event.target as HTMLInputElement).value.trim();
    const n = raw.length === 0 ? NaN : Number(raw);
    updateEbook((e) => {
      if (Number.isFinite(n)) {
        e.seriesIndex = n;
      } else {
        delete e.seriesIndex;
      }
    });
  }

  function generateIdentifier() {
    const id =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? `urn:uuid:${crypto.randomUUID()}`
        : `urn:uuid:${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
    updateEbook((e) => {
      e.identifier = id;
    });
  }

  // ---- Subject chips ----
  let newSubject = $state("");
  const subjects = $derived(Array.isArray(ebook.subjects) ? ebook.subjects : []);

  function addSubject() {
    const value = newSubject.trim();
    if (value.length === 0) return;
    updateEbook((e) => {
      const arr = Array.isArray(e.subjects) ? [...e.subjects] : [];
      if (!arr.includes(value)) arr.push(value);
      e.subjects = arr;
    });
    newSubject = "";
  }

  function removeSubject(subject: string) {
    updateEbook((e) => {
      const arr = (Array.isArray(e.subjects) ? e.subjects : []).filter(
        (s: string) => s !== subject
      );
      if (arr.length > 0) {
        e.subjects = arr;
      } else {
        delete e.subjects;
      }
    });
  }

  // ---- Cover thumbnail ----
  const coverFile = $derived.by(() => {
    if (!ebook.cover) return null;
    const f = app.vault.getAbstractFileByPath(ebook.cover);
    return f instanceof TFile ? f : null;
  });
  const coverSrc = $derived(coverFile ? app.vault.getResourcePath(coverFile) : null);

  let coverInput: HTMLInputElement | null = $state(null);
  let coverSuggestEl: HTMLInputElement | null = null;
  $effect(() => {
    if (coverInput && coverInput !== coverSuggestEl) {
      new FileSuggest(app, coverInput);
      coverSuggestEl = coverInput;
    }
  });
</script>

<div class="inkwell-ebook">
  <p class="inkwell-ebook-subtitle">
    {#if projectTitle}<span class="inkwell-ebook-project">{projectTitle}</span> ·
    {/if}Written to <code>Index.md</code> front-matter, used when compiling to EPUB.
    Changes save automatically.
  </p>

  <!-- IDENTITY -->
  <div class="inkwell-ebook-section-label">Identity</div>
  <div class="inkwell-ebook-grid">
    <div class="field">
      <label for="inkwell-ebook-author">Author</label>
      <input
        id="inkwell-ebook-author"
        type="text"
        value={ebook.author ?? ""}
        onblur={ebookStringChanged("author")}
      />
    </div>
    <div class="field">
      <label for="inkwell-ebook-language">Language</label>
      <input
        id="inkwell-ebook-language"
        type="text"
        placeholder="en"
        value={ebook.language ?? ""}
        onblur={ebookStringChanged("language")}
      />
    </div>
  </div>
  <div class="field">
    <label for="inkwell-ebook-identifier">Identifier</label>
    <div class="inkwell-ebook-identifier-row">
      <input
        id="inkwell-ebook-identifier"
        type="text"
        placeholder="urn:uuid:…"
        value={ebook.identifier ?? ""}
        onblur={ebookStringChanged("identifier")}
      />
      <button type="button" onclick={generateIdentifier} title="Generate a new UUID"
        >Generate</button
      >
    </div>
  </div>
  <div class="field">
    <label for="inkwell-ebook-description">Description</label>
    <textarea
      id="inkwell-ebook-description"
      rows="3"
      value={ebook.description ?? ""}
      onblur={ebookStringChanged("description")}
    ></textarea>
  </div>

  <!-- PUBLICATION -->
  <div class="inkwell-ebook-section-label">Publication</div>
  <div class="inkwell-ebook-grid">
    <div class="field">
      <label for="inkwell-ebook-publisher">Publisher</label>
      <input
        id="inkwell-ebook-publisher"
        type="text"
        value={ebook.publisher ?? ""}
        onblur={ebookStringChanged("publisher")}
      />
    </div>
    <div class="field">
      <label for="inkwell-ebook-pubdate">Publication date</label>
      <input
        id="inkwell-ebook-pubdate"
        type="date"
        value={ebook.pubdate ?? ""}
        onblur={ebookStringChanged("pubdate")}
      />
    </div>
  </div>
  <div class="field">
    <label for="inkwell-ebook-rights">Rights</label>
    <input
      id="inkwell-ebook-rights"
      type="text"
      value={ebook.rights ?? ""}
      onblur={ebookStringChanged("rights")}
    />
  </div>

  <!-- CLASSIFICATION -->
  <div class="inkwell-ebook-section-label">Classification</div>
  <div class="inkwell-ebook-class">
    <div class="inkwell-ebook-class-fields">
      <div class="inkwell-ebook-grid series">
        <div class="field">
          <label for="inkwell-ebook-series">Series</label>
          <input
            id="inkwell-ebook-series"
            type="text"
            value={ebook.series ?? ""}
            onblur={ebookStringChanged("series")}
          />
        </div>
        <div class="field">
          <label for="inkwell-ebook-series-index">Book #</label>
          <input
            id="inkwell-ebook-series-index"
            type="number"
            min="0"
            step="1"
            value={ebook.seriesIndex ?? ""}
            onblur={seriesIndexChanged}
          />
        </div>
      </div>
      <div class="field">
        <span class="inkwell-ebook-label">Subjects</span>
        <div class="inkwell-ebook-chips">
          {#each subjects as subject (subject)}
            <span class="inkwell-ebook-chip">
              {subject}
              <button
                type="button"
                class="inkwell-ebook-chip-x"
                aria-label={`Remove ${subject}`}
                onclick={() => removeSubject(subject)}>✕</button
              >
            </span>
          {/each}
          <input
            class="inkwell-ebook-chip-input"
            type="text"
            placeholder="add subject…"
            bind:value={newSubject}
            onkeydown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                addSubject();
              }
            }}
            onblur={addSubject}
          />
        </div>
        <p class="inkwell-ebook-help">Maps to EPUB <code>dc:subject</code>.</p>
      </div>
    </div>
    <div class="inkwell-ebook-cover">
      <span class="inkwell-ebook-label">Cover</span>
      <div class="inkwell-ebook-cover-thumb">
        {#if coverSrc}
          <img src={coverSrc} alt="Cover preview" />
        {:else}
          <span class="inkwell-ebook-cover-placeholder">No cover</span>
        {/if}
      </div>
      <input
        class="inkwell-ebook-cover-input"
        type="text"
        placeholder="assets/cover.png"
        value={ebook.cover ?? ""}
        bind:this={coverInput}
        onblur={ebookStringChanged("cover")}
      />
    </div>
  </div>

  <div class="inkwell-ebook-footer">
    <span class="inkwell-ebook-help"
      >Fields map to EPUB / Dublin Core · saved automatically.</span
    >
    <button type="button" class="mod-cta" onclick={() => close()}>Done</button>
  </div>
</div>

<style>
  .inkwell-ebook {
    display: flex;
    flex-direction: column;
    gap: var(--size-4-2);
  }

  .inkwell-ebook-subtitle {
    margin: 0 0 var(--size-4-1);
    color: var(--text-faint);
    font-size: var(--font-ui-smaller);
  }

  .inkwell-ebook-project {
    color: var(--text-muted);
    font-weight: 600;
  }

  .inkwell-ebook-section-label {
    margin-top: var(--size-4-2);
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-top: var(--border-width) solid var(--background-modifier-border);
    padding-top: var(--size-4-2);
  }

  .inkwell-ebook-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--size-4-3);
  }

  .inkwell-ebook-grid.series {
    grid-template-columns: 1fr 80px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--size-2-2);
  }

  .field label,
  .inkwell-ebook-label {
    font-size: var(--font-ui-smaller);
    color: var(--text-muted);
  }

  .field input,
  .field textarea {
    width: 100%;
  }

  .field textarea {
    resize: vertical;
    font-family: inherit;
  }

  .inkwell-ebook-identifier-row {
    display: flex;
    gap: var(--size-4-2);
    align-items: center;
  }

  .inkwell-ebook-identifier-row input {
    flex: 1;
    font-family: var(--font-monospace);
  }

  .inkwell-ebook-identifier-row button {
    flex-shrink: 0;
  }

  .inkwell-ebook-class {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: var(--size-4-4);
    align-items: start;
  }

  .inkwell-ebook-class-fields {
    display: flex;
    flex-direction: column;
    gap: var(--size-4-2);
    min-width: 0;
  }

  .inkwell-ebook-chips {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--size-4-1);
    padding: var(--size-2-2);
    background: var(--background-modifier-form-field);
    border: var(--input-border-width) solid var(--background-modifier-border);
    border-radius: var(--input-radius);
  }

  .inkwell-ebook-chip {
    display: inline-flex;
    align-items: center;
    gap: var(--size-2-2);
    padding: var(--size-2-1) var(--size-4-2);
    background: var(--background-secondary-alt);
    color: var(--text-accent);
    border-radius: var(--radius-l);
    font-size: var(--font-ui-smaller);
  }

  .inkwell-ebook-chip-x {
    padding: 0;
    background: none;
    border: none;
    box-shadow: none;
    color: var(--text-accent);
    cursor: pointer;
    font-size: var(--font-ui-smaller);
    line-height: 1;
  }

  .inkwell-ebook-chip-input {
    flex: 1;
    min-width: 80px;
    background: none;
    border: none;
    box-shadow: none;
    font-size: var(--font-ui-smaller);
  }

  .inkwell-ebook-chip-input:focus {
    box-shadow: none;
  }

  .inkwell-ebook-cover {
    display: flex;
    flex-direction: column;
    gap: var(--size-2-2);
    width: 96px;
  }

  .inkwell-ebook-cover-thumb {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 96px;
    height: 132px;
    background: var(--background-secondary-alt);
    border: var(--border-width) solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    overflow: hidden;
  }

  .inkwell-ebook-cover-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .inkwell-ebook-cover-placeholder {
    color: var(--text-faint);
    font-size: var(--font-ui-smaller);
  }

  .inkwell-ebook-cover-input {
    width: 100%;
    font-size: var(--font-ui-smaller);
  }

  .inkwell-ebook-help {
    margin: 0;
    color: var(--text-faint);
    font-size: var(--font-ui-smaller);
  }

  .inkwell-ebook-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--size-4-2);
    margin-top: var(--size-4-3);
    padding-top: var(--size-4-3);
    border-top: var(--border-width) solid var(--background-modifier-border);
  }
</style>
