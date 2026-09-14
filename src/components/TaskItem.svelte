<script lang="ts">
  import type { Task } from '../lib/types';
  import { store, PRIORITY_LABEL } from '../lib/store.svelte';
  import { ui } from '../lib/ui.svelte';
  import { formatDue, formatMinutes, isOverdue, isDueToday, dueKey, diffDays } from '../lib/dates';
  import { describeRecurrence } from '../lib/recurrence';
  import Checkbox from './Checkbox.svelte';
  import SnoozeMenu from './SnoozeMenu.svelte';

  interface Props {
    task: Task;
    showCourse?: boolean;
    listIds?: string[];
    dragHandle?: boolean;
    compact?: boolean;
  }
  let { task, showCourse = true, listIds = [], dragHandle = false, compact = false }: Props = $props();

  const course = $derived(store.courseById(task.courseId));
  const done = $derived(!!task.completedAt);
  const overdue = $derived(!done && isOverdue(task.dueAt, store.now) && !isDueToday(task.dueAt, store.now));
  const today = $derived(!done && isDueToday(task.dueAt, store.now));
  const selected = $derived(store.selectedTaskId === task.id);
  const checked = $derived(store.selection.has(task.id));
  const subDone = $derived(task.subtasks.filter((s) => s.done).length);
  const daysUntil = $derived(task.dueAt ? diffDays(store.today, dueKey(task.dueAt)) : null);
  const isFrog = $derived(task.frog && task.frogDate === store.today);
  let expanded = $state(false);
  let newSub = $state('');

  function open() {
    store.editingTaskId = task.id;
  }

  function onRowClick(e: MouseEvent) {
    if (e.shiftKey && listIds.length) {
      e.preventDefault();
      const from = store.selectedTaskId ?? [...store.selection].pop() ?? task.id;
      store.selectRange(listIds, from, task.id);
      return;
    }
    if (store.bulkMode) {
      store.toggleSelect(task.id);
      return;
    }
    store.selectedTaskId = task.id;
  }

  function onComplete(c: boolean) {
    if (c) store.completeTask(task.id);
    else store.uncompleteTask(task.id);
  }

  function addSub(e: Event) {
    e.preventDefault();
    if (!newSub.trim()) return;
    store.addSubtask(task.id, newSub);
    newSub = '';
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<div
  class="task"
  class:done
  class:selected
  class:checked
  class:compact
  class:frog={isFrog}
  data-task-id={task.id}
  role="listitem"
  onclick={onRowClick}
  ondblclick={open}
  style="--course:{course?.color ?? 'var(--accent)'}"
>
  {#if dragHandle}
    <span class="handle" aria-hidden="true" title="Drag to reorder">⋮⋮</span>
  {/if}
  {#if store.bulkMode}
    <input type="checkbox" class="sel" checked={checked} aria-label="Select task" onclick={(e) => { e.stopPropagation(); store.toggleSelect(task.id); }} />
  {/if}
  <Checkbox checked={done} color={course?.color} onchange={onComplete} label={done ? `Reopen ${task.title}` : `Complete ${task.title}`} />
  <div class="body">
    <div class="title-row">
      {#if isFrog}<span class="frog-ico" title="Eat the frog: double XP">🐸</span>{/if}
      <button class="title" onclick={(e) => { e.stopPropagation(); open(); }}>
        <span class="strike">{task.title}</span>
      </button>
      {#if task.subtasks.length}
        <button class="sub-toggle" onclick={(e) => { e.stopPropagation(); expanded = !expanded; }} aria-expanded={expanded} aria-label="Toggle subtasks">
          {subDone}/{task.subtasks.length} {expanded ? '▾' : '▸'}
        </button>
      {/if}
    </div>
    {#if !compact}
      <div class="meta">
        {#if showCourse && course}
          <span class="chip course"><span class="dot"></span>{course.emoji ? course.emoji + ' ' : ''}{course.name}</span>
        {/if}
        {#if task.type === 'exam' || task.type === 'quiz'}
          <span class="chip {task.type}">{task.type === 'exam' ? '📝 Exam' : '❓ Quiz'}{#if daysUntil !== null && daysUntil >= 0 && !done} · {daysUntil === 0 ? 'today' : daysUntil === 1 ? '1 day' : `${daysUntil} days`}{/if}</span>
        {:else if task.type && task.type !== 'homework' && task.type !== 'other'}
          <span class="chip">{task.type}</span>
        {/if}
        {#if task.dueAt}
          <span class="chip" class:overdue class:today>{overdue ? '⚠ ' : ''}{formatDue(task.dueAt, store.now, store.settings.timeFormat)}</span>
        {/if}
        {#if task.priority !== 'normal'}
          <span class="chip p-{task.priority}">{task.priority === 'low' ? '↓' : task.priority === 'high' ? '↑' : '‼'} {PRIORITY_LABEL[task.priority]}</span>
        {/if}
        {#if task.estimateMin}
          <span class="chip">⏱ {formatMinutes(task.estimateMin)}</span>
        {/if}
        {#if task.pinnedDay === store.today && task.dueAt && !today && !overdue}
          <span class="chip planned" title="Planned for today (deadline unchanged)">📌 today</span>
        {/if}
        {#if task.recurrence}
          <span class="chip" title={describeRecurrence(task.recurrence)}>🔁</span>
        {/if}
        {#if task.weight}
          <span class="chip">{task.weight}%</span>
        {/if}
        {#each task.tags as tag}
          <span class="chip tag">#{tag}</span>
        {/each}
        {#if task.deferredCount >= 3}
          <span class="chip stale" title="Snoozed {task.deferredCount} times">💤 {task.deferredCount}</span>
        {/if}
      </div>
    {/if}
    {#if expanded}
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
      <ul class="subtasks" onclick={(e) => e.stopPropagation()}>
        {#each task.subtasks as s (s.id)}
          <li class:sdone={s.done}>
            <label>
              <input type="checkbox" checked={s.done} onchange={() => store.toggleSubtask(task.id, s.id)} />
              <span>{s.title}</span>
            </label>
            <button class="rm" onclick={() => store.removeSubtask(task.id, s.id)} aria-label="Remove subtask">×</button>
          </li>
        {/each}
        <li>
          <form onsubmit={addSub}>
            <input class="sub-input" placeholder="Add subtask…" bind:value={newSub} />
          </form>
        </li>
      </ul>
    {/if}
  </div>
  {#if !done}
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="actions" onclick={(e) => e.stopPropagation()}>
      <div class="snooze-wrap">
        <button class="btn ghost sm icon" title="Snooze (s)" aria-label="Snooze" onclick={() => (ui.snoozeMenuFor = ui.snoozeMenuFor === task.id ? null : task.id)}>💤</button>
        {#if ui.snoozeMenuFor === task.id}
          <SnoozeMenu taskId={task.id} onclose={() => (ui.snoozeMenuFor = null)} />
        {/if}
      </div>
      <button class="btn ghost sm icon" title="Focus" aria-label="Focus on this task" onclick={() => store.go('focus', { taskId: task.id })}>🎯</button>
      <button class="btn ghost sm icon" title="Edit (e)" aria-label="Edit" onclick={open}>✎</button>
      <button class="btn ghost sm icon del" title="Delete" aria-label="Delete" onclick={() => store.deleteTask(task.id)}>🗑</button>
    </div>
  {:else}
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="actions" onclick={(e) => e.stopPropagation()}>
      <button class="btn ghost sm icon del" title="Delete" aria-label="Delete" onclick={() => store.deleteTask(task.id)}>🗑</button>
    </div>
  {/if}
</div>

<style>
  .task {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    padding: 8px 10px 8px 6px;
    border-radius: var(--radius);
    background: var(--bg-elev);
    border: 1px solid var(--border);
    transition:
      background var(--dur),
      border-color var(--dur),
      opacity 300ms,
      transform 300ms var(--ease);
    position: relative;
  }
  .task:hover {
    border-color: var(--border-strong);
  }
  .task.selected {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 30%, transparent);
  }
  .task.checked {
    background: color-mix(in srgb, var(--accent) 10%, var(--bg-elev));
  }
  .task.frog {
    border-color: color-mix(in srgb, #22c55e 50%, var(--border));
    background: color-mix(in srgb, #22c55e 6%, var(--bg-elev));
  }
  .task.done {
    opacity: 0.6;
  }
  .handle {
    cursor: grab;
    color: var(--text-faint);
    padding: 8px 2px;
    font-size: 12px;
    letter-spacing: -2px;
    user-select: none;
    touch-action: none;
  }
  .sel {
    margin: 10px 4px 0 2px;
    accent-color: var(--accent);
  }
  .body {
    flex: 1;
    min-width: 0;
    padding-top: 4px;
  }
  .title-row {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }
  .title {
    text-align: left;
    font-weight: 500;
    font-size: 15px;
    color: var(--text);
    line-height: 1.4;
    overflow-wrap: break-word;
    min-width: 0;
    flex: 1;
  }
  .compact .title {
    font-size: 14px;
  }
  .compact .actions {
    display: none;
  }
  .compact:hover .actions,
  .compact.selected .actions {
    display: flex;
    position: absolute;
    right: 6px;
    top: 4px;
    background: var(--bg-elev);
    border-radius: 8px;
    box-shadow: var(--shadow);
  }
  .strike {
    background-image: linear-gradient(currentColor, currentColor);
    background-repeat: no-repeat;
    background-size: 0% 1.5px;
    background-position: 0 58%;
    transition: background-size 320ms 80ms var(--ease);
  }
  .done .strike {
    background-size: 100% 1.5px;
    color: var(--text-muted);
  }
  .frog-ico {
    font-size: 16px;
  }
  .sub-toggle {
    font-size: 12px;
    color: var(--text-faint);
    white-space: nowrap;
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 4px;
  }
  .chip.course {
    color: var(--text-muted);
  }
  .chip.course .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--course);
  }
  .chip.tag {
    color: var(--text-faint);
  }
  .chip.stale {
    color: var(--warn);
  }
  .chip.planned {
    color: var(--accent);
  }
  .subtasks {
    list-style: none;
    margin: 8px 0 0;
    padding: 0 0 0 4px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .subtasks li {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
  }
  .subtasks label {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    cursor: pointer;
  }
  .subtasks input[type='checkbox'] {
    accent-color: var(--course);
    width: 16px;
    height: 16px;
  }
  .sdone span {
    text-decoration: line-through;
    color: var(--text-faint);
  }
  .rm {
    color: var(--text-faint);
    opacity: 0;
    padding: 0 6px;
  }
  .subtasks li:hover .rm {
    opacity: 1;
  }
  .sub-input {
    background: transparent;
    border: none;
    border-bottom: 1px dashed var(--border);
    padding: 4px 0;
    width: 100%;
    font-size: 13px;
  }
  .sub-input:focus {
    outline: none;
    border-bottom-color: var(--accent);
  }
  .actions {
    display: flex;
    gap: 2px;
    opacity: 0;
    transition: opacity var(--dur);
    position: relative;
  }
  .task:hover .actions,
  .task:focus-within .actions,
  .task.selected .actions {
    opacity: 1;
  }
  .snooze-wrap {
    position: relative;
  }
  .del:hover {
    color: var(--danger);
  }
  @media (hover: none) {
    .actions {
      opacity: 1;
    }
  }
  @media (max-width: 720px) {
    .actions .icon:not(.del):not(:first-child) {
      display: none;
    }
    .actions .snooze-wrap ~ .icon:nth-child(3) {
      display: inline-flex;
    }
  }
</style>
