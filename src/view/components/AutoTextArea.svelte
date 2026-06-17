<script lang="ts">
  // via https://svelte.dev/repl/40f4c7846e6f4052927ff5f9c5271b66?version=3.6.8

  let {
    value = $bindable(""),
    minRows = 1,
    maxRows,
    ...rest
  }: {
    value?: string;
    minRows?: number;
    maxRows?: number;
    placeholder?: string;
    [key: string]: unknown;
  } = $props();

  let minHeight = $derived(`${minRows * 1.2}rem`);
  let maxHeight = $derived(maxRows ? `${1 + maxRows * 1.2}rem` : "auto");
</script>

<div class="container">
  <pre
    aria-hidden="true"
    style="min-height: {minHeight}; max-height: {maxHeight}">{value +
      "\n"}</pre>

  <textarea bind:value {...rest}></textarea>
</div>

<style>
  .container {
    position: relative;
  }

  pre,
  textarea {
    font-family: inherit;
    padding: var(--size-4-2);
    box-sizing: border-box;
    border: none;
    line-height: 1.2;
    overflow: hidden;
  }

  textarea {
    position: absolute;
    width: 100%;
    height: 100%;
    top: 0;
    resize: none;
  }
</style>
