<script lang="ts">
  const loadMonth = () => import('../components/MonthCalendar.svelte');
  const loadPrint = () => import('../components/PrintPlanner.svelte');
  let printing = $state(false);
  const LAYOUT_KEY = 'homework-todo:upcoming-layout';
  let layout = $state<'list' | 'month'>(
    (() => {
      try {
        return localStorage.getItem(LAYOUT_KEY) === 'month' ? 'month' : 'list';
      } catch {
        return 'list';
      }
    })(),
  );
  function setLayout(l: 'list' | 'month') {
    layout = l;
    try {
      localStorage.setItem(LAYOUT_KEY, l);
    } catch {
      /* ignore */
    }
  }
  import { store, byDueThenOrder, byOrder } from '../lib/store.svelte';
  import type { Task } from '../lib/types';
  import { addDaysKey, dueKey, formatDayHeading, formatMinutes, formatMonthDay, startOfWeekKey, fromKey } from '../lib/dates';
  import { t } from '../lib/i18n/index.svelte';
  import QuickAdd from '../components/QuickAdd.svelte';
  import TaskItem from '../components/TaskItem.svelte';
  import Sortable from '../components/Sortable.svelte';

  const live = (t: Task) => !t.completedAt || store.lingering.has(t.id);
  const dated = $derived(store.tasks.filter((t) => live(t) && t.dueAt));
  const overdue = $derived(dated.filter((t) => dueKey(t.dueAt!) < store.today).sort(byDueThenOrder));
  const dayKeys = $derived(Array.from({ length: 14 }, (_, i) => addDaysKey(store.today, i)));
  const byDay = $derived.by(() => {
    const m = new Map<string, Task[]>();
    for (const k of dayKeys) m.set(k, []);
    for (const t of dated) {
      const k = dueKey(t.dueAt!);
      const arr = m.get(k);
      if (arr) arr.push(t);
    }
    for (const arr of m.values()) arr.sort(byDueThenOrder);
    return m;
  });
  const afterKey = $derived(addDaysKey(store.today, 14));
  const weeks = $derived.by(() => {
    const m = new Map<string, Task[]>();
    for (const t of dated) {
      const k = dueKey(t.dueAt!);
      if (k < afterKey) continue;
      const wk = startOfWeekKey(k, store.settings.weekStart);
      if (!m.has(wk)) m.set(wk, []);
      m.get(wk)!.push(t);
    }
    return Array.from(m.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([k, tasks]) => ({ key: k, tasks: tasks.sort(byDueThenOrder) }));
  });
  const undated = $derived(store.openTasks.filter((t) => !t.dueAt).sort(byOrder));
  const allIds = $derived([...overdue, ...dayKeys.flatMap((k) => byDay.get(k) ?? []), ...weeks.flatMap((w) => w.tasks)].map((t) => t.id));
  let showEmptyDays = $state(true);

  function weekLabel(k: string): string {
    const a = fromKey(k);
    const b = fromKey(addDaysKey(k, 6));
    return t('upcoming.weekOf', { from: formatMonthDay(a, a), to: formatMonthDay(b, b) });
  }
  const est = (tasks: Task[]) => tasks.reduce((a, t) => a + (t.estimateMin ?? 0), 0);
  const exams = (tasks: Task[]) => tasks.filter((t) => t.type === 'exam' || t.type === 'quiz').length;
</script>

<div class="page">
  <header class="page-head">
    <div>
      <h1>{t('nav.upcoming')}</h1>
      <div class="sub">{t('upcoming.sub')}</div>
    </div>
    <div class="grow"></div>
    <div class="cz-seg mode" role="radiogroup" aria-label={t('upcoming.layout')}>
      <button role="radio" aria-checked={layout === 'list'} class:on={layout === 'list'} onclick={() => setLayout('list')}>{t('upcoming.list')}</button>
      <button role="radio" aria-checked={layout === 'month'} class:on={layout === 'month'} onclick={() => setLayout('month')}>{t('upcoming.month')}</button>
    </div>
    {#if layout === 'list'}<label class="toggle"><input type="checkbox" bind:checked={showEmptyDays} /> {t('upcoming.showEmpty')}</label>{/if}
    <button class="btn sm" onclick={() => (printing = true)}>🖨️ {t('upcoming.print')}</button>
  </header>
  {#if printing}
    {#await loadPrint() then m}<m.default onclose={() => (printing = false)} />{/await}
  {/if}

  {#if layout === 'month'}
    {#await loadMonth() then m}<m.default />{/await}
  {:else}
    <QuickAdd defaultDueKey={addDaysKey(store.today, 1)} placeholder={t('quick.placeholderUpcoming')} />

    {#if overdue.length}
      <div class="section-title overdue">
        <span>{t('today.overdue')}</span><span class="count">{overdue.length}</span>
        <span class="spacer"></span>
        <button class="btn sm" onclick={() => store.rollOverdueToToday()}>{t('today.rollAll')}</button>
      </div>
      <Sortable items={overdue} group="upcoming" onreorder={(ids) => store.reorder(ids)}>
        {#snippet item(task)}
          <TaskItem {task} listIds={allIds} dragHandle />
        {/snippet}
      </Sortable>
    {/if}

    {#each dayKeys as k (k)}
      {@const tasks = byDay.get(k) ?? []}
      {#if tasks.length || showEmptyDays}
        <div class="section-title day" class:today={k === store.today} class:weekend={[0, 6].includes(fromKey(k).getDay())}>
          <span>{formatDayHeading(k, store.now)}</span>
          {#if tasks.length}
            <span class="count">{tasks.length} · {formatMinutes(est(tasks))}</span>
            {#if exams(tasks)}<span class="chip exam">{t('upcoming.exams', { count: exams(tasks) })}</span>{/if}
          {/if}
        </div>
        <Sortable
          items={tasks}
          group="upcoming"
          onreorder={(ids) => store.reorder(ids)}
          ondropfrom={(id) => store.moveTaskToDay(id, k)}
          placeholder={tasks.length ? undefined : t('upcoming.drop')}
        >
          {#snippet item(task)}
            <TaskItem {task} listIds={allIds} dragHandle />
          {/snippet}
        </Sortable>
      {/if}
    {/each}

    {#each weeks as w (w.key)}
      <div class="section-title">
        <span>{weekLabel(w.key)}</span>
        <span class="count">{w.tasks.length} · {formatMinutes(est(w.tasks))}</span>
        {#if exams(w.tasks)}<span class="chip exam">{t('upcoming.exams', { count: exams(w.tasks) })}</span>{/if}
      </div>
      <Sortable items={w.tasks} group="upcoming" onreorder={(ids) => store.reorder(ids)} ondropfrom={(id) => store.moveTaskToDay(id, w.key)}>
        {#snippet item(task)}
          <TaskItem {task} listIds={allIds} dragHandle />
        {/snippet}
      </Sortable>
    {/each}

    {#if !dated.length}
      <div class="empty">
        <div class="big">📅</div>
        <h3>{t('upcoming.empty')}</h3>
        <p>{t('upcoming.emptyHint')}</p>
      </div>
    {/if}

    {#if undated.length}
      <div class="section-title">
        <span>{t('today.noDate')}</span><span class="count">{undated.length}</span>
        <span class="spacer"></span>
        <span class="hint">{t('upcoming.dragHint')}</span>
      </div>
      <Sortable items={undated} group="upcoming" onreorder={(ids) => store.reorder(ids)} ondropfrom={(id) => store.moveTaskToDay(id, null)}>
        {#snippet item(task)}
          <TaskItem {task} listIds={allIds} dragHandle compact />
        {/snippet}
      </Sortable>
    {/if}
  {/if}
</div>

<style>
  .mode button {
    padding: 5px 12px;
  }
  .toggle {
    font-size: 13px;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .toggle input {
    accent-color: var(--accent);
  }
  .section-title.overdue span:first-child {
    color: var(--overdue);
  }
  .section-title.today span:first-child {
    color: var(--accent-text);
  }
  .section-title.weekend span:first-child {
    color: var(--text-faint);
  }
  .hint {
    font-weight: 400;
    text-transform: none;
    letter-spacing: 0;
    color: var(--text-faint);
  }
  .chip.exam {
    text-transform: none;
    letter-spacing: 0;
  }
</style>
