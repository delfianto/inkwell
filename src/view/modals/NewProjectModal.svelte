<script lang="ts">
  import { normalizePath, type TFolder } from "obsidian";
  import { getContext } from "svelte";
  import Icon from "../components/Icon.svelte";

  const { parent }: { parent: TFolder } = $props();

  let type: "scenes" | "single" = $state("scenes");
  let title: string = $state("");

  const regex = /[:\\/]/u;
  const hasInvalidChars = $derived(title.length > 0 && regex.test(title));
  const valid = $derived(Boolean(title) && !regex.test(title));
  const projectPath = $derived.by(() => {
    if (!valid) return "";
    return type === "scenes"
      ? normalizePath(`${parent.path}/${title}/Index.md`)
      : normalizePath(`${parent.path}/${title}.md`);
  });
  const pathSegments = $derived(projectPath.length > 0 ? projectPath.split("/") : []);
  const parentLabel = $derived(parent.isRoot() ? "the vault root" : `“${parent.name}”`);

  const createProject: (
    format: "scenes" | "single",
    title: string,
    path: string
  ) => Promise<void> = getContext("createProject");
  const close: () => void = getContext("close");

  function onCreateProject() {
    if (valid) createProject(type, title, projectPath);
  }

  function autofocus(node: HTMLElement) {
    node.focus();
  }

  const types = [
    {
      id: "scenes" as const,
      icon: "book-text",
      name: "Multi-scene",
      desc: "Ordered notes + an index file. Novels & long works.",
    },
    {
      id: "single" as const,
      icon: "file-text",
      name: "Single note",
      desc: "One self-contained note. Short stories & essays.",
    },
  ];
</script>

<div class="inkwell-new-project">
  <p class="inkwell-np-subtitle">
    Created in {parentLabel} · you can rename or move it anytime.
  </p>

  <span class="inkwell-np-section-label">Project type</span>
  <div class="inkwell-np-types">
    {#each types as t}
      <button
        type="button"
        class="inkwell-type-card"
        class:selected={type === t.id}
        aria-pressed={type === t.id}
        onclick={() => {
          type = t.id;
        }}
      >
        <span class="inkwell-type-icon"><Icon iconName={t.icon} /></span>
        <span class="inkwell-type-name">{t.name}</span>
        <span class="inkwell-type-desc">{t.desc}</span>
        {#if type === t.id}
          <span class="inkwell-type-check"><Icon iconName="check" /></span>
        {/if}
      </button>
    {/each}
  </div>

  <label class="inkwell-np-section-label" for="inkwell-new-project-title">Title</label>
  <input
    id="inkwell-new-project-title"
    class="inkwell-np-title-input"
    type="text"
    placeholder="My Project Title"
    bind:value={title}
    use:autofocus
    onkeydown={(e) => {
      if (e.key === "Enter") onCreateProject();
    }}
  />

  <div class="inkwell-np-path" class:error={hasInvalidChars}>
    {#if valid}
      <span class="inkwell-np-path-arrow"><Icon iconName="corner-down-right" /></span>
      <span class="inkwell-np-path-text">
        {#each pathSegments as segment, i}
          <span class={i === pathSegments.length - 1 ? "leaf" : "crumb"}>{segment}</span
          >{#if i < pathSegments.length - 1}<span class="sep"> / </span>{/if}
        {/each}
      </span>
    {:else if hasInvalidChars}
      A title can’t contain the characters <code>: \ /</code>
    {:else}
      Enter a title to preview where it’ll be created.
    {/if}
  </div>

  <div class="inkwell-np-footer">
    <button type="button" onclick={() => close()}>Cancel</button>
    <button
      type="button"
      class="mod-cta"
      disabled={!valid}
      onclick={onCreateProject}>Create project</button
    >
  </div>
</div>

<style>
  .inkwell-new-project {
    display: flex;
    flex-direction: column;
  }

  .inkwell-np-subtitle {
    margin: 0 0 var(--size-4-3);
    color: var(--text-faint);
    font-size: var(--font-ui-smaller);
  }

  .inkwell-np-section-label {
    display: block;
    margin: var(--size-4-2) 0 var(--size-4-1);
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .inkwell-np-types {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--size-4-2);
  }

  .inkwell-type-card {
    position: relative;
    display: grid;
    grid-template-columns: auto 1fr;
    grid-template-areas:
      "icon name"
      "desc desc";
    align-items: center;
    gap: var(--size-2-2) var(--size-4-2);
    height: auto;
    text-align: left;
    padding: var(--size-4-3);
    background: var(--background-secondary);
    border: var(--border-width) solid var(--background-modifier-border);
    border-radius: var(--radius-m);
    cursor: pointer;
    box-shadow: none;
  }

  .inkwell-type-card:hover {
    background: var(--background-modifier-hover);
  }

  .inkwell-type-card.selected {
    border-color: var(--interactive-accent);
    background: var(--background-secondary-alt);
  }

  .inkwell-type-icon {
    grid-area: icon;
    color: var(--text-accent);
    display: flex;
  }

  .inkwell-type-icon :global(svg) {
    width: var(--icon-l);
    height: var(--icon-l);
  }

  .inkwell-type-name {
    grid-area: name;
    font-weight: 600;
    color: var(--text-normal);
  }

  .inkwell-type-desc {
    grid-area: desc;
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
    line-height: var(--line-height-tight);
    white-space: normal;
  }

  .inkwell-type-check {
    position: absolute;
    top: var(--size-4-2);
    right: var(--size-4-2);
    color: var(--interactive-accent);
    display: flex;
  }

  .inkwell-type-check :global(svg) {
    width: var(--icon-s);
    height: var(--icon-s);
  }

  .inkwell-np-title-input {
    width: 100%;
    font-size: var(--font-ui-large);
    padding: var(--size-4-2) var(--size-4-3);
  }

  .inkwell-np-path {
    display: flex;
    align-items: center;
    gap: var(--size-4-1);
    margin-top: var(--size-4-3);
    padding: var(--size-4-2) var(--size-4-3);
    background: var(--background-secondary);
    border-radius: var(--radius-s);
    font-size: var(--font-ui-smaller);
    color: var(--text-faint);
    min-height: var(--size-4-8);
  }

  .inkwell-np-path.error {
    color: var(--text-error);
  }

  .inkwell-np-path-arrow {
    display: flex;
    color: var(--text-faint);
  }

  .inkwell-np-path-arrow :global(svg) {
    width: var(--icon-s);
    height: var(--icon-s);
  }

  .inkwell-np-path-text {
    font-family: var(--font-monospace);
  }

  .inkwell-np-path-text .crumb {
    color: var(--text-muted);
  }

  .inkwell-np-path-text .leaf {
    color: var(--text-accent);
  }

  .inkwell-np-path-text .sep {
    color: var(--text-faint);
  }

  .inkwell-np-footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--size-4-2);
    margin-top: var(--size-4-4);
  }
</style>
