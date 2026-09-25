<script lang="ts">
  import { store, byFrogThenOrder, PRIORITY_LABEL } from '../lib/store.svelte';
  import { ui } from '../lib/ui.svelte';
  import { pomodoro } from '../lib/pomodoro.svelte';
  import { renderMarkdown } from '../lib/markdown';
  import { formatDue, formatMinutes } from '../lib/dates';
  import { toasts } from '../lib/toast.svelte';
  import Checkbox from '../components/Checkbox.svelte';
  import SnoozeMenu from '../components/SnoozeMenu.svelte';
  import { socialUi } from '../lib/social/state.svelte';
  import { locale as appLocale, t } from '../lib/i18n/index.svelte';
  const loadMusic = () => import('../components/MusicPanel.svelte');
  const loadRoom = () => import('../components/social/StudyRoom.svelte');
  let customInput = $state(String(pomodoro.customMin));
  let showMusic = $state(false);
  const stop = $derived(pomodoro.mode === 'stopwatch');
  const elapsedMM = $derived(String(Math.floor(pomodoro.elapsed / 60)).padStart(2, '0'));
  const elapsedSS = $derived(String(pomodoro.elapsed % 60).padStart(2, '0'));

  const task = $derived(store.taskById(store.focusTaskId));
  const course = $derived(store.courseById(task?.courseId));
  const candidates = $derived([...store.todayTasks].sort(byFrogThenOrder));
  const mm = $derived(String(Math.floor(pomodoro.remaining / 60)).padStart(2, '0'));
  const ss = $derived(String(pomodoro.remaining % 60).padStart(2, '0'));
  const pct = $derived(pomodoro.mode === 'stopwatch' ? (pomodoro.elapsed % 3600) / 3600 : pomodoro.total ? 1 - pomodoro.remaining / pomodoro.total : 0);
  const R = 88;
  const C = 2 * Math.PI * R;
  let newSub = $state('');
  const pomToday = $derived(store.stats.pomodorosByDay[store.today] ?? 0);

  $effect(() => {
    if (typeof document === 'undefined') return;
    if (pomodoro.running) document.title = `${mm}:${ss} · ${pomodoro.mode === 'work' ? t('nav.focus') : t('focus.break')} · ${t('app.title')}`;
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
      <h1>{t('nav.focus')}</h1>
      <div class="sub">{t('focus.sub1')} <span class="kbd">{t('focus.space')}</span> {t('focus.sub2')}</div>
    </div>
    <div class="grow"></div>
    <span class="chip">🍅 {pomToday} {t('today.minToday')}</span>
  </header>

  <div class="timer card" class:work={pomodoro.mode === 'work'} class:running={pomodoro.running}>
    <div class="modes" role="tablist">
      <button role="tab" aria-selected={pomodoro.mode === 'work'} class:on={pomodoro.mode === 'work'} onclick={() => pomodoro.setMode('work')}
        >{t('nav.focus')} {store.settings.pomodoroWorkMin}</button
      >
      <button role="tab" aria-selected={pomodoro.mode === 'break'} class:on={pomodoro.mode === 'break'} onclick={() => pomodoro.setMode('break')}
        >{t('focus.break')} {store.settings.pomodoroBreakMin}</button
      >
      <button role="tab" aria-selected={pomodoro.mode === 'long'} class:on={pomodoro.mode === 'long'} onclick={() => pomodoro.setMode('long')}
        >{t('focus.long')} {store.settings.pomodoroLongBreakMin}</button
      >
      <button role="tab" aria-selected={pomodoro.mode === 'custom'} class:on={pomodoro.mode === 'custom'} onclick={() => pomodoro.setMode('custom')}
        >{t('focus.custom')} {pomodoro.customMin}</button
      >
      <button role="tab" aria-selected={stop} class:on={stop} onclick={() => pomodoro.setMode('stopwatch')}>{t('focus.stopwatch')}</button>
    </div>
    <div class="presets">
      {#each store.settings.timerPresets as p (p.label)}
        <button class="chip" class:on={store.settings.pomodoroWorkMin === p.work && store.settings.pomodoroBreakMin === p.brk} onclick={() => pomodoro.applyPreset(p.work, p.brk)}
          >{p.label}</button
        >
      {/each}
      <form
        class="custom"
        onsubmit={(e) => {
          e.preventDefault();
          pomodoro.setCustom(Number(customInput) || 30);
        }}
      >
        <input class="input num" type="number" min="1" max="600" bind:value={customInput} aria-label={t('focus.customMinutes')} />
        <button class="btn sm" type="submit">{t('focus.minTimer')}</button>
      </form>
    </div>
    <div class="dial">
      <svg viewBox="0 0 200 200" width="200" height="200" aria-hidden="true">
        <circle cx="100" cy="100" r={R} fill="none" stroke="var(--border)" stroke-width="8" />
        <circle
          cx="100"
          cy="100"
          r={R}
          fill="none"
          stroke="var(--accent)"
          stroke-width="8"
          stroke-linecap="round"
          stroke-dasharray={C}
          stroke-dashoffset={C * (1 - pct)}
          transform="rotate(-90 100 100)"
          class="prog"
        />
      </svg>
      <div class="time" aria-live="off">
        <span class="digits">{stop ? `${elapsedMM}:${elapsedSS}` : `${mm}:${ss}`}</span><span class="mode"
          >{stop
            ? t('focus.modeStopwatch')
            : pomodoro.mode === 'work'
              ? t('focus.modeFocus')
              : pomodoro.mode === 'break'
                ? t('focus.modeShort')
                : pomodoro.mode === 'long'
                  ? t('focus.modeLong')
                  : t('focus.modeCustom')}</span
        >
      </div>
    </div>
    <div class="controls">
      <button
        class="btn primary"
        onclick={() => {
          requestNotify();
          pomodoro.toggle();
        }}>{pomodoro.running ? t('focus.pause') : pomodoro.remaining < pomodoro.total ? t('focus.resume') : t('focus.start')}</button
      >
      <button class="btn" onclick={() => pomodoro.reset()}>{t('focus.reset')}</button>
      {#if stop}
        <button
          class="btn ghost"
          onclick={() => {
            const m = pomodoro.logStopwatch();
            toasts.push({ message: t('focus.logged', { n: m }), kind: 'success' });
          }}
          disabled={pomodoro.elapsed < 60}>{t('focus.logTime')}</button
        >
      {:else}
        <button class="btn ghost" onclick={() => pomodoro.skip()}>{t('common.skip')}</button>
      {/if}
      <button class="btn ghost" onclick={() => (showMusic = !showMusic)} aria-expanded={showMusic}>🎵 {t('focus.music')}</button>
      <button class="btn ghost" onclick={() => (socialUi.roomOpen = !socialUi.roomOpen)} aria-expanded={socialUi.roomOpen}>👥 {t('focus.studyRoom')}</button>
      <span class="sessions">{t('focus.sessions', { count: pomodoro.sessions })}</span>
    </div>
  </div>

  {#if showMusic}
    {#await loadMusic() then m}<m.default />{/await}
  {/if}
  {#if socialUi.roomOpen}
    {#await loadRoom() then m}<m.default />{/await}
  {/if}

  {#if task}
    <div class="card task-card" style="--course:{course?.color ?? 'var(--accent)'}">
      <div class="top">
        <Checkbox checked={!!task.completedAt} color={course?.color} onchange={(c) => (c ? complete() : store.uncompleteTask(task.id))} size={30} />
        <div class="grow">
          <h2 class:done={!!task.completedAt}>{task.frog && task.frogDate === store.today ? '🐸 ' : ''}{task.title}</h2>
          <div class="meta">
            {#if course}<span class="chip"><span class="dot"></span>{course.emoji ?? ''} {course.name}</span>{/if}
            {#if task.dueAt}<span class="chip">📅 {formatDue(task.dueAt, store.now, store.settings.timeFormat)}</span>{/if}
            {#if task.estimateMin || task.timeSpentMin}<span class="chip" title={t('focus.trackedTitle')}
                >⏱ {task.timeSpentMin ? t('task.tracked', { spent: formatMinutes(task.timeSpentMin) }) : ''}{task.timeSpentMin && task.estimateMin
                  ? ` ${t('focus.of')} `
                  : ''}{task.estimateMin ? `~${formatMinutes(task.estimateMin)}` : ''}</span
              >{/if}
            {#if task.priority !== 'normal'}<span class="chip p-{task.priority}">{appLocale() === 'en' ? task.priority : PRIORITY_LABEL[task.priority]}</span>{/if}
            {#each task.tags as tg}<span class="chip">#{tg}</span>{/each}
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
          <form
            onsubmit={(e) => {
              e.preventDefault();
              store.addSubtask(task.id, newSub);
              newSub = '';
            }}
          >
            <input class="sub-input" bind:value={newSub} placeholder={t('focus.addStep')} />
          </form>
        </li>
      </ul>
      <div class="task-actions">
        <button class="btn primary big" onclick={complete} disabled={!!task.completedAt}>{t('focus.complete')} ✓</button>
        <div class="snooze-wrap">
          <button class="btn" onclick={() => (ui.snoozeMenuFor = ui.snoozeMenuFor === task.id ? null : task.id)}>{t('task.snooze')}</button>
          {#if ui.snoozeMenuFor === task.id}<SnoozeMenu taskId={task.id} onclose={() => (ui.snoozeMenuFor = null)} />{/if}
        </div>
        <button class="btn" onclick={() => (store.editingTaskId = task.id)}>{t('common.edit')}</button>
        <button class="btn ghost" onclick={pickNext}>{t('focus.nextTask')} <span class="flip">→</span></button>
        <button class="btn ghost" onclick={() => (store.focusTaskId = null)}>{t('focus.choose')}</button>
      </div>
    </div>
  {:else}
    <div class="card picker">
      <h2>{t('focus.pick')}</h2>
      {#if !candidates.length}
        <p class="muted">{t('focus.nothing')}</p>
      {/if}
      <ul>
        {#each candidates as ct (ct.id)}
          <li>
            <button onclick={() => (store.focusTaskId = ct.id)}>
              <span class="dot" style="background:{store.courseById(ct.courseId)?.color ?? 'var(--border-strong)'}"></span>
              <span class="grow">{ct.frog && ct.frogDate === store.today ? '🐸 ' : ''}{ct.title}</span>
              {#if ct.estimateMin}<span class="muted">{formatMinutes(ct.estimateMin)}</span>{/if}
            </button>
          </li>
        {/each}
        {#each store.noDateTasks.slice(0, 5) as ct (ct.id)}
          <li>
            <button onclick={() => (store.focusTaskId = ct.id)}>
              <span class="dot" style="background:{store.courseById(ct.courseId)?.color ?? 'var(--border-strong)'}"></span>
              <span class="grow">{ct.title}</span>
              <span class="muted">{t('focus.noDate')}</span>
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
  .presets {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
  }
  .presets .chip {
    cursor: pointer;
  }
  .presets .chip.on {
    border-color: var(--accent);
    color: var(--accent-text);
  }
  .custom {
    display: flex;
    gap: 4px;
    align-items: center;
  }
  .custom .num {
    width: 70px;
    padding: 4px 8px;
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
    padding-inline-start: 20px;
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
    text-align: start;
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
