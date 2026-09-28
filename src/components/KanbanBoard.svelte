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
    --cc: var(--accent);
    background: var(--glass);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1px solid var(--border);
    border-top: 3px solid var(--cc);
    border-radius: var(--radius, 12px);
    padding: 10px;
    min-height: 120px;
    box-shadow:
      inset 0 1px 0 var(--sheen),
      inset 0 14px 28px -22px var(--cc),
      var(--shadow-sm);
    animation: rise-in var(--dur-slow) var(--ease) both;
    transition:
      border-color 0.15s,
      background 0.15s,
      box-shadow var(--dur-slow);
  }
  .col:nth-child(2) {
    --cc: var(--warn);
    animation-delay: 60ms;
  }
  .col:nth-child(3) {
    --cc: var(--success);
    animation-delay: 120ms;
  }
  .col.over {
    border-color: var(--cc);
    background: color-mix(in srgb, var(--cc) 10%, var(--bg-elev));
    box-shadow:
      inset 0 0 0 1px color-mix(in srgb, var(--cc) 40%, transparent),
      0 0 30px -8px color-mix(in srgb, var(--cc) 60%, transparent);
  }
  h2 {
    font-size: 14px;
    margin: 0 0 8px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .count {
    font-size: 11px;
    color: var(--text-muted);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    padding: 0 7px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--cc) 14%, var(--bg-elev-2));
    border: 1px solid color-mix(in srgb, var(--cc) 30%, var(--border));
    line-height: 1.6;
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
    box-shadow:
      inset 0 1px 0 var(--sheen),
      var(--shadow-sm);
    transition:
      transform var(--dur-slow) var(--spring),
      box-shadow var(--dur-slow) var(--ease),
      border-color var(--dur);
  }
  .card:hover {
    transform: translateY(-2px);
    border-color: color-mix(in srgb, var(--course, var(--accent)) 45%, var(--border-strong));
    box-shadow:
      inset 0 1px 0 var(--sheen),
      var(--shadow),
      0 0 24px -12px var(--course, var(--accent));
  }
  .card.dragging {
    opacity: 0.5;
    transform: rotate(-2deg) scale(0.98);
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
  .mv {
    transition:
      transform var(--dur) var(--spring),
      border-color var(--dur),
      color var(--dur);
  }
  .mv:hover {
    color: var(--text);
    border-color: var(--accent);
    transform: scale(1.12);
    box-shadow: 0 0 10px -3px var(--accent);
  }
  .empty-col {
    font-size: 12px;
    color: var(--text-muted);
    margin: 4px 2px;
  }
</style>
