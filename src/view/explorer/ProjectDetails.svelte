<script lang="ts">
  import {
    EBOOK_STRING_KEYS,
    groupByAct,
    numberScenes,
    projectFolderPath,
    projects,
    selectedProject,
    selectedProjectPath,
    updateScenesProject,
  } from "src/model";
  import { getContext, onMount } from "svelte";
  import { FileSuggest } from "../settings/file-suggest";
  import { FolderSuggest } from "../settings/folder-suggest";
  import { normalizePath } from "obsidian";
  import { selectedProjectWordCountStatus } from "../stores";
  import { useApp } from "../utils";

  const app = useApp();

  const openEbookModal: () => void = getContext("openEbookModal");

  function titleChanged(event: Event) {
    let newTitle = (event.target as HTMLInputElement).value;
    projects.update((_projects) => {
      const currentIndex = _projects.findIndex(
        (p) => p.vaultPath === $selectedProjectPath
      );
      if (currentIndex !== -1) {
        const current = _projects[currentIndex];
        const currentTitle = current.title;
        let titleInFrontmatter = true;

        if (newTitle.length === 0) {
          newTitle = $selectedProjectPath!.split("/").at(-1)!.replace(/\.md$/u, "");
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

  let sceneFolderInput: HTMLInputElement | null = $state(null);
  onMount(() => {
    if (sceneFolderInput && $selectedProject!.format === "scenes") {
      const projectPath = projectFolderPath($selectedProject!, app.vault);
      new FolderSuggest(app, sceneFolderInput, projectPath);
    }
  });

  async function sceneFolderChanged(event: Event) {
    const newFolder = (event.target as HTMLInputElement).value;
    if (newFolder.length <= 0 || !$selectedProject) {
      return;
    }
    const root = app.vault.getAbstractFileByPath($selectedProject.vaultPath)!
      .parent!.path;
    const path = normalizePath(`${root}/${newFolder}`);
    const exists = await app.vault.adapter.exists(path);
    if (exists) {
      updateScenesProject($selectedProjectPath!, (p) => {
        p.sceneFolder = newFolder;
      });
    }
  }

  let sceneTemplateInput: HTMLInputElement | null = $state(null);
  onMount(() => {
    if (sceneTemplateInput && $selectedProject!.format === "scenes") {
      new FileSuggest(app, sceneTemplateInput);
    }
  });
  async function sceneTemplateChanged(event: Event) {
    let newTemplate: string | null = (event.target as HTMLInputElement).value;
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
      updateScenesProject($selectedProjectPath!, (p) => {
        p.sceneTemplate = newTemplate;
      });
    }
  }

  // ---- Overview ----
  const wordCount = $derived($selectedProjectWordCountStatus?.project ?? 0);
  const sceneCount = $derived(
    $selectedProject?.format === "scenes" ? $selectedProject.scenes.length : 0
  );
  const actCount = $derived(
    $selectedProject?.format === "scenes"
      ? groupByAct(numberScenes($selectedProject.scenes)).filter(
          (a) => a.children.length > 0
        ).length
      : 0
  );

  // ---- eBook completion (N / 11) ----
  const ebookSetCount = $derived.by(() => {
    const e = $selectedProject?.ebook ?? {};
    let n = 0;
    for (const key of EBOOK_STRING_KEYS) {
      const v = e[key];
      if (typeof v === "string" && v.trim().length > 0) n += 1;
    }
    if (Array.isArray(e.subjects) && e.subjects.length > 0) n += 1;
    if (typeof e.seriesIndex === "number" && Number.isFinite(e.seriesIndex)) n += 1;
    return n;
  });
  const EBOOK_FIELD_TOTAL = EBOOK_STRING_KEYS.length + 2;

  const sceneFolderHelp =
    "Changing the scene folder does not move scenes. Move them in your vault first, then update this.";
  const sceneTemplateHelp =
    "Used as a template when creating new scenes. Templater or the core Templates plugin will process it if enabled.";
</script>

<div class="inkwell-project">
  {#if $selectedProject}
    <div class="inkwell-overview">
      <span class="stat"><strong>{wordCount.toLocaleString()}</strong> words</span>
      {#if $selectedProject.format === "scenes"}
        <span class="sep">·</span>
        <span class="stat">{sceneCount} scene{sceneCount === 1 ? "" : "s"}</span>
        {#if actCount > 0}
          <span class="sep">·</span>
          <span class="stat">{actCount} act{actCount === 1 ? "" : "s"}</span>
        {/if}
      {/if}
    </div>

    <div class="field">
      <label for="inkwell-project-title">Title</label>
      <input
        id="inkwell-project-title"
        type="text"
        value={$selectedProject.title}
        onchange={titleChanged}
      />
    </div>

    {#if $selectedProject.format === "scenes"}
      <div class="field">
        <label for="inkwell-project-scene-folder">
          Scene folder
          <span class="inkwell-help" title={sceneFolderHelp} aria-label={sceneFolderHelp}
            >ⓘ</span
          >
        </label>
        <input
          id="inkwell-project-scene-folder"
          type="text"
          value={$selectedProject.sceneFolder}
          bind:this={sceneFolderInput}
          onblur={sceneFolderChanged}
        />
      </div>

      <div class="field">
        <label for="inkwell-project-scene-template">
          Scene template
          <span
            class="inkwell-help"
            title={sceneTemplateHelp}
            aria-label={sceneTemplateHelp}>ⓘ</span
          >
        </label>
        <input
          id="inkwell-project-scene-template"
          type="text"
          value={$selectedProject.sceneTemplate}
          bind:this={sceneTemplateInput}
          onblur={sceneTemplateChanged}
        />
      </div>
    {/if}

    <button type="button" class="inkwell-ebook-launcher" onclick={() => openEbookModal()}>
      <span class="inkwell-ebook-launcher-main">
        <span class="inkwell-ebook-launcher-title">eBook metadata</span>
        <span class="inkwell-ebook-launcher-sub">Author · cover · ISBN · series…</span>
      </span>
      <span class="inkwell-ebook-launcher-count"
        >{ebookSetCount} / {EBOOK_FIELD_TOTAL} set</span
      >
      <span class="inkwell-ebook-launcher-chevron">›</span>
    </button>
  {/if}
</div>

<style>
  .inkwell-project {
    display: flex;
    flex-direction: column;
    gap: var(--size-4-3);
    padding: var(--size-4-2) 0;
  }

  .inkwell-overview {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--size-4-1);
    padding: var(--size-4-2) var(--size-4-3);
    background: var(--background-secondary);
    border-radius: var(--radius-m);
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
  }

  .inkwell-overview .stat strong {
    color: var(--text-normal);
    font-size: var(--font-ui-small);
  }

  .inkwell-overview .sep {
    color: var(--text-faint);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--size-2-2);
  }

  .field label {
    display: flex;
    align-items: center;
    gap: var(--size-4-1);
    font-size: var(--font-ui-smaller);
    color: var(--text-muted);
  }

  .field input {
    width: 100%;
  }

  .inkwell-help {
    color: var(--text-faint);
    cursor: help;
    font-size: var(--font-ui-smaller);
  }

  .inkwell-help:hover {
    color: var(--text-accent);
  }

  .inkwell-ebook-launcher {
    display: flex;
    align-items: center;
    gap: var(--size-4-2);
    width: 100%;
    text-align: left;
    padding: var(--size-4-2) var(--size-4-3);
    background: var(--background-secondary);
    border: var(--border-width) solid var(--background-modifier-border);
    border-radius: var(--radius-m);
    cursor: pointer;
    box-shadow: none;
    height: auto;
  }

  .inkwell-ebook-launcher:hover {
    background: var(--background-modifier-hover);
    border-color: var(--background-modifier-border-hover);
  }

  .inkwell-ebook-launcher-main {
    display: flex;
    flex-direction: column;
    gap: var(--size-2-1);
    flex: 1;
    min-width: 0;
  }

  .inkwell-ebook-launcher-title {
    font-weight: 600;
    color: var(--text-normal);
  }

  .inkwell-ebook-launcher-sub {
    color: var(--text-faint);
    font-size: var(--font-ui-smaller);
  }

  .inkwell-ebook-launcher-count {
    flex-shrink: 0;
    padding: var(--size-2-1) var(--size-4-2);
    background: var(--background-secondary-alt);
    color: var(--text-accent);
    border-radius: var(--radius-l);
    font-size: var(--font-ui-smaller);
    font-weight: 600;
  }

  .inkwell-ebook-launcher-chevron {
    flex-shrink: 0;
    color: var(--text-muted);
    font-size: var(--font-ui-large);
    line-height: 1;
  }
</style>
