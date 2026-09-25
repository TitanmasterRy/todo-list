<script lang="ts">
  // Plan my day: daily capacity, the next 7 days of load, and pulling work forward into today.
  import { store, byDueThenOrder } from '../../lib/store.svelte';
  import { toasts } from '../../lib/toast.svelte';
  import { addDaysKey, dueKey, formatDue, formatMinutes, fromKey, DAY_SHORT, MONTH_SHORT } from '../../lib/dates';

  const capacity = $derived(store.settings.dailyCapacityMin || 180);
  const committed = $derived(store.todayEstimateMin);
  const unestimatedToday = $derived(store.todayTasks.filter((t) => !t.estimateMin).length);
  const week = $derived(
    Array.from({ length: 7 }, (_, i) => addDaysKey(store.today, i)).map((k) => {
      const tasks = store.openTasks.filter((t) => (t.dueAt && dueKey(t.dueAt) === k) || (t.pinnedDay === k && k === store.today && !(t.dueAt && dueKey(t.dueAt) <= k)));
      const min = tasks.reduce((a, t) => a + (t.estimateMin ?? 0), 0);
      return { key: k, tasks, min, over: min > capacity };
    }),
  );
  const candidates = $derived(
    store.openTasks.filter((t) => t.dueAt && dueKey(t.dueAt) > store.today && dueKey(t.dueAt) <= addDaysKey(store.today, 14) && t.pinnedDay !== store.today).sort(byDueThenOrder),
  );
  const planned = $derived(store.pinnedTodayTasks.filter((t) => t.dueAt));
  const remaining = $derived(capacity - committed);

  function setCapacity(e: Event) {
    const v = Math.max(15, Math.min(24 * 60, Number((e.target as HTMLInputElement).value) || 180));
    store.updateSettings({ dailyCapacityMin: v });
  }
  function autoFill() {
    let left = remaining;
    const ids: string[] = [];
    for (const t of candidates) {
      const est = t.estimateMin ?? 30;
      if (est <= left) {
        ids.push(t.id);
        left -= est;
      }
      if (left < 15) break;
    }
    if (!ids.length) {
      toasts.push({ message: 'Nothing fits in the remaining time', kind: 'info' });
      return;
    }
    store.bulkUpdate(ids, { pinnedDay: store.today }, `Planned ${ids.length} task${ids.length > 1 ? 's' : ''} for today`);
  }
  const dayLabel = (k: string) => {
    const d = fromKey(k);
    return `${DAY_SHORT[d.getDay()]} ${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
  };
</script>

<section class="card">
  <div class="row-head">
    <h2>Today’s capacity</h2>
    <label class="cap"
      >I can do <input class="input num" type="number" min="15" step="15" value={capacity} onchange={setCapacity} aria-label="Daily capacity in minutes" /> min of homework a day</label
    >
  </div>
  <div class="capbar" class:over={committed > capacity}>
    <div class="fill" style="width:{Math.min(100, (committed / capacity) * 100)}%"></div>
    <span class="lbl"
      >{formatMinutes(committed)} of {formatMinutes(capacity)}{committed > capacity
        ? ` · ${formatMinutes(committed - capacity)} over`
        : remaining > 0
          ? ` · ${formatMinutes(remaining)} free`
          : ' · full'}</span
    >
  </div>
  {#if unestimatedToday}
    <p class="help">
      {unestimatedToday} task{unestimatedToday > 1 ? 's' : ''} on today’s list {unestimatedToday > 1 ? 'have' : 'has'} no estimate, so the bar is optimistic. Add
      <code>~30m</code> style estimates for a truer picture.
    </p>
  {/if}
  <div class="week" aria-label="Next 7 days load">
    {#each week as d (d.key)}
      <div class="day" class:over={d.over} class:today={d.key === store.today} title="{formatMinutes(d.min)} on {dayLabel(d.key)}">
        <div class="bar"><div class="fill" style="height:{Math.min(100, (d.min / capacity) * 100)}%"></div></div>
        <span class="dl">{DAY_SHORT[fromKey(d.key).getDay()]}</span>
        <span class="dm">{d.min ? formatMinutes(d.min) : ''}</span>
      </div>
    {/each}
  </div>
  {#if week.some((d) => d.over)}
    <p class="warn">
      ⚠ {week
        .filter((d) => d.over)
        .map((d) => dayLabel(d.key))
        .join(', ')}
      {week.filter((d) => d.over).length > 1 ? 'are' : 'is'} over capacity. Pull some of that work into earlier days below.
    </p>
  {/if}
</section>

<section class="card">
  <div class="row-head">
    <h2>Pull work forward</h2>
    <button class="btn sm" onclick={autoFill} disabled={!candidates.length || remaining < 15}>Auto-fill free time</button>
  </div>
  <p class="help">Planning a task for today keeps its deadline. It shows up in Today under “Planned for today”.</p>
  {#if planned.length}
    <ul class="list">
      {#each planned as t (t.id)}
        <li>
          <span class="dot" style="background:{store.courseById(t.courseId)?.color ?? 'var(--border-strong)'}"></span>
          <span class="grow"
            >{t.title}
            <span class="muted">· due {formatDue(t.dueAt, store.now, store.settings.timeFormat)}{t.estimateMin ? ` · ${formatMinutes(t.estimateMin)}` : ''}</span></span
          >
          <button class="btn ghost sm" onclick={() => store.unpinToday(t.id)}>Remove</button>
        </li>
      {/each}
    </ul>
  {/if}
  {#if !candidates.length}
    <p class="muted">Nothing due in the next two weeks to pull forward.</p>
  {:else}
    <ul class="list">
      {#each candidates as t (t.id)}
        <li>
          <span class="dot" style="background:{store.courseById(t.courseId)?.color ?? 'var(--border-strong)'}"></span>
          <span class="grow"
            >{t.title}
            <span class="muted">· due {formatDue(t.dueAt, store.now, store.settings.timeFormat)}{t.estimateMin ? ` · ${formatMinutes(t.estimateMin)}` : ' · no estimate'}</span
            ></span
          >
          <button class="btn sm" onclick={() => store.pinToToday(t.id)}>+ Today</button>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  section {
    margin-bottom: 12px;
  }
  h2 {
    font-size: 16px;
    margin: 0 0 8px;
  }
  .row-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
  }
  .cap {
    font-size: 13px;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .input.num {
    width: 76px;
    padding: 5px 8px;
  }
  .help {
    font-size: 13px;
    color: var(--text-muted);
    margin: 4px 0 10px;
  }
  .help code {
    font-family: var(--mono);
    font-size: 12px;
  }
  .muted {
    color: var(--text-muted);
    font-size: 13px;
  }
  .warn {
    color: var(--warn-text);
    font-size: 13px;
  }
  .capbar {
    position: relative;
    height: 26px;
    background: var(--bg-elev-2);
    border-radius: 13px;
    overflow: hidden;
    margin: 10px 0 6px;
  }
  .capbar .fill {
    height: 100%;
    background: var(--accent);
    transition: width 400ms var(--ease);
  }
  .capbar.over .fill {
    background: var(--danger);
  }
  .capbar .lbl {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 600;
    color: var(--text);
    text-shadow:
      0 0 3px var(--bg-elev),
      0 0 3px var(--bg-elev);
  }
  .week {
    display: flex;
    gap: 6px;
    margin-top: 10px;
  }
  .day {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    font-size: 11px;
    color: var(--text-muted);
  }
  .day .bar {
    width: 100%;
    height: 56px;
    background: var(--bg-elev-2);
    border-radius: 6px;
    display: flex;
    align-items: flex-end;
    overflow: hidden;
  }
  .day .fill {
    width: 100%;
    background: var(--accent);
    opacity: 0.75;
  }
  .day.over .fill {
    background: var(--danger);
    opacity: 1;
  }
  .day.today .dl {
    color: var(--accent-text);
    font-weight: 700;
  }
  .dm {
    min-height: 1.2em;
    font-size: 10px;
  }
  .list {
    list-style: none;
    margin: 0 0 8px;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .list li {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 8px;
    background: var(--bg-elev-2);
    font-size: 14px;
  }
  .dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    flex-shrink: 0;
    background: var(--course);
  }
  .grow {
    flex: 1;
    min-width: 0;
  }
</style>
