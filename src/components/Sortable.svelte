<script lang="ts" generics="T extends { id: string }">
  // Pointer-based drag-and-drop list. Supports reorder within a list and dropping from another list in the same group.
  import type { Snippet } from 'svelte';
  import { onMount } from 'svelte';
  import { flip } from 'svelte/animate';
  import { fly } from 'svelte/transition';
  import { dnd } from '../lib/dnd.svelte';

  interface Props {
    items: T[];
    item: Snippet<[T]>;
    onreorder?: (ids: string[]) => void;
    ondropfrom?: (id: string, index: number) => void;
    group?: string;
    placeholder?: string;
    disabled?: boolean;
  }
  let { items, item, onreorder, ondropfrom, group = 'default', placeholder, disabled = false }: Props = $props();

  const listId = Math.random().toString(36).slice(2);
  let el: HTMLDivElement | undefined = $state();

  const isSource = $derived(dnd.active?.listId === listId);
  const overIndex = $derived(dnd.active && dnd.active.group === group && dnd.hoverList === listId ? dnd.hoverIndex : null);
  const showDrop = $derived(overIndex !== null);

  onMount(() =>
    dnd.register(listId, {
      group,
      drop(fromId, fromListId, index) {
        if (fromListId === listId) {
          const ids = items.map((i) => i.id);
          const fromIdx = ids.indexOf(fromId);
          if (fromIdx === -1) return;
          ids.splice(fromIdx, 1);
          let to = index;
          if (to > fromIdx) to -= 1;
          ids.splice(to, 0, fromId);
          if (ids.some((id, i) => id !== items[i]?.id)) onreorder?.(ids);
        } else {
          ondropfrom?.(fromId, index);
        }
      },
    }),
  );

  function onPointerDown(e: PointerEvent, id: string) {
    if (disabled) return;
    const target = e.target as HTMLElement;
    if (!target.closest('.handle')) return;
    if (e.button !== 0) return;
    e.preventDefault();
    const row = e.currentTarget as HTMLElement;
    dnd.start({ id, listId, group, x: e.clientX, y: e.clientY, width: row.offsetWidth, height: row.offsetHeight, label: row.innerText.split('\n')[0] ?? '' });
  }

  function indexAt(y: number): number {
    if (!el) return items.length;
    const rows = Array.from(el.querySelectorAll<HTMLElement>('[data-sort-row]'));
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i].getBoundingClientRect();
      if (y < r.top + r.height / 2) return i;
    }
    return rows.length;
  }

  function onPointerMove(e: PointerEvent) {
    if (!dnd.active || dnd.active.group !== group || !el) return;
    if (isSource) dnd.move(e.clientX, e.clientY);
    const r = el.getBoundingClientRect();
    const inside = e.clientX >= r.left - 8 && e.clientX <= r.right + 8 && e.clientY >= r.top - 12 && e.clientY <= r.bottom + 12;
    if (inside) dnd.hover(listId, indexAt(e.clientY));
    else if (dnd.hoverList === listId) dnd.hover(null, null);
  }
</script>

<svelte:window onpointermove={onPointerMove} />

<div class="sortable task-list" class:dragging={!!dnd.active && dnd.active.group === group} bind:this={el} role="list">
  {#each items as it, i (it.id)}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      data-sort-row
      class="row"
      class:ghost={dnd.active?.id === it.id}
      class:drop-before={showDrop && overIndex === i && !(isSource && dnd.active?.id === it.id)}
      animate:flip={{ duration: 220 }}
      out:fly={{ x: 40, duration: 260 }}
      onpointerdown={(e) => onPointerDown(e, it.id)}
    >
      {@render item(it)}
    </div>
  {/each}
  {#if showDrop && overIndex === items.length}
    <div class="drop-line"></div>
  {/if}
  {#if items.length === 0 && placeholder}
    <div class="placeholder" class:active={showDrop}>{placeholder}</div>
  {/if}
</div>

<style>
  .sortable {
    min-height: 8px;
  }
  .row {
    touch-action: pan-y;
  }
  .ghost {
    opacity: 0.35;
  }
  .drop-line {
    height: 3px;
    border-radius: 2px;
    background: var(--accent);
    margin: 2px 6px;
  }
  .drop-before {
    position: relative;
  }
  .drop-before::before {
    content: '';
    position: absolute;
    left: 6px;
    right: 6px;
    top: -5px;
    height: 3px;
    border-radius: 2px;
    background: var(--accent);
  }
  .placeholder {
    border: 1px dashed var(--border-strong);
    border-radius: var(--radius);
    padding: 14px;
    text-align: center;
    color: var(--text-faint);
    font-size: 13px;
  }
  .placeholder.active {
    border-color: var(--accent);
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 8%, transparent);
  }
</style>
