<script module lang="ts">

  function IndentPlugin() {
    let initialIndent = 0;
    let currentIndent = 0;
    let initialX = 0;
    let dragID: string | null = null;

    // eslint-disable-next-line unicorn/consistent-function-scoping -- Sortable.js plugin constructor; its prototype methods close over the drag state above
    function Indent(this: { defaults: { indentWidth: number; onIndentChange: () => void } }) {
      this.defaults = {
        indentWidth: 32,
        onIndentChange: () => {},
      };
    }

    Indent.prototype = {
      dragStart(e: any) {
        initialX = e.originalEvent.x;
        initialIndent = Math.trunc(Number(e.dragEl.dataset["indent"] ?? "")) || 0;
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

  // @ts-expect-error - Sortable's mount typing does not cover custom plugins
  Sortable.mount(new IndentPlugin());
</script>

<script lang="ts" generics="T extends { id: string; indent?: number }">
  import { onMount, type Snippet } from "svelte";
  import Sortable from "sortablejs/modular/sortable.core.esm.js";
  import type SortableType from "sortablejs";

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

  const {
    items = $bindable([]),
    sortableOptions = {},
    trackIndents = false,
    children,
    onorderChanged,
    onindentChanged,
    class: className,
  }: Props = $props();

  let listElement: HTMLElement | null = $state(null);

  onMount(() => {
    const opts: SortableType.Options & {
      indent?: boolean;
      onIndentChange?: (id: string, index: number, indent: number, width: number) => void;
    } = {
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
      ...sortableOptions
    };

    opts.store ||= {
      set: () => {},
      get: (sortable: SortableType) => sortable.toArray(),
    };
    const oldStoreSet = opts.store.set;
    opts.store.set = (sortable: SortableType) => {
      const sortedItems = sortable
        .toArray()
        .map((k) => items.find((i) => i.id === k))
        .filter((i): i is T => i !== undefined);
      onorderChanged?.(sortedItems);
      oldStoreSet(sortable);
    };

    if (listElement) {
      Sortable.create(listElement, opts);
    }
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
