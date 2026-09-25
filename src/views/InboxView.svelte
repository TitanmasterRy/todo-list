<script lang="ts">
  import { onDestroy } from 'svelte';
  import { store } from '../lib/store.svelte';
  import { ui } from '../lib/ui.svelte';
  import type { TaskType } from '../lib/types';
  import { TASK_TYPES } from '../lib/types';
  import { applyFilter, EMPTY_FILTER, isFiltered, LIST_PRESETS, type FilterSort, type FilterStatus, type SavedList, type TaskFilter } from '../lib/filters';
  import { uid } from '../lib/id';
  import { toasts } from '../lib/toast.svelte';
  import { t } from '../lib/i18n/index.svelte';
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
    toasts.push({ message: t('inbox.savedList', { name: l.name }), detail: t('inbox.savedListDetail'), kind: 'success', emoji: l.emoji });
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
      <h1>{activeList ? `${activeList.emoji} ${activeList.name}` : t('nav.inbox')}</h1>
      <div class="sub">{activeList ? t('inbox.savedListSub') : t('inbox.sub')}</div>
    </div>
    <div class="grow"></div>
    <button class="btn sm" class:primary={store.bulkMode} onclick={() => (store.bulkMode ? store.clearSelection() : (store.bulkMode = true))}
      >{store.bulkMode ? t('inbox.doneSelecting') : t('inbox.select')}</button
    >
  </header>

  <QuickAdd />

  <div class="filters" role="search">
    <input class="input search" bind:this={searchInput} bind:value={ui.searchQuery} placeholder={t('inbox.search')} aria-label={t('inbox.searchLabel')} data-search />
    <select class="select" bind:value={status} aria-label={t('inbox.status')}>
      <option value="open">{t('inbox.open')}</option>
      <option value="done">{t('inbox.completed')}</option>
      <option value="all">{t('common.all')}</option>
    </select>
    <select class="select" bind:value={courseId} aria-label={t('inbox.course')}>
      <option value="">{t('inbox.anyCourse')}</option>
      <option value="none">{t('inbox.noCourse')}</option>
      {#each store.courses as c (c.id)}
        <option value={c.id}>{c.emoji ? c.emoji + ' ' : ''}{c.name}{c.archived ? ` ${t('inbox.archived')}` : ''}</option>
      {/each}
    </select>
    <select class="select" bind:value={tag} aria-label={t('inbox.tag')}>
      <option value="">{t('inbox.anyTag')}</option>
      {#each store.allTags as tg}
        <option value={tg}>#{tg}</option>
      {/each}
    </select>
    <select class="select" bind:value={type} aria-label={t('inbox.type')}>
      <option value="">{t('inbox.anyType')}</option>
      {#each TASK_TYPES as ty}
        <option value={ty}>{t(`type.${ty}` as const)}</option>
      {/each}
    </select>
    <label class="range"><span>{t('inbox.from')}</span><input class="input" type="date" bind:value={from} aria-label={t('inbox.dueFrom')} /></label>
    <label class="range"><span>{t('inbox.to')}</span><input class="input" type="date" bind:value={to} aria-label={t('inbox.dueTo')} /></label>
    <select class="select" bind:value={sort} aria-label={t('inbox.sort')}>
      <option value="due">{t('inbox.sortDue')}</option>
      <option value="priority">{t('inbox.sortPriority')}</option>
      <option value="manual">{t('inbox.sortManual')}</option>
      <option value="created">{t('inbox.sortNewest')}</option>
    </select>
    <select class="select" bind:value={dueWindow} aria-label={t('inbox.dueWindow')}>
      <option value="">{t('inbox.anyDue')}</option>
      <option value="overdue">{t('today.overdue')}</option>
      <option value="7">{t('inbox.nextDays', { n: 7 })}</option>
      <option value="14">{t('inbox.nextDays', { n: 14 })}</option>
      <option value="30">{t('inbox.nextDays', { n: 30 })}</option>
    </select>
    <select class="select" bind:value={prio} aria-label={t('inbox.priority')}>
      <option value="">{t('inbox.anyPriority')}</option>
      <option value="high">{t('inbox.highOrUrgent')}</option>
      <option value="urgent">{t('priority.urgent')}</option>
    </select>
    <select class="select" bind:value={blocked} aria-label={t('inbox.waiting')}>
      <option value="">{t('inbox.waitingShow')}</option>
      <option value="hide">{t('inbox.waitingHide')}</option>
      <option value="only">{t('inbox.waitingOnly')}</option>
    </select>
    {#if hasFilters}<button class="btn ghost sm" onclick={clear}>{t('inbox.clear')}</button>{/if}
    {#if activeList}
      <button class="btn ghost sm" onclick={() => deleteList(activeList.id)}>{t('inbox.deleteList')}</button>
    {:else}
      <button class="btn sm" onclick={() => (saving = !saving)} aria-expanded={saving}>☆ {t('inbox.saveList')}</button>
    {/if}
  </div>
  {#if saving}
    <form class="card savelist" onsubmit={saveList}>
      <input class="input em" bind:value={listEmoji} maxlength="4" aria-label={t('inbox.listEmoji')} />
      <input class="input" bind:value={listName} placeholder={t('inbox.listNamePh')} aria-label={t('inbox.listName')} />
      <button class="btn primary" type="submit" disabled={!listName.trim()}>{t('common.save')}</button>
      <div class="presets">
        <span class="muted">{t('inbox.ideas')}</span>
        {#each LIST_PRESETS as p (p.name)}<button type="button" class="chip" onclick={() => usePreset(p)}>{p.emoji} {p.name}</button>{/each}
      </div>
    </form>
  {/if}

  <div class="section-title">
    <span>{status === 'done' ? t('inbox.completed') : status === 'all' ? t('inbox.allTasks') : t('inbox.open')}</span><span class="count">{filtered.length}</span>
  </div>
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
      <h3>{hasFilters ? t('inbox.noMatches') : t('inbox.zero')}</h3>
      <p>{hasFilters ? t('inbox.tryClearing') : t('inbox.zeroHint')}</p>
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
