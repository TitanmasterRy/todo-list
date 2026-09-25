<script lang="ts">
  // Course page → Board: To do / Doing / Done. Drag cards between columns, or use the ← → buttons.
  import { store } from '../lib/store.svelte';
  import { boardColumns, COLUMNS, neighbor, type Column } from '../lib/board';
  import { formatDue, formatMinutes, isOverdue, isDueToday } from '../lib/dates';
  import type { Task } from '../lib/types';

  let { tasks }: { tasks: Task[] } = $props();

  const cols = $derived(boardColumns(tasks, store.today));
  let dragId = $state<string | null>(null);
  let over = $state<Column | null>(null);

  function drop(e: DragEvent, col: Column) {
    e.preventDefault();
    const id = dragId ?? e.dataTransfer?.getData('text/x-task-id');
    over = null;
    dragId = null;
    if (id) store.moveToColumn(id, col);
  }
</script>

<div class="board">
  {#each COLUMNS as c (c.id)}
    <section
      class="col"
      class:over={over === c.id}
      aria-labelledby="col-{c.id}"
      ondragover={(e) => {
        if (!dragId) return;
        e.preventDefault();
        over = c.id;
      }}
      ondragleave={() => over === c.id && (over = null)}
      ondrop={(e) => drop(e, c.id)}
    >
      <h2 id="col-{c.id}">{c.emoji} {c.label} <span class="count">{cols[c.id].length}</span></h2>
      <ul role="list">
        {#each cols[c.id] as t (t.id)}
          {@const late = !t.completedAt && isOverdue(t.dueAt, store.now) && !isDueToday(t.dueAt, store.now)}
          <li
            class="card"
            class:dragging={dragId === t.id}
            draggable="true"
            ondragstart={(e) => {
              dragId = t.id;
              e.dataTransfer?.setData('text/x-task-id', t.id);
              if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
            }}
            ondragend={() => ((dragId = null), (over = null))}
          >
            <button class="title" onclick={() => (store.editingTaskId = t.id)}>{t.title}</button>
            <div class="meta">
              {#if t.dueAt}<span class:late>{late ? '⚠ ' : ''}{formatDue(t.dueAt, store.now, store.settings.timeFormat)}</span>{/if}
              {#if t.estimateMin}<span>⏱ {formatMinutes(t.estimateMin)}</span>{/if}
              {#if t.subtasks.length}<span>☑ {t.subtasks.filter((s) => s.done).length}/{t.subtasks.length}</span>{/if}
              <span class="grow"></span>
              {#if neighbor(c.id, -1)}
                {@const to = neighbor(c.id, -1)!}
                <button class="mv" onclick={() => store.moveToColumn(t.id, to)} aria-label="Move {t.title} to {COLUMNS.find((x) => x.id === to)?.label}">←</button>
              {/if}
              {#if neighbor(c.id, 1)}
                {@const to = neighbor(c.id, 1)!}
                <button class="mv" onclick={() => store.moveToColumn(t.id, to)} aria-label="Move {t.title} to {COLUMNS.find((x) => x.id === to)?.label}">→</button>
              {/if}
            </div>
          </li>
        {/each}
      </ul>
      {#if !cols[c.id].length}<p class="empty-col">
          {c.id === 'doing' ? 'Drag something here when you start it.' : c.id === 'done' ? 'Finished work shows here for two weeks.' : 'Nothing to do.'}
        </p>{/if}
    </section>
  {/each}
</div>

<style>
  .board {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
    margin-top: 12px;
    align-items: start;
  }
  @media (max-width: 720px) {
    .board {
      grid-template-columns: 1fr;
    }
  }
  .col {
    background: var(--bg-sunken, var(--bg-elev));
    border: 1px solid var(--border);
    border-radius: var(--radius, 12px);
    padding: 10px;
    min-height: 120px;
    transition:
      border-color 0.15s,
      background 0.15s;
  }
  .col.over {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 8%, var(--bg-elev));
  }
  h2 {
    font-size: 14px;
    margin: 0 0 8px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .count {
    font-size: 12px;
    color: var(--text-muted);
    font-weight: 500;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 8px;
  }
  .card {
    background: var(--bg-elev);
    border: 1px solid var(--border);
    border-left: 3px solid var(--course, var(--accent));
    border-radius: 10px;
    padding: 8px 10px;
    cursor: grab;
  }
  .card.dragging {
    opacity: 0.5;
  }
  .title {
    text-align: left;
    font-size: 14px;
    font-weight: 600;
    color: var(--text);
    width: 100%;
  }
  .meta {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 4px;
    font-size: 12px;
    color: var(--text-muted);
  }
  .late {
    color: var(--danger-text);
  }
  .grow {
    flex: 1;
  }
  .mv {
    padding: 2px 8px;
    border-radius: 6px;
    border: 1px solid var(--border);
    color: var(--text-muted);
    font-size: 13px;
  }
  .mv:hover {
    color: var(--text);
    border-color: var(--border-strong, var(--border));
  }
  .empty-col {
    font-size: 12px;
    color: var(--text-muted);
    margin: 4px 2px;
  }
</style>
