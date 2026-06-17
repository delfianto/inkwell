<script module lang="ts">
  import { toInteger } from "lodash";

  function IndentPlugin() {
    let initialIndent = 0;
    let currentIndent = 0;
    let initialX = 0;
    let dragID: string = null;

    function Indent(this: { defaults: { indentWidth: number; onIndentChange: () => void } }) {
      this.defaults = {
        indentWidth: 32,
        onIndentChange: () => {},
      };
    }

    Indent.prototype = {
      dragStart(e: any) {
        initialX = e.originalEvent.x;
        initialIndent = toInteger(e.dragEl.dataset["indent"]);
        currentIndent = initialIndent;
        dragID = e.dragEl.dataset["id"];
      },
      dragOver(e: any) {
        const x = e.originalEvent.x - initialX;
        const indentDiff = Math.trunc(x / this.options.indentWidth);
        const newIndent = Math.max(initialIndent + indentDiff, 0);
        if (currentIndent !== newIndent) {
          this.options.onIndentChange(
            dragID,
            e.newIndex || e.oldIndex,
            newIndent,
            this.options.indentWidth
          );
        }
        currentIndent = newIndent;
      },
    };

    return Object.assign(Indent, {
      pluginName: "indent",
      eventProperties() {
        return {
          currentIndent,
        };
      },
    });
  }

  // @ts-ignore
  Sortable.mount(new IndentPlugin());
</script>

<script lang="ts" generics="T extends { id: string; indent?: number; [key: string]: unknown }">
  import type { Snippet } from "svelte";
  import type SortableType from "sortablejs";
  import Sortable from "sortablejs/modular/sortable.core.esm.js";
  import { onMount } from "svelte";

  interface Props {
    items?: T[];
    sortableOptions?: SortableType.Options;
    trackIndents?: boolean;
    children: Snippet<[T]>;
    onorderChanged?: (items: T[]) => void;
    onindentChanged?: (detail: {
      itemID: string;
      itemIndex: number;
      newIndent: number;
      indentWidth: number;
    }) => void;
    class?: string;
  }

  let {
    items = $bindable([]),
    sortableOptions = {},
    trackIndents = false,
    children,
    onorderChanged,
    onindentChanged,
    class: className,
  }: Props = $props();

  let listElement: HTMLElement = $state(null);

  onMount(() => {
    const opts: SortableType.Options = Object.assign(
      {
        indent: trackIndents,
        onIndentChange: (
          itemID: string,
          itemIndex: number,
          newIndent: number,
          indentWidth: number
        ) => {
          if (trackIndents) {
            onindentChanged?.({ itemID, itemIndex, newIndent, indentWidth });
          }
        },
        delayOnTouchOnly: true,
        delay: 400,
      },
      sortableOptions
    );

    opts.store = opts.store || {
      set: () => {},
      get: (sortable: SortableType) => sortable.toArray(),
    };
    const oldStoreSet = opts.store.set;
    opts.store.set = (sortable: SortableType) => {
      const sortedItems = sortable
        .toArray()
        .map((k) => items.find((i) => i.id === k));
      onorderChanged?.(sortedItems);
      oldStoreSet(sortable);
    };

    Sortable.create(listElement, opts);
  });
</script>

<ul bind:this={listElement} class={className}>
  {#each items as item (item.id)}
    <li data-id={item.id} data-indent={item.indent ?? 0}>
      {@render children(item)}
    </li>
  {/each}
</ul>

<style>
</style>
