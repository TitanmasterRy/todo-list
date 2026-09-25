<script lang="ts">
  import { store, byDueThenOrder, byOrder } from '../lib/store.svelte';
  import { ui } from '../lib/ui.svelte';
  import type { Task, TaskType } from '../lib/types';
  import { TASK_TYPES } from '../lib/types';
  import { dueKey } from '../lib/dates';
  import QuickAdd from '../components/QuickAdd.svelte';
  import TaskItem from '../components/TaskItem.svelte';
  import Sortable from '../components/Sortable.svelte';

  type Status = 'open' | 'done' | 'all';
  type Sort = 'due' | 'manual' | 'priority' | 'created';
  let status = $state<Status>('open');
  let courseId = $state('');
  let tag = $state('');
  let type = $state<'' | TaskType>('');
  let from = $state('');
  let to = $state('');
  let sort = $state<Sort>('due');
  let searchInput: HTMLInputElement | undefined = $state();

  $effect(() => {
    if (ui.search && searchInput) {
      searchInput.focus();
      ui.search = false;
    }
  });

  const prioRank = { urgent: 0, high: 1, normal: 2, low: 3 } as const;
  const q = $derived(ui.searchQuery.trim().toLowerCase());
  const live = (t: Task) => !t.completedAt || store.lingering.has(t.id);
  const filtered = $derived.by(() => {
    let list = store.tasks.filter((t) => !t.archived);
    if (status === 'open') list = list.filter(live);
    else if (status === 'done') list = list.filter((t) => t.completedAt);
    if (courseId === 'none') list = list.filter((t) => !t.courseId);
    else if (courseId) list = list.filter((t) => t.courseId === courseId);
    if (tag) list = list.filter((t) => t.tags.includes(tag));
    if (type) list = list.filter((t) => t.type === type);
    if (from) list = list.filter((t) => t.dueAt && dueKey(t.dueAt) >= from);
    if (to) list = list.filter((t) => t.dueAt && dueKey(t.dueAt) <= to);
    if (q) {
      list = list.filter((t) => {
        const c = store.courseById(t.courseId)?.name ?? '';
        const hay = `${t.title} ${t.notes ?? ''} ${t.tags.map((x) => '#' + x).join(' ')} ${c} ${t.subtasks.map((s) => s.title).join(' ')}`.toLowerCase();
        return q.split(/\s+/).every((w) => hay.includes(w));
      });
    }
    switch (sort) {
      case 'manual':
        return list.sort(byOrder);
      case 'priority':
        return list.sort((a, b) => prioRank[a.priority] - prioRank[b.priority] || byDueThenOrder(a, b));
      case 'created':
        return list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      default:
        return list.sort((a, b) => {
          if (!!a.dueAt !== !!b.dueAt) return a.dueAt ? -1 : 1;
          return byDueThenOrder(a, b);
        });
    }
  });
  const ids = $derived(filtered.map((t) => t.id));
  const hasFilters = $derived(!!(courseId || tag || type || from || to || q || status !== 'open'));

  function clear() {
    status = 'open';
    courseId = '';
    tag = '';
    type = '';
    from = '';
    to = '';
    ui.searchQuery = '';
  }
</script>

<div class="page">
  <header class="page-head">
    <div>
      <h1>Inbox</h1>
      <div class="sub">Everything, with filters.</div>
    </div>
    <div class="grow"></div>
    <button class="btn sm" class:primary={store.bulkMode} onclick={() => (store.bulkMode ? store.clearSelection() : (store.bulkMode = true))}
      >{store.bulkMode ? 'Done selecting' : 'Select'}</button
    >
  </header>

  <QuickAdd />

  <div class="filters" role="search">
    <input class="input search" bind:this={searchInput} bind:value={ui.searchQuery} placeholder="Search tasks…  ( / )" aria-label="Search" data-search />
    <select class="select" bind:value={status} aria-label="Status">
      <option value="open">Open</option>
      <option value="done">Completed</option>
      <option value="all">All</option>
    </select>
    <select class="select" bind:value={courseId} aria-label="Course">
      <option value="">Any course</option>
      <option value="none">No course</option>
      {#each store.courses as c (c.id)}
        <option value={c.id}>{c.emoji ? c.emoji + ' ' : ''}{c.name}{c.archived ? ' (archived)' : ''}</option>
      {/each}
    </select>
    <select class="select" bind:value={tag} aria-label="Tag">
      <option value="">Any tag</option>
      {#each store.allTags as t}
        <option value={t}>#{t}</option>
      {/each}
    </select>
    <select class="select" bind:value={type} aria-label="Type">
      <option value="">Any type</option>
      {#each TASK_TYPES as t}
        <option value={t}>{t}</option>
      {/each}
    </select>
    <label class="range"><span>From</span><input class="input" type="date" bind:value={from} aria-label="Due from" /></label>
    <label class="range"><span>To</span><input class="input" type="date" bind:value={to} aria-label="Due to" /></label>
    <select class="select" bind:value={sort} aria-label="Sort">
      <option value="due">Sort: due</option>
      <option value="priority">Sort: priority</option>
      <option value="manual">Sort: manual</option>
      <option value="created">Sort: newest</option>
    </select>
    {#if hasFilters}<button class="btn ghost sm" onclick={clear}>Clear</button>{/if}
  </div>

  <div class="section-title"><span>{status === 'done' ? 'Completed' : status === 'all' ? 'All tasks' : 'Open'}</span><span class="count">{filtered.length}</span></div>
  {#if sort === 'manual' && status === 'open'}
    <Sortable items={filtered} group="inbox" onreorder={(i) => store.reorder(i)}>
      {#snippet item(task)}
        <TaskItem {task} listIds={ids} dragHandle />
      {/snippet}
    </Sortable>
  {:else}
    <div class="task-list" role="list">
      {#each filtered as task (task.id)}
        <div role="listitem"><TaskItem {task} listIds={ids} /></div>
      {/each}
    </div>
  {/if}
  {#if !filtered.length}
    <div class="empty">
      <div class="big">{hasFilters ? '🔍' : '📭'}</div>
      <h3>{hasFilters ? 'No matches' : 'Inbox zero'}</h3>
      <p>{hasFilters ? 'Try clearing a filter.' : 'Nothing open. Enjoy it.'}</p>
    </div>
  {/if}
</div>

<style>
  .filters {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 12px 0 4px;
    align-items: center;
  }
  .filters .select,
  .filters .input {
    width: auto;
    padding: 6px 10px;
    font-size: 13px;
  }
  .search {
    flex: 1 1 200px;
    min-width: 160px;
  }
  .range {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: var(--text-muted);
  }
</style>
