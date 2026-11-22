<script lang="ts">
  import { DEFAULT_CODEX_FOLDER, ensureCodexFolders } from "src/model/codex";
  import {
    DEFAULT_SCENE_FOLDER,
    EBOOK_STRING_KEYS,
    groupByAct,
    numberScenes,
    projectFolderPath,
    projects,
    scenePathForFolder,
    selectedProject,
    selectedProjectPath,
    unlistedSceneNames,
    updateScenesProject,
  } from "src/model";
  import { getContext, onMount } from "svelte";
  import { Platform, TFile, TFolder } from "obsidian";
  import { relativeVaultPath, resolveRelativeVaultPath, vaultParentPath } from "src/lib/path";
  import { ensureVaultFolder } from "src/model/note-create";
  import { FolderSuggest } from "../settings/folder-suggest";
  import Icon from "../components/Icon.svelte";
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
  let codexFolderInput: HTMLInputElement | null = $state(null);
  const folderErrors = $state({ scenes: "", codex: "" });

  onMount(() => {
    const project = $selectedProject;
    if (project?.format !== "scenes" || !sceneFolderInput || !codexFolderInput) return;
    const root = projectFolderPath(project, app.vault) || vaultParentPath(project.vaultPath);
    const scenes = new FolderSuggest(app, sceneFolderInput, root);
    const codex = new FolderSuggest(app, codexFolderInput, root);
    return () => {
      scenes.close();
      codex.close();
    };
  });

  async function folderChanged(event: FocusEvent, kind: "scenes" | "codex") {
    const project = $selectedProject;
    if (project?.format !== "scenes") return;

    const input = event.currentTarget as HTMLInputElement;
    const root = projectFolderPath(project, app.vault) || vaultParentPath(project.vaultPath);
    const fallback = kind === "scenes" ? DEFAULT_SCENE_FOLDER : DEFAULT_CODEX_FOLDER;
    const raw = input.value.trim().replaceAll("\\", "/") || fallback;
    const path = resolveRelativeVaultPath(root, raw);
    if (!path || (raw.startsWith("/") && raw !== "/")) {
      folderErrors[kind] = "Enter a folder path relative to the project folder.";
      return;
    }
    const relative = relativeVaultPath(root, path);
    const previous = kind === "scenes" ? project.sceneFolder : project.codexFolder ?? DEFAULT_CODEX_FOLDER;

    folderErrors[kind] = "";
    input.value = relative;
    const changed = resolveRelativeVaultPath(root, previous) !== path;
    if (!changed && kind === "scenes") return;

    if (kind === "scenes" && project.scenes.some(({ title }) =>
      !(app.vault.getAbstractFileByPath(scenePathForFolder(title, path)) instanceof TFile),
    )) {
      folderErrors[kind] = "Choose a folder containing every scene in this manuscript.";
      return;
    }

    try {
      await (kind === "codex"
        ? ensureCodexFolders(app.vault, path)
        : ensureVaultFolder(app.vault, path));
    } catch (error) {
      console.error("[Inkwell] Could not prepare project folder", error);
      folderErrors[kind] = "Could not use this folder. Choose another folder.";
      return;
    }
    if (!changed) return;

    const folder = path === "/" ? app.vault.getRoot() : app.vault.getAbstractFileByPath(path);
    const names = folder instanceof TFolder
      ? folder.children
          .filter((file): file is TFile => file instanceof TFile && file.extension === "md" &&
            file.path !== project.vaultPath)
          .map((file) => file.basename)
      : [];
    updateScenesProject(project.vaultPath, (current) => {
      if (kind === "scenes") {
        current.sceneFolder = relative;
        current.unknownFiles = unlistedSceneNames(names, current.scenes, current.ignoredFiles);
      } else {
        current.codexFolder = relative;
      }
    });
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

  const sceneFolderHelp = "Relative to the project folder. Use . for the project folder itself.";
  const codexFolderHelp = "Relative to the project folder. Contains Assets, Characters, Locations, and Timeline.";
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
          value={$selectedProject.sceneFolder === "/" ? "." : $selectedProject.sceneFolder}
          bind:this={sceneFolderInput}
          onblur={(event) => folderChanged(event, "scenes")}
          aria-invalid={!!folderErrors.scenes}
          aria-describedby={folderErrors.scenes ? "inkwell-scene-folder-error" : undefined}
        />
        {#if folderErrors.scenes}
          <p class="inkwell-story-error" id="inkwell-scene-folder-error" role="alert">{folderErrors.scenes}</p>
        {/if}
      </div>

      <div class="field">
        <label for="inkwell-project-codex-folder">
          Codex folder
          <span class="inkwell-help" title={codexFolderHelp} aria-label={codexFolderHelp}>ⓘ</span>
        </label>
        <input
          id="inkwell-project-codex-folder"
          type="text"
          value={$selectedProject.codexFolder ?? DEFAULT_CODEX_FOLDER}
          bind:this={codexFolderInput}
          onblur={(event) => folderChanged(event, "codex")}
          aria-invalid={!!folderErrors.codex}
          aria-describedby={folderErrors.codex ? "inkwell-codex-folder-error" : undefined}
        />
        {#if folderErrors.codex}
          <p class="inkwell-story-error" id="inkwell-codex-folder-error" role="alert">{folderErrors.codex}</p>
        {/if}
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
    {#if !Platform.isMobile}
      <button type="button" class="mod-cta project-compile"
        onclick={() => app.commands.executeCommandById("inkwell:inkwell-open-compile-builder")}>
        <Icon iconName="package" /> Open Compile builder
      </button>
    {/if}
  {/if}
</div>

<style>
  .project-compile {
    width: 100%;
    gap: var(--size-4-2);
  }

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
