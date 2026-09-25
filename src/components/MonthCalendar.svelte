<script lang="ts">
  // Month calendar: tasks by due day. Arrow keys move between days, Enter opens the day's list.
  import { store } from '../lib/store.svelte';
  import { DAY_SHORT, MONTH_SHORT, dueKey, fromKey, formatDayHeading } from '../lib/dates';
  import { monthGrid, shiftMonth } from '../lib/calendar';
  import QuickAdd from './QuickAdd.svelte';
  import TaskItem from './TaskItem.svelte';
  import type { Task } from '../lib/types';

  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const t0 = fromKey(store.today);
  let year = $state(t0.getFullYear());
  let month = $state(t0.getMonth());
  let selected = $state<string>(store.today);
  let showDone = $state(false);

  const days = $derived(monthGrid(year, month, store.settings.weekStart));
  const byDay = $derived.by(() => {
    const m = new Map<string, Task[]>();
    for (const t of store.tasks) {
      if (!t.dueAt || t.archived || (t.completedAt && !showDone)) continue;
      const k = dueKey(t.dueAt);
      m.set(k, [...(m.get(k) ?? []), t]);
    }
    for (const list of m.values()) list.sort((a, b) => Number(!!a.completedAt) - Number(!!b.completedAt) || (a.dueAt ?? '').localeCompare(b.dueAt ?? ''));
    return m;
  });
  const weekdays = $derived(Array.from({ length: 7 }, (_, i) => DAY_SHORT[(i + store.settings.weekStart) % 7]));
  const selectedTasks = $derived(byDay.get(selected) ?? []);
  const monthPrefix = $derived(`${year}-${String(month + 1).padStart(2, '0')}`);

  function go(delta: number) {
    ({ year, month } = shiftMonth(year, month, delta));
  }
  function today() {
    year = t0.getFullYear();
    month = t0.getMonth();
    selected = store.today;
  }
  function pick(k: string) {
    selected = k;
    if (!k.startsWith(monthPrefix)) {
      const d = fromKey(k);
      year = d.getFullYear();
      month = d.getMonth();
    }
  }
  function onKey(e: KeyboardEvent, k: string) {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (!step) return;
    e.preventDefault();
    e.stopPropagation();
    const i = days.indexOf(k) + step;
    const next = days[i] ?? (step > 0 ? days[days.length - 1] : days[0]);
    pick(next);
    queueMicrotask(() => document.querySelector<HTMLElement>(`[data-cal-day="${next}"]`)?.focus());
  }
  const colorOf = (t: Task) => store.courseById(t.courseId)?.color ?? 'var(--text-muted)';
</script>

<div class="cal">
  <div class="bar">
    <button class="btn ghost sm" onclick={() => go(-1)} aria-label="Previous month">‹</button>
    <h2>{MONTHS[month]} {year}</h2>
    <button class="btn ghost sm" onclick={() => go(1)} aria-label="Next month">›</button>
    <button class="btn sm" onclick={today}>Today</button>
    <div class="grow"></div>
    <label class="toggle"><input type="checkbox" bind:checked={showDone} /> Show done</label>
  </div>
  <div class="grid" role="grid" aria-label="{MONTHS[month]} {year}">
    <div class="row head" role="row">
      {#each weekdays as w (w)}<div class="wd" role="columnheader">{w}</div>{/each}
    </div>
    {#each [0, 1, 2, 3, 4, 5] as r (r)}
      <div class="row" role="row">
        {#each days.slice(r * 7, r * 7 + 7) as k (k)}
          {@const list = byDay.get(k) ?? []}
          {@const open = list.filter((t) => !t.completedAt)}
          <div
            class="day"
            class:out={!k.startsWith(monthPrefix)}
            class:today={k === store.today}
            class:sel={k === selected}
            class:past={k < store.today && open.length > 0}
            role="gridcell"
            tabindex={k === selected ? 0 : -1}
            data-cal-day={k}
            aria-selected={k === selected}
            aria-label="{formatDayHeading(k, store.now)}: {open.length} open task{open.length === 1 ? '' : 's'}"
            onclick={() => pick(k)}
            onkeydown={(e) => (e.key === 'Enter' || e.key === ' ' ? (e.preventDefault(), pick(k)) : onKey(e, k))}
          >
            <span class="n">{Number(k.slice(8))}{k.slice(8) === '01' ? ` ${MONTH_SHORT[Number(k.slice(5, 7)) - 1]}` : ''}</span>
            {#each list.slice(0, 3) as t (t.id)}
              <span class="t" class:done={!!t.completedAt} style="--c:{colorOf(t)}" title={t.title}>{t.title}</span>
            {/each}
            {#if list.length > 3}<span class="more">+{list.length - 3} more</span>{/if}
          </div>
        {/each}
      </div>
    {/each}
  </div>

  <section class="dayview" aria-live="polite">
    <h3>
      {formatDayHeading(selected, store.now)}
      <span class="muted">{selectedTasks.length ? `${selectedTasks.length} task${selectedTasks.length === 1 ? '' : 's'}` : 'nothing due'}</span>
    </h3>
    {#key selected}<QuickAdd defaultDueKey={selected} placeholder="Add a task for this day…" />{/key}
    <div role="list">
      {#each selectedTasks as t (t.id)}<div role="listitem"><TaskItem task={t} listIds={selectedTasks.map((x) => x.id)} /></div>{/each}
    </div>
  </section>
</div>

<style>
  .bar {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }
  .bar h2 {
    font-size: 17px;
    margin: 0;
    min-width: 150px;
    text-align: center;
  }
  .grow {
    flex: 1;
  }
  .toggle {
    font-size: 13px;
    color: var(--text-muted);
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .grid {
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
    background: var(--bg-elev);
  }
  .row {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
  }
  .wd {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    padding: 6px 8px;
    border-bottom: 1px solid var(--border);
  }
  .day {
    min-height: 92px;
    padding: 4px 6px;
    border-right: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: 2px;
    cursor: pointer;
    min-width: 0;
  }
  .row .day:last-child {
    border-right: 0;
  }
  .day:hover {
    background: var(--bg-hover);
  }
  .day.out {
    background: var(--bg-elev-2);
  }
  .day.out .n {
    color: var(--text-muted);
  }
  .day.sel {
    box-shadow: inset 0 0 0 2px var(--accent);
  }
  .day:focus-visible {
    outline: 3px solid var(--accent);
    outline-offset: -3px;
  }
  .n {
    font-size: 12px;
    font-weight: 700;
  }
  .today .n {
    background: var(--accent);
    color: var(--accent-contrast, #fff);
    border-radius: 999px;
    padding: 0 7px;
    align-self: flex-start;
  }
  .past .n::after {
    content: ' •';
    color: var(--danger-text);
  }
  .t {
    font-size: 11px;
    line-height: 1.3;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    border-left: 3px solid var(--c);
    padding-left: 4px;
  }
  .t.done {
    text-decoration: line-through;
    color: var(--text-muted);
  }
  .more {
    font-size: 11px;
    color: var(--text-muted);
  }
  .dayview {
    margin-top: 14px;
  }
  .dayview h3 {
    font-size: 15px;
    margin: 0 0 8px;
  }
  .muted {
    color: var(--text-muted);
    font-weight: 400;
    font-size: 13px;
  }
  @media (max-width: 720px) {
    .day {
      min-height: 64px;
    }
    .t {
      font-size: 0;
      height: 6px;
      border-left: 0;
      border-radius: 3px;
      background: var(--c);
      padding: 0;
    }
  }
</style>
