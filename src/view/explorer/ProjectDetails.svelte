<script lang="ts">
  import { normalizePath } from "obsidian";
  import { projectFolderPath } from "src/model/scene-navigation";
  import {
    projects,
    selectedProject,
    selectedProjectPath,
    updateProject,
    updateScenesProject,
  } from "src/model/stores";
  import type { EbookStringKey } from "src/model/types";
  import { onMount } from "svelte";
  import Disclosure from "../components/Disclosure.svelte";
  import { FileSuggest } from "../settings/file-suggest";
  import { FolderSuggest } from "../settings/folder-suggest";
  import { selectedProjectWordCountStatus } from "../stores";
  import { useApp } from "../utils";

  const app = useApp();

  let showMetdata = $state(true);
  let showEbook = $state(false);
  let showWordCount = $state(true);

  function titleChanged(event: Event) {
    let newTitle = (event.target as HTMLInputElement).value;
    projects.update((_projects) => {
      const currentIndex = _projects.findIndex(
        (p) => p.vaultPath === $selectedProjectPath
      );
      if (currentIndex >= 0) {
        const current = _projects[currentIndex];
        const currentTitle = current.title;
        let titleInFrontmatter = true;

        if (newTitle.length === 0) {
          newTitle = $selectedProjectPath.split("/").at(-1).replace(/\.md$/, "");
          titleInFrontmatter = false;
        }

        return _projects.map((p) => {
          if (p.title === currentTitle) {
            p.title = newTitle;
            p.titleInFrontmatter = titleInFrontmatter;
          }
          return p;
        });
      }
      return _projects;
    });
  }

  let sceneFolderInput: HTMLInputElement = $state(null);
  onMount(() => {
    if (sceneFolderInput && $selectedProject.format === "scenes") {
      const projectPath = projectFolderPath($selectedProject, app.vault);
      new FolderSuggest(app, sceneFolderInput, projectPath);
    }
  });

  async function sceneFolderChanged(event: Event) {
    const newFolder = (event.target as HTMLInputElement).value;
    if (newFolder.length <= 0 || !$selectedProject) {
      return;
    }
    const root = app.vault.getAbstractFileByPath($selectedProject.vaultPath)
      .parent.path;
    const path = normalizePath(`${root}/${newFolder}`);
    const exists = await app.vault.adapter.exists(path);
    if (exists) {
      updateScenesProject($selectedProjectPath, (p) => {
        p.sceneFolder = newFolder;
      });
    }
  }

  let sceneTemplateInput: HTMLInputElement = $state(null);
  onMount(() => {
    if (sceneTemplateInput && $selectedProject.format === "scenes") {
      new FileSuggest(app, sceneTemplateInput);
    }
  });
  async function sceneTemplateChanged(event: Event) {
    let newTemplate = (event.target as HTMLInputElement).value;
    if (!$selectedProject) {
      return;
    }
    let exists = true;
    if (newTemplate.length <= 0) {
      newTemplate = null;
    } else {
      exists = await app.vault.adapter.exists(newTemplate);
    }

    if (exists) {
      updateScenesProject($selectedProjectPath, (p) => {
        p.sceneTemplate = newTemplate;
      });
    }
  }

  // ---- eBook metadata helpers ----

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

  function subjectsChanged(event: Event) {
    const raw = (event.target as HTMLInputElement).value;
    const parsed = raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    updateEbook((e) => {
      if (parsed.length > 0) {
        e.subjects = parsed;
      } else {
        delete e.subjects;
      }
    });
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
    // crypto.randomUUID is available in modern Electron / Obsidian.
    const id =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? `urn:uuid:${crypto.randomUUID()}`
        : `urn:uuid:${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
    updateEbook((e) => {
      e.identifier = id;
    });
  }

  let coverInput: HTMLInputElement = $state(null);
  let coverSuggestEl: HTMLInputElement | null = null;
  // The cover input lives inside `{#if showEbook}` (collapsed by default), so
  // it does not exist at mount time. Bind FileSuggest the first time the input
  // appears, and rebind if the underlying element is replaced.
  $effect(() => {
    if (coverInput && coverInput !== coverSuggestEl) {
      new FileSuggest(app, coverInput);
      coverSuggestEl = coverInput;
    }
  });

  let ebook = $derived($selectedProject?.ebook ?? {});
  let subjectsText = $derived(
    Array.isArray(ebook.subjects) ? ebook.subjects.join(", ") : ""
  );

  let projectCount = $state(0);
  let sceneCount: number | null = $state(null);

  $effect(() => {
    if ($selectedProjectWordCountStatus) {
      const { scene, project } = $selectedProjectWordCountStatus;
      projectCount = project;
      sceneCount = $selectedProject.format === "scenes" ? scene : null;
    }
  });

  function pluralize(
    count: number,
    noun: string,
    pluralNoun: string | null = null
  ) {
    if (count === undefined) {
      return "";
    }
    if (count === 1) {
      return `${count.toLocaleString()} ${noun}`;
    } else if (pluralNoun) {
      return `${count.toLocaleString()} ${pluralNoun}`;
    } else {
      return `${count.toLocaleString()} ${noun}s`;
    }
  }
</script>

<div>
  {#if $selectedProject}
    <div class="inkwell-project-section">
      <button
        type="button"
        class="inkwell-project-details-section-header"
        onclick={() => { showMetdata = !showMetdata; }}
      >
        <Disclosure collapsed={!showMetdata} />
        <h4>Project Metadata</h4>
      </button>
      {#if showMetdata}
        <div>
          <label for="inkwell-project-title">Title</label>
          <input
            id="inkwell-project-title"
            type="text"
            value={$selectedProject.title}
            onchange={titleChanged}
          />
          {#if $selectedProject.format === "scenes"}
            <label for="inkwell-project-scene-folder">Scene Folder</label>
            <input
              id="inkwell-project-scene-folder"
              type="text"
              value={$selectedProject.sceneFolder}
              bind:this={sceneFolderInput}
              onblur={sceneFolderChanged}
            />
            <p class="inkwell-project-warning">
              Changing scene folder does not move scenes. If you're moving
              scenes to a new folder, move them in your vault first, then
              change this setting.
            </p>
            <label for="inkwell-project-scene-template">Scene Template</label>
            <input
              id="inkwell-project-scene-template"
              type="text"
              value={$selectedProject.sceneTemplate}
              bind:this={sceneTemplateInput}
              onblur={sceneTemplateChanged}
            />
            <p class="inkwell-project-warning">
              This file will be used as a template when creating new scenes
              via the New Scene… field. If you use a templating plugin
              (Templater or the core plugin) it will be used to process this
              template.
            </p>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
  {#if $selectedProject}
    <div class="inkwell-project-section">
      <button
        type="button"
        class="inkwell-project-details-section-header"
        onclick={() => { showEbook = !showEbook; }}
      >
        <Disclosure collapsed={!showEbook} />
        <h4>eBook Metadata</h4>
      </button>
      {#if showEbook}
        <div>
          <label for="inkwell-ebook-author">Author</label>
          <input
            id="inkwell-ebook-author"
            type="text"
            value={ebook.author ?? ""}
            onblur={ebookStringChanged("author")}
          />

          <label for="inkwell-ebook-language">Language</label>
          <input
            id="inkwell-ebook-language"
            type="text"
            placeholder="en"
            value={ebook.language ?? ""}
            onblur={ebookStringChanged("language")}
          />

          <label for="inkwell-ebook-identifier">Identifier</label>
          <div class="inkwell-ebook-identifier-row">
            <input
              id="inkwell-ebook-identifier"
              type="text"
              placeholder="urn:uuid:…"
              value={ebook.identifier ?? ""}
              onblur={ebookStringChanged("identifier")}
            />
            <button
              type="button"
              class="inkwell-ebook-generate"
              onclick={generateIdentifier}
              title="Generate a new UUID"
            >
              Generate
            </button>
          </div>

          <label for="inkwell-ebook-description">Description</label>
          <textarea
            id="inkwell-ebook-description"
            rows="3"
            value={ebook.description ?? ""}
            onblur={ebookStringChanged("description")}
          ></textarea>

          <label for="inkwell-ebook-cover">Cover</label>
          <input
            id="inkwell-ebook-cover"
            type="text"
            placeholder="assets/cover.png"
            value={ebook.cover ?? ""}
            bind:this={coverInput}
            onblur={ebookStringChanged("cover")}
          />

          <label for="inkwell-ebook-publisher">Publisher</label>
          <input
            id="inkwell-ebook-publisher"
            type="text"
            value={ebook.publisher ?? ""}
            onblur={ebookStringChanged("publisher")}
          />

          <label for="inkwell-ebook-pubdate">Publication Date</label>
          <input
            id="inkwell-ebook-pubdate"
            type="date"
            value={ebook.pubdate ?? ""}
            onblur={ebookStringChanged("pubdate")}
          />

          <label for="inkwell-ebook-rights">Rights</label>
          <input
            id="inkwell-ebook-rights"
            type="text"
            value={ebook.rights ?? ""}
            onblur={ebookStringChanged("rights")}
          />

          <label for="inkwell-ebook-subjects">Subjects</label>
          <input
            id="inkwell-ebook-subjects"
            type="text"
            placeholder="fiction, science-fiction"
            value={subjectsText}
            onblur={subjectsChanged}
          />
          <p class="inkwell-project-warning">Comma-separated. Maps to EPUB <code>dc:subject</code>.</p>

          <label for="inkwell-ebook-series">Series</label>
          <input
            id="inkwell-ebook-series"
            type="text"
            value={ebook.series ?? ""}
            onblur={ebookStringChanged("series")}
          />

          <label for="inkwell-ebook-series-index">Series Index</label>
          <input
            id="inkwell-ebook-series-index"
            type="number"
            min="0"
            step="1"
            value={ebook.seriesIndex ?? ""}
            onblur={seriesIndexChanged}
          />
        </div>
      {/if}
    </div>
  {/if}
  <div class="inkwell-project-section word-counts">
    <button
      type="button"
      class="inkwell-project-details-section-header"
      onclick={() => { showWordCount = !showWordCount; }}
    >
      <Disclosure collapsed={!showWordCount} />
      <h4>Word Count</h4>
    </button>
    {#if showWordCount}
      <div>
        {#if sceneCount}
          <p title="Word count in this scene of this project.">
            <strong>Scene:</strong>
            {pluralize(sceneCount, "word")}
          </p>
        {/if}
        <p title="Word count for this project.">
          <strong>Project:</strong>
          {pluralize(projectCount, "word")}
        </p>
      </div>
    {/if}
  </div>
</div>

<style>
  .inkwell-project-section {
    margin-top: var(--size-4-4);
    padding-bottom: var(--size-4-2);
    padding-left: var(--size-4-8);
  }

  .inkwell-project-section + .inkwell-project-section {
    border-top: var(--border-width) solid var(--background-modifier-border);
    padding-top: var(--size-4-4);
  }

  .inkwell-project-details-section-header {
    display: flex;
    flex-direction: row;
    justify-content: start;
    align-items: center;
    cursor: pointer;
    margin-left: calc(var(--size-4-6) * -1);
    background: none;
    border: none;
    box-shadow: none;
    outline: none;
    padding: 0;
    width: 100%;
    text-align: left;
  }

  .inkwell-project-details-section-header:hover,
  .inkwell-project-details-section-header:focus,
  .inkwell-project-details-section-header:active {
    background: none;
    box-shadow: none;
    outline: none;
  }

  h4 {
    font-size: var(--font-ui-medium);
    color: var(--text-normal);
    user-select: none;
    font-weight: inherit;
    margin: 0 0 0 var(--size-4-4);
  }

  input {
    width: 100%;
  }

  label {
    display: block;
    font-size: var(--font-ui-smaller);
    color: var(--text-muted);
    margin-top: var(--size-4-4);
    line-height: var(--line-height-tight);
  }

  p.inkwell-project-warning {
    color: var(--text-faint);
    font-size: var(--font-smallest);
    margin: var(--size-2-1) 0 0 var(--size-2-1);
    line-height: normal;
  }

  .word-counts p {
    margin: var(--size-4-2) 0;
    font-size: var(--font-smallest);
    color: var(--text-muted);
  }

  .word-counts p strong {
    color: var(--text-normal);
  }

  textarea {
    width: 100%;
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
  }

  .inkwell-ebook-generate {
    flex-shrink: 0;
    font-size: var(--font-ui-smaller);
  }
</style>
