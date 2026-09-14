<script lang="ts">
  import { store, byFrogThenOrder } from '../lib/store.svelte';
  import { ui } from '../lib/ui.svelte';
  import { pomodoro } from '../lib/pomodoro.svelte';
  import { renderMarkdown } from '../lib/markdown';
  import { formatDue, formatMinutes } from '../lib/dates';
  import Checkbox from '../components/Checkbox.svelte';
  import SnoozeMenu from '../components/SnoozeMenu.svelte';

  const task = $derived(store.taskById(store.focusTaskId));
  const course = $derived(store.courseById(task?.courseId));
  const candidates = $derived([...store.todayTasks].sort(byFrogThenOrder));
  const mm = $derived(String(Math.floor(pomodoro.remaining / 60)).padStart(2, '0'));
  const ss = $derived(String(pomodoro.remaining % 60).padStart(2, '0'));
  const pct = $derived(pomodoro.total ? 1 - pomodoro.remaining / pomodoro.total : 0);
  const R = 88;
  const C = 2 * Math.PI * R;
  let newSub = $state('');
  const pomToday = $derived(store.stats.pomodorosByDay[store.today] ?? 0);

  $effect(() => {
    if (typeof document === 'undefined') return;
    if (pomodoro.running) document.title = `${mm}:${ss} · ${pomodoro.mode === 'work' ? 'Focus' : 'Break'} · Homework To-Do`;
  });

  function pickNext() {
    const next = candidates.find((t) => t.id !== task?.id);
    store.focusTaskId = next?.id ?? null;
  }
  function complete() {
    if (!task) return;
    store.completeTask(task.id);
    setTimeout(pickNext, 400);
  }
  function requestNotify() {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') void Notification.requestPermission();
  }
  function onKey(e: KeyboardEvent) {
    const t = e.target as HTMLElement;
    if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return;
    if (e.key === ' ' && !store.editingTaskId && !ui.palette) {
      e.preventDefault();
      pomodoro.toggle();
    }
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="page focus">
  <header class="page-head">
    <div>
      <h1>Focus</h1>
      <div class="sub">One task at a time. <span class="kbd">Space</span> starts and pauses the timer.</div>
    </div>
    <div class="grow"></div>
    <span class="chip">🍅 {pomToday} today</span>
  </header>

  <div class="timer card" class:work={pomodoro.mode === 'work'} class:running={pomodoro.running}>
    <div class="modes" role="tablist">
      <button role="tab" aria-selected={pomodoro.mode === 'work'} class:on={pomodoro.mode === 'work'} onclick={() => pomodoro.setMode('work')}>Focus {store.settings.pomodoroWorkMin}</button>
      <button role="tab" aria-selected={pomodoro.mode === 'break'} class:on={pomodoro.mode === 'break'} onclick={() => pomodoro.setMode('break')}>Break {store.settings.pomodoroBreakMin}</button>
      <button role="tab" aria-selected={pomodoro.mode === 'long'} class:on={pomodoro.mode === 'long'} onclick={() => pomodoro.setMode('long')}>Long {store.settings.pomodoroLongBreakMin}</button>
    </div>
    <div class="dial">
      <svg viewBox="0 0 200 200" width="200" height="200" aria-hidden="true">
        <circle cx="100" cy="100" r={R} fill="none" stroke="var(--border)" stroke-width="8" />
        <circle cx="100" cy="100" r={R} fill="none" stroke="var(--accent)" stroke-width="8" stroke-linecap="round" stroke-dasharray={C} stroke-dashoffset={C * (1 - pct)} transform="rotate(-90 100 100)" class="prog" />
      </svg>
      <div class="time" aria-live="off"><span class="digits">{mm}:{ss}</span><span class="mode">{pomodoro.mode === 'work' ? 'focus' : pomodoro.mode === 'break' ? 'short break' : 'long break'}</span></div>
    </div>
    <div class="controls">
      <button class="btn primary" onclick={() => { requestNotify(); pomodoro.toggle(); }}>{pomodoro.running ? 'Pause' : pomodoro.remaining < pomodoro.total ? 'Resume' : 'Start'}</button>
      <button class="btn" onclick={() => pomodoro.reset()}>Reset</button>
      <button class="btn ghost" onclick={() => pomodoro.skip()}>Skip</button>
      <span class="sessions">{pomodoro.sessions} session{pomodoro.sessions === 1 ? '' : 's'} this sitting</span>
    </div>
  </div>

  {#if task}
    <div class="card task-card" style="--course:{course?.color ?? 'var(--accent)'}">
      <div class="top">
        <Checkbox checked={!!task.completedAt} color={course?.color} onchange={(c) => (c ? complete() : store.uncompleteTask(task.id))} size={30} />
        <div class="grow">
          <h2 class:done={!!task.completedAt}>{task.frog && task.frogDate === store.today ? '🐸 ' : ''}{task.title}</h2>
          <div class="meta">
            {#if course}<span class="chip"><span class="dot"></span>{course.emoji ?? ''} {course.name}</span>{/if}
            {#if task.dueAt}<span class="chip">📅 {formatDue(task.dueAt, store.now, store.settings.timeFormat)}</span>{/if}
            {#if task.estimateMin}<span class="chip">⏱ {formatMinutes(task.estimateMin)}</span>{/if}
            {#if task.priority !== 'normal'}<span class="chip p-{task.priority}">{task.priority}</span>{/if}
            {#each task.tags as t}<span class="chip">#{t}</span>{/each}
          </div>
        </div>
      </div>
      {#if task.notes}
        <div class="notes">{@html renderMarkdown(task.notes)}</div>
      {/if}
      <ul class="subs">
        {#each task.subtasks as s (s.id)}
          <li class:on={s.done}>
            <label><input type="checkbox" checked={s.done} onchange={() => store.toggleSubtask(task.id, s.id)} /> <span>{s.title}</span></label>
          </li>
        {/each}
        <li>
          <form onsubmit={(e) => { e.preventDefault(); store.addSubtask(task.id, newSub); newSub = ''; }}>
            <input class="sub-input" bind:value={newSub} placeholder="Add a step…" />
          </form>
        </li>
      </ul>
      <div class="task-actions">
        <button class="btn primary big" onclick={complete} disabled={!!task.completedAt}>Complete ✓</button>
        <div class="snooze-wrap">
          <button class="btn" onclick={() => (ui.snoozeMenuFor = ui.snoozeMenuFor === task.id ? null : task.id)}>Snooze</button>
          {#if ui.snoozeMenuFor === task.id}<SnoozeMenu taskId={task.id} onclose={() => (ui.snoozeMenuFor = null)} />{/if}
        </div>
        <button class="btn" onclick={() => (store.editingTaskId = task.id)}>Edit</button>
        <button class="btn ghost" onclick={pickNext}>Next task →</button>
        <button class="btn ghost" onclick={() => (store.focusTaskId = null)}>Choose…</button>
      </div>
    </div>
  {:else}
    <div class="card picker">
      <h2>Pick a task to focus on</h2>
      {#if !candidates.length}
        <p class="muted">Nothing due today. Add something in Today, or pick from the Inbox.</p>
      {/if}
      <ul>
        {#each candidates as t (t.id)}
          <li>
            <button onclick={() => (store.focusTaskId = t.id)}>
              <span class="dot" style="background:{store.courseById(t.courseId)?.color ?? 'var(--border-strong)'}"></span>
              <span class="grow">{t.frog && t.frogDate === store.today ? '🐸 ' : ''}{t.title}</span>
              {#if t.estimateMin}<span class="muted">{formatMinutes(t.estimateMin)}</span>{/if}
            </button>
          </li>
        {/each}
        {#each store.noDateTasks.slice(0, 5) as t (t.id)}
          <li>
            <button onclick={() => (store.focusTaskId = t.id)}>
              <span class="dot" style="background:{store.courseById(t.courseId)?.color ?? 'var(--border-strong)'}"></span>
              <span class="grow">{t.title}</span>
              <span class="muted">no date</span>
            </button>
          </li>
        {/each}
      </ul>
    </div>
  {/if}
</div>

<style>
  .focus {
    max-width: 680px;
  }
  .timer {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 20px;
    margin-bottom: 12px;
  }
  .modes {
    display: flex;
    gap: 4px;
    background: var(--bg-elev-2);
    padding: 4px;
    border-radius: 999px;
  }
  .modes button {
    padding: 6px 14px;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-muted);
  }
  .modes button.on {
    background: var(--bg-elev);
    color: var(--text);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }
  .dial {
    position: relative;
    width: 200px;
    height: 200px;
  }
  .prog {
    transition: stroke-dashoffset 250ms linear;
  }
  .running .prog {
    filter: drop-shadow(0 0 6px color-mix(in srgb, var(--accent) 60%, transparent));
  }
  .time {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
  .digits {
    font-size: 48px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em;
  }
  .mode {
    font-size: 12px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }
  .controls {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
    justify-content: center;
  }
  .sessions {
    font-size: 12px;
    color: var(--text-faint);
  }
  .task-card {
    border-top: 4px solid var(--course);
    padding: 20px;
  }
  .top {
    display: flex;
    gap: 12px;
    align-items: flex-start;
  }
  .grow {
    flex: 1;
    min-width: 0;
  }
  h2 {
    margin: 4px 0 6px;
    font-size: 24px;
    line-height: 1.25;
  }
  h2.done {
    text-decoration: line-through;
    color: var(--text-muted);
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--course);
    display: inline-block;
  }
  .notes {
    margin: 14px 0 0;
    padding: 12px;
    background: var(--bg-elev-2);
    border-radius: 10px;
    font-size: 14px;
  }
  .notes :global(p) {
    margin: 0 0 8px;
  }
  .notes :global(h3),
  .notes :global(h4),
  .notes :global(h5) {
    margin: 8px 0 4px;
  }
  .notes :global(ul),
  .notes :global(ol) {
    margin: 4px 0 8px;
    padding-left: 20px;
  }
  .notes :global(code) {
    font-family: var(--mono);
    font-size: 12px;
    background: var(--bg-hover);
    padding: 1px 4px;
    border-radius: 4px;
  }
  .subs {
    list-style: none;
    margin: 14px 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .subs label {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 15px;
    cursor: pointer;
  }
  .subs input[type='checkbox'] {
    width: 18px;
    height: 18px;
    accent-color: var(--course);
  }
  .subs li.on span {
    text-decoration: line-through;
    color: var(--text-faint);
  }
  .sub-input {
    background: transparent;
    border: none;
    border-bottom: 1px dashed var(--border);
    padding: 6px 0;
    width: 100%;
    font-size: 14px;
  }
  .sub-input:focus {
    outline: none;
    border-bottom-color: var(--accent);
  }
  .task-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 18px;
    align-items: center;
  }
  .big {
    padding: 12px 22px;
    font-size: 16px;
  }
  .snooze-wrap {
    position: relative;
  }
  .picker h2 {
    font-size: 18px;
    margin: 0 0 10px;
  }
  .picker ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .picker li button {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 10px;
    text-align: left;
    color: var(--text);
    font-size: 15px;
  }
  .picker li button:hover {
    background: var(--bg-hover);
  }
  .muted {
    color: var(--text-muted);
    font-size: 13px;
  }
</style>
