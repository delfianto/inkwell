<script lang="ts">
  import { Component, Keymap, MarkdownRenderer } from "obsidian";
  import { useApp } from "../utils";

  const { markdown, sourcePath }: { markdown: string; sourcePath: string } = $props();
  const app = useApp();
  let host = $state<HTMLDivElement>();

  $effect(() => {
    if (!host) return;
    const value = markdown;
    const path = sourcePath;

    const rendered = host.createDiv("inkwell-rendered-markdown");
    const owner = new Component();
    let active = true;
    owner.load();

    owner.registerDomEvent(rendered, "click", (event) => {
      const { target } = event;
      if (!target || !("closest" in target)) return;
      const href = (target as Element).closest<HTMLAnchorElement>("a.internal-link")?.dataset.href;
      if (!href) return;
      event.preventDefault();
      event.stopPropagation();
      void app.workspace.openLinkText(href, path, Keymap.isModEvent(event));
    });

    async function render() {
      try {
        await MarkdownRenderer.render(app, value, rendered, path, owner);
      } catch (error) {
        if (!active) return;
        rendered.empty();
        rendered.createEl("pre", { text: value });
        console.warn("[Inkwell] Could not render Markdown preview", error);
      }
    }
    void render();

    return () => {
      active = false;
      owner.unload();
      rendered.remove();
    };
  });
</script>

<div class="markdown-rendered preview" bind:this={host}></div>

<style>
  .preview {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .preview :global(.inkwell-rendered-markdown > :first-child) {
    margin-block-start: 0;
  }

  .preview :global(.inkwell-rendered-markdown > :last-child) {
    margin-block-end: 0;
  }
</style>
