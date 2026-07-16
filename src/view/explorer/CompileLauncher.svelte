<script lang="ts">
  import Icon from "../components/Icon.svelte";
  import { useApp } from "../utils";

  const app = useApp();

  function open() {
    app.commands.executeCommandById("inkwell:inkwell-open-compile-builder");
  }
</script>

<div class="inkwell-compile-launcher">
  <div class="inkwell-compile-launcher-icon"><Icon iconName="blocks" /></div>
  <h3>Compile builder</h3>
  <p>
    Build and run your compile workflow in a full pane — steps on the left,
    the selected step's options on the right.
  </p>
  <button type="button" class="mod-cta" onclick={open}>Open compile builder</button>
</div>

<style>
  .inkwell-compile-launcher {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: var(--size-4-2);
    padding: var(--size-4-6) var(--size-4-4);
  }

  .inkwell-compile-launcher-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--size-4-16);
    height: var(--size-4-16);
    border-radius: 50%;
    background: var(--background-secondary-alt);
    color: var(--text-accent);
  }

  .inkwell-compile-launcher-icon :global(svg) {
    width: var(--icon-l);
    height: var(--icon-l);
  }

  .inkwell-compile-launcher h3 {
    margin: 0;
    font-size: var(--font-ui-medium);
    color: var(--text-normal);
  }

  .inkwell-compile-launcher p {
    margin: 0;
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
    line-height: var(--line-height-tight);
  }

  .inkwell-compile-launcher .mod-cta {
    margin-top: var(--size-4-1);
  }
</style>
