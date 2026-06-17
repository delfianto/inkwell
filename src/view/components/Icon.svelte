<script lang="ts">
  import { setIcon } from "obsidian";

  let { iconName = "" }: { iconName?: string } = $props();

  const icon = (node: HTMLElement, icon: string) => {
    setIcon(node, icon);
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
