<script lang="ts">
  import { onDestroy } from 'svelte';
  import { store } from '../lib/store.svelte';
  import { ui } from '../lib/ui.svelte';
  import type { TaskType } from '../lib/types';
  import { TASK_TYPES } from '../lib/types';
  import { applyFilter, EMPTY_FILTER, isFiltered, LIST_PRESETS, type FilterSort, type FilterStatus, type SavedList, type TaskFilter } from '../lib/filters';
  import { uid } from '../lib/id';
  import { toasts } from '../lib/toast.svelte';
  import QuickAdd from '../components/QuickAdd.svelte';
  import TaskItem from '../components/TaskItem.svelte';
  import Sortable from '../components/Sortable.svelte';

  type Status = FilterStatus;
  type Sort = FilterSort;
  let status = $state<Status>('open');
  let courseId = $state('');
  let tag = $state('');
  let type = $state<'' | TaskType>('');
  let from = $state('');
  let to = $state('');
  let sort = $state<Sort>('due');
  let dueWindow = $state<'' | 'overdue' | '7' | '14' | '30'>('');
  let prio = $state<'' | 'high' | 'urgent'>('');
  let blocked = $state<'' | 'hide' | 'only'>('');
  let searchInput: HTMLInputElement | undefined = $state();
  let saving = $state(false);
  let listName = $state('');
  let listEmoji = $state('📋');

  $effect(() => {
    if (ui.search && searchInput) {
      searchInput.focus();
      ui.search = false;
    }
  });

  const filter = $derived<TaskFilter>({
    status,
    courseId,
    tag,
    type,
    from,
    to,
    q: ui.searchQuery,
    sort,
    ...(dueWindow === 'overdue' ? { overdue: true } : dueWindow ? { withinDays: Number(dueWindow) } : {}),
    ...(prio === 'urgent' ? { priorities: ['urgent'] } : prio === 'high' ? { priorities: ['urgent', 'high'] } : {}),
    ...(blocked ? { blocked } : {}),
  });
  const filtered = $derived(
    applyFilter(store.tasks, filter, { today: store.today, courseName: (id) => store.courseById(id)?.name ?? '', lingering: store.lingering, byId: store.byId }),
  );
  const ids = $derived(filtered.map((t) => t.id));
  const hasFilters = $derived(isFiltered(filter));
  const activeList = $derived(store.settings.smartLists.find((l) => l.id === ui.inboxList));

  /** Load a saved list's filter into the controls. */
  function load(f: TaskFilter) {
    status = f.status;
    courseId = f.courseId;
    tag = f.tag;
    type = f.type;
    from = f.from;
    to = f.to;
    sort = f.sort;
    ui.searchQuery = f.q;
    dueWindow = f.overdue ? 'overdue' : f.withinDays !== undefined ? (String(f.withinDays) as typeof dueWindow) : '';
    prio = f.priorities?.length === 1 && f.priorities[0] === 'urgent' ? 'urgent' : f.priorities?.length ? 'high' : '';
    blocked = f.blocked ?? '';
  }
  $effect(() => {
    void ui.inboxListNonce;
    const l = store.settings.smartLists.find((x) => x.id === ui.inboxList);
    if (l) load(l.filter);
  });

  function saveList(e: SubmitEvent) {
    e.preventDefault();
    const name = listName.trim();
    if (!name) return;
    const l: SavedList = { id: uid('list'), name: name.slice(0, 40), emoji: listEmoji || '📋', filter: $state.snapshot(filter) as TaskFilter };
    store.updateSettings({ smartLists: [...store.settings.smartLists, l] });
    ui.inboxList = l.id;
    saving = false;
    listName = '';
    toasts.push({ message: `Saved list “${l.name}”`, detail: 'It’s in the sidebar now.', kind: 'success', emoji: l.emoji });
  }
  function usePreset(p: (typeof LIST_PRESETS)[number]) {
    load({ ...EMPTY_FILTER, ...p.filter });
    listName = p.name;
    listEmoji = p.emoji;
    saving = true;
  }
  function deleteList(id: string) {
    store.updateSettings({ smartLists: store.settings.smartLists.filter((l) => l.id !== id) });
    if (ui.inboxList === id) ui.inboxList = null;
  }

  // leaving the Inbox closes the saved list, so key 4 / the sidebar open the plain Inbox next time
  onDestroy(() => (ui.inboxList = null));

  function clear() {
    load(EMPTY_FILTER);
    ui.inboxList = null;
  }
</script>

<div class="page">
  <header class="page-head">
    <div>
      <h1>{activeList ? `${activeList.emoji} ${activeList.name}` : 'Inbox'}</h1>
      <div class="sub">{activeList ? 'Saved list' : 'Everything, with filters.'}</div>
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
    <select class="select" bind:value={dueWindow} aria-label="Due dueWindow">
      <option value="">Any due date</option>
      <option value="overdue">Overdue</option>
      <option value="7">Next 7 days</option>
      <option value="14">Next 14 days</option>
      <option value="30">Next 30 days</option>
    </select>
    <select class="select" bind:value={prio} aria-label="Priority">
      <option value="">Any priority</option>
      <option value="high">High or urgent</option>
      <option value="urgent">Urgent</option>
    </select>
    <select class="select" bind:value={blocked} aria-label="Waiting tasks">
      <option value="">Waiting: show</option>
      <option value="hide">Hide waiting</option>
      <option value="only">Only waiting</option>
    </select>
    {#if hasFilters}<button class="btn ghost sm" onclick={clear}>Clear</button>{/if}
    {#if activeList}
      <button class="btn ghost sm" onclick={() => deleteList(activeList.id)}>Delete list</button>
    {:else}
      <button class="btn sm" onclick={() => (saving = !saving)} aria-expanded={saving}>☆ Save as list</button>
    {/if}
  </div>
  {#if saving}
    <form class="card savelist" onsubmit={saveList}>
      <input class="input em" bind:value={listEmoji} maxlength="4" aria-label="List emoji" />
      <input class="input" bind:value={listName} placeholder="List name, e.g. Exams in the next 14 days" aria-label="List name" />
      <button class="btn primary" type="submit" disabled={!listName.trim()}>Save</button>
      <div class="presets">
        <span class="muted">Ideas:</span>
        {#each LIST_PRESETS as p (p.name)}<button type="button" class="chip" onclick={() => usePreset(p)}>{p.emoji} {p.name}</button>{/each}
      </div>
    </form>
  {/if}

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
  .savelist {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    margin-bottom: 12px;
  }
  .savelist .input:not(.em) {
    flex: 1;
    min-width: 200px;
  }
  .savelist .em {
    width: 56px;
    text-align: center;
  }
  .presets {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    width: 100%;
  }
  .muted {
    font-size: 12px;
    color: var(--text-muted);
  }
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
