<script lang="ts">
  import { store } from '../lib/store.svelte';
  import { ui } from '../lib/ui.svelte';
  import { formatMinutes, DAY_NAMES, MONTH_SHORT, fromKey } from '../lib/dates';
  import QuickAdd from '../components/QuickAdd.svelte';
  import TaskItem from '../components/TaskItem.svelte';
  import GoalRing from '../components/GoalRing.svelte';
  import Sortable from '../components/Sortable.svelte';

  import type { Task } from '../lib/types';
  import { isOverdue, isDueToday } from '../lib/dates';
  import { byDueThenOrder, byFrogThenOrder, byOrder } from '../lib/store.svelte';
  import { isPowerHour, powerHourFor } from '../lib/gamification';
  let courseChip = $state<string | null>(null);
  const byCourse = (t: Task) => !courseChip || t.courseId === courseChip;
  const powerNow = $derived(store.settings.gamification && store.settings.powerHourEnabled && isPowerHour(store.now, store.today));
  const powerHour = $derived(powerHourFor(store.today));
  const finishAt = $derived.by(() => {
    const min = store.todayEstimateMin;
    if (!min) return '';
    const d = new Date(store.now.getTime() + min * 60000);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  });
  const chipCourses = $derived(store.activeCourses.filter((c) => store.todayTasks.some((t) => t.courseId === c.id)));

  // Sections keep recently completed tasks (store.lingering) in place until their exit animation runs.
  const live = (t: Task) => !t.completedAt || store.lingering.has(t.id);
  const overdue = $derived(store.tasks.filter((t) => live(t) && byCourse(t) && isOverdue(t.dueAt, store.now) && !isDueToday(t.dueAt, store.now)).sort(byDueThenOrder));
  const dueToday = $derived(store.tasks.filter((t) => live(t) && byCourse(t) && isDueToday(t.dueAt, store.now)).sort(byFrogThenOrder));
  const pinned = $derived(
    store.tasks.filter((t) => live(t) && t.pinnedDay === store.today && (!t.dueAt || (!isDueToday(t.dueAt, store.now) && !isOverdue(t.dueAt, store.now)))).sort(byOrder),
  );
  const allIds = $derived([...overdue, ...dueToday, ...pinned].map((t) => t.id));
  const d = $derived(fromKey(store.today));
  const dateLabel = $derived(`${DAY_NAMES[d.getDay()]}, ${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`);
  const empty = $derived(overdue.length === 0 && dueToday.length === 0 && pinned.length === 0);
  let showNoDate = $state(false);
  const frog = $derived(store.frogTask);
  const doneToday = $derived(store.completedTasks.filter((t) => t.completedAt && t.completedAt.slice(0, 10) === new Date().toISOString().slice(0, 10)));

  function onDrop(id: string, section: 'today' | 'pinned') {
    const task = store.taskById(id);
    if (!task) return;
    if (!task.dueAt) {
      if (task.pinnedDay !== store.today) store.pinToToday(id);
    } else if (section === 'today' && store.overdueTasks.some((t) => t.id === id)) {
      store.moveTaskToDay(id, store.today);
    }
  }
</script>

<div class="page">
  <header class="page-head">
    <div>
      <h1>Today</h1>
      <div class="sub">{dateLabel}</div>
    </div>
    <div class="grow"></div>
    {#if store.settings.gamification}
      <div class="stat" title="Streak">
        <span class="flame" class:hot={store.streak > 0}>🔥</span>
        <span class="n">{store.streak}</span>
      </div>
      <GoalRing value={store.completedToday} goal={store.settings.dailyGoal} />
    {/if}
  </header>

  <div class="workload" aria-label="Workload">
    <span><strong>{formatMinutes(store.todayEstimateMin)}</strong> today</span>
    <span class="sep">·</span>
    <span><strong>{formatMinutes(store.weekEstimateMin)}</strong> this week</span>
    <span class="sep">·</span>
    <span><strong>{store.todayTasks.length}</strong> task{store.todayTasks.length === 1 ? '' : 's'}</span>
    {#if finishAt}
      <span class="sep">·</span>
      <span title="If you start now and work straight through">done by <strong>{finishAt}</strong></span>
    {/if}
    {#if frog}
      <span class="sep">·</span>
      <span>🐸 <strong>{frog.title}</strong></span>
    {:else if store.todayTasks.length}
      <span class="sep">·</span>
      <button class="link" onclick={() => (ui.frogPrompt = true)}>Pick a frog</button>
    {/if}
  </div>

  {#if powerNow}
    <div class="power">⚡ <strong>Power hour</strong> until {(powerHour + 1) % 12 || 12}{powerHour + 1 >= 12 ? 'pm' : 'am'}: every task pays ×1.5 XP</div>
  {:else if store.settings.gamification && store.settings.powerHourEnabled && store.now.getHours() < powerHour}
    <div class="power soon">⚡ Power hour today at {powerHour % 12 || 12}{powerHour >= 12 ? 'pm' : 'am'} · ×1.5 XP</div>
  {/if}

  <QuickAdd defaultDueKey={store.today} autofocus />

  {#if chipCourses.length > 1}
    <div class="course-chips">
      <button class="chip" class:on={courseChip === null} onclick={() => (courseChip = null)}>All</button>
      {#each chipCourses as c (c.id)}
        <button class="chip" class:on={courseChip === c.id} style="--cc:{c.color}" onclick={() => (courseChip = courseChip === c.id ? null : c.id)}
          ><span class="dot"></span>{c.emoji ?? ''} {c.name}</button
        >
      {/each}
    </div>
  {/if}

  {#if overdue.length}
    <div class="section-title overdue">
      <span>Overdue</span><span class="count">{store.overdueTasks.length}</span>
      <span class="spacer"></span>
      <button class="btn sm" onclick={() => store.rollOverdueToToday()}>Roll all to today</button>
    </div>
    <Sortable items={overdue} onreorder={(ids) => store.reorder(ids)} ondropfrom={(id) => onDrop(id, 'today')} group="today">
      {#snippet item(task)}
        <TaskItem {task} listIds={allIds} dragHandle />
      {/snippet}
    </Sortable>
  {/if}

  <div class="section-title">
    <span>Due today</span><span class="count">{dueToday.length}</span>
  </div>
  <Sortable items={dueToday} onreorder={(ids) => store.reorder(ids)} ondropfrom={(id) => onDrop(id, 'today')} group="today" placeholder="Drop here to make it due today">
    {#snippet item(task)}
      <TaskItem {task} listIds={allIds} dragHandle />
    {/snippet}
  </Sortable>

  {#if pinned.length || showNoDate}
    <div class="section-title">
      <span>Planned for today</span><span class="count">{pinned.length}</span><span class="spacer"></span><button class="link" onclick={() => store.go('tools')}>Plan my day</button
      >
    </div>
    <Sortable items={pinned} onreorder={(ids) => store.reorder(ids)} ondropfrom={(id) => onDrop(id, 'pinned')} group="today" placeholder="Drag a task without a date here">
      {#snippet item(task)}
        <TaskItem {task} listIds={allIds} dragHandle />
      {/snippet}
    </Sortable>
  {/if}

  {#if empty}
    <div class="empty">
      <div class="big">{store.ringClosedToday ? '🎉' : '🌤️'}</div>
      <h3>{store.ringClosedToday ? 'Goal reached. Nothing left for today.' : 'Nothing due today'}</h3>
      <p>Add a task above, or pull one in from your undated tasks.</p>
    </div>
  {/if}

  {#if store.noDateTasks.length}
    <button class="section-title toggle" onclick={() => (showNoDate = !showNoDate)} aria-expanded={showNoDate}>
      <span>No date</span><span class="count">{store.noDateTasks.length}</span>
      <span class="spacer"></span>
      <span class="hint">{showNoDate ? 'Hide' : 'Show · drag into today'}</span>
    </button>
    {#if showNoDate}
      <Sortable items={store.noDateTasks} onreorder={(ids) => store.reorder(ids)} group="today">
        {#snippet item(task)}
          <div class="nodate">
            <TaskItem {task} listIds={allIds} dragHandle compact />
            <button class="btn ghost sm" onclick={() => store.pinToToday(task.id)}>→ Today</button>
          </div>
        {/snippet}
      </Sortable>
    {/if}
  {/if}

  {#if doneToday.length}
    <div class="section-title">
      <span>Done today</span><span class="count">{doneToday.length}</span>
    </div>
    <div class="task-list done-list">
      {#each doneToday.filter((t) => !store.lingering.has(t.id)) as task (task.id)}
        <TaskItem {task} compact />
      {/each}
    </div>
  {/if}
</div>

<style>
  .stat {
    display: flex;
    align-items: center;
    gap: 4px;
    font-weight: 700;
    font-size: 16px;
  }
  .flame {
    filter: grayscale(1);
    opacity: 0.5;
    transition:
      filter 300ms,
      opacity 300ms,
      transform 300ms var(--spring);
  }
  .flame.hot {
    filter: none;
    opacity: 1;
    animation: flicker 1.6s ease-in-out infinite;
  }
  @keyframes flicker {
    0%,
    100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.12) rotate(-3deg);
    }
  }
  .power {
    margin: 0 0 10px;
    padding: 8px 12px;
    border-radius: 10px;
    background: linear-gradient(90deg, color-mix(in srgb, var(--warn) 25%, var(--bg-elev)), var(--bg-elev));
    border: 1px solid color-mix(in srgb, var(--warn) 50%, var(--border));
    font-size: 13px;
    animation: pop-in 200ms var(--ease);
  }
  .power.soon {
    background: var(--bg-elev);
    border-color: var(--border);
    color: var(--text-muted);
  }
  .course-chips {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin: 10px 0 0;
  }
  .course-chips .chip {
    cursor: pointer;
  }
  .course-chips .chip.on {
    border-color: var(--cc, var(--accent));
    color: var(--text);
  }
  .course-chips .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--cc);
  }
  .workload {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    font-size: 13px;
    color: var(--text-muted);
    margin: 0 0 12px;
  }
  .workload strong {
    color: var(--text);
    font-weight: 600;
  }
  .sep {
    color: var(--text-faint);
  }
  .link {
    color: var(--accent);
    font-weight: 500;
  }
  .section-title.overdue span:first-child {
    color: var(--overdue);
  }
  .toggle {
    width: 100%;
    text-align: left;
  }
  .hint {
    font-weight: 400;
    text-transform: none;
    letter-spacing: 0;
    color: var(--text-faint);
  }
  .nodate {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .nodate > :global(:first-child) {
    flex: 1;
    min-width: 0;
  }
  .done-list {
    opacity: 0.8;
  }
</style>
