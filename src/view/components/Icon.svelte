<script lang="ts">
  import { setIcon } from "obsidian";

  const { iconName = "" }: { iconName?: string } = $props();

  const icon = (node: HTMLElement, name: string) => {
    setIcon(node, name);
  };
</script>

{#if iconName.length > 0}
  <span use:icon={iconName}></span>
{/if}

<style>
  span {
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
