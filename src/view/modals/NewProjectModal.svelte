<script lang="ts">
  import { normalizePath, type TFolder } from "obsidian";
  import { getContext } from "svelte";

  const { parent }: { parent: TFolder } = $props();

  let type: "scenes" | "single" = $state("scenes");
  let title: string = $state("");

  const regex = /[:\\/]/u;
  const valid = $derived(Boolean(title) && !regex.test(title));
  const projectPath = $derived.by(() => {
    if (!valid) return "";
    return type === "scenes"
      ? normalizePath(`${parent.path}/${title}/Index.md`)
      : normalizePath(`${parent.path}/${title}.md`);
  });

  const createProject: (
    format: "scenes" | "single",
    title: string,
    path: string
  ) => Promise<void> = getContext("createProject");
  function onCreateProject() {
    createProject(type, title, projectPath);
  }
</script>

<div>
  <div class="switch-container">
    <button
      type="button"
      class:selected={type === "scenes"}
      onclick={() => { type = "scenes"; }}>Multi</button
    >
    <button
      type="button"
      class:selected={type === "single"}
      onclick={() => { type = "single"; }}>Single</button
    >
  </div>
  <div>
    {#if type === "scenes"}
      <p>
        A <i>multi-scene project</i> is comprised of many ordered notes, called "scenes,"
        that you can combine together into your manuscript. It also includes an index
        file, the YAML frontmatter of which is used by Inkwell to track your project.
      </p>
      <p>
        Because this project type involves multiple notes, Inkwell will create
        an enclosing folder for your project and its scenes. You can always
        rename the folder, the index file, or both.
      </p>
    {:else}
      <p>
        A <i>single-scene project</i> is a single note, perhaps a short story or
        essay, that includes its own YAML frontmatter which is used by Inkwell to
        track your project.
      </p>
    {/if}
  </div>
  <div>
    <label for="inkwell-new-project-title">Title</label>
    <input
      id="inkwell-new-project-title"
      type="text"
      placeholder="My Project Title"
      bind:value={title}
      onkeydown={(e) => {
        if (e.key === "Enter") {
          onCreateProject();
        }
      }}
    />
  </div>
  <div>
    {#if valid}
      <p class="create-project-prompt">
        You are creating a <b
          >{type === "scenes" ? "multi-scene" : "single-scene"} project</b
        >
        at
        <span class="target-path">{projectPath}</span>
      </p>
      <div class="project-creation-container">
        <button type="button" onclick={onCreateProject}>Create</button>
      </div>
    {/if}
  </div>
</div>

<style>
  .switch-container {
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
  }

  .switch-container button {
    margin: 0;
    font-weight: bold;
  }

  .switch-container button:first-child {
    border-radius: var(--radius-s) 0 0 var(--radius-s);
  }

  .switch-container button:last-child {
    border-radius: 0 var(--radius-s) var(--radius-s) 0;
  }

  .switch-container button.selected {
    background-color: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .switch-container button {
    box-shadow: var(--input-shadow);
  }

  .target-path {
    color: var(--text-accent);
  }

  label {
    font-weight: bold;
    color: var(--text-muted);
    display: block;
    font-size: var(--font-smallest);
  }

  input[type="text"] {
    width: 100%;
    font-size: var(--h2-size);
    height: var(--size-4-12);
    padding: var(--size-4-2);
  }

  .project-creation-container {
    display: flex;
    flex-direction: row;
    justify-content: end;
  }

  .project-creation-container button {
    font-weight: bold;
    background-color: var(--interactive-accent);
    color: var(--text-on-accent);
    margin: 0;
  }
</style>
