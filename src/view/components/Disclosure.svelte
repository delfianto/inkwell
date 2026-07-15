<script lang="ts">
  const {
    collapsed = false,
    class: className = "",
    onclick,
  }: {
    collapsed?: boolean;
    class?: string;
    onclick?: (e: MouseEvent) => void;
  } = $props();
</script>

<button type="button" aria-label={collapsed ? "Expand" : "Collapse"} class:collapsed class={className} {onclick}>
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon right-triangle"><path d="M3 8L12 17L21 8"></path></svg>
</button>

<style>
  button {
    background: none;
    border: none;
    box-shadow: none;
    outline: none;
    padding: 0;
    cursor: pointer;
  }

  button:hover,
  button:focus,
  button:active {
    background: none;
    box-shadow: none;
    outline: none;
  }

  .right-triangle {
    transition: transform 0.3s;
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--size-4-3);
    color: var(--icon-color);
    margin-left: calc(var(--size-4-1) * -1);
    margin-top: calc(var(--size-4-1) * -.25);
  }

  .collapsed .right-triangle {
    transform: rotate(-90deg);
  }
</style>
