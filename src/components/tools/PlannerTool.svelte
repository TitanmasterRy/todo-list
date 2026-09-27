<script lang="ts">
  // Plan my day: daily capacity, the next 7 days of load, and pulling work forward into today.
  import { store, byDueThenOrder } from '../../lib/store.svelte';
  import { toasts } from '../../lib/toast.svelte';
  import { addDaysKey, dayName, dueKey, formatDue, formatMinutes, formatMonthDay, fromKey } from '../../lib/dates';
  import { t } from '../../lib/i18n/index.svelte';

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
      toasts.push({ message: t('planner.nothingFits'), kind: 'info' });
      return;
    }
    store.bulkUpdate(ids, { pinnedDay: store.today }, t('planner.plannedN', { count: ids.length }));
  }
  const dayLabel = (k: string) => {
    const d = fromKey(k);
    return `${dayName(d.getDay())} ${formatMonthDay(d, d)}`;
  };
</script>

<section class="card">
  <div class="row-head">
    <h2>{t('planner.capacity')}</h2>
    <label class="cap"
      >{t('planner.iCan')} <input class="input num" type="number" min="15" step="15" value={capacity} onchange={setCapacity} aria-label={t('planner.capLabel')} />
      {t('planner.perDay')}</label
    >
  </div>
  <div class="capbar" class:over={committed > capacity}>
    <div class="fill" style="width:{Math.min(100, (committed / capacity) * 100)}%"></div>
    <span class="lbl"
      >{t('wplan.of', { used: formatMinutes(committed), cap: formatMinutes(capacity) })}{committed > capacity
        ? ` · ${t('planner.over', { time: formatMinutes(committed - capacity) })}`
        : remaining > 0
          ? ` · ${t('planner.free', { time: formatMinutes(remaining) })}`
          : ` · ${t('planner.full')}`}</span
    >
  </div>
  {#if unestimatedToday}
    <p class="help">
      {t('planner.unestimated', { count: unestimatedToday })}
      <code>~30m</code>.
    </p>
  {/if}
  <div class="week" aria-label={t('planner.weekLabel')}>
    {#each week as d (d.key)}
      <div class="day" class:over={d.over} class:today={d.key === store.today} title={t('planner.on', { time: formatMinutes(d.min), day: dayLabel(d.key) })}>
        <div class="bar"><div class="fill" style="height:{Math.min(100, (d.min / capacity) * 100)}%"></div></div>
        <span class="dl">{dayName(fromKey(d.key).getDay())}</span>
        <span class="dm">{d.min ? formatMinutes(d.min) : ''}</span>
      </div>
    {/each}
  </div>
  {#if week.some((d) => d.over)}
    <p class="warn">
      ⚠ {t('planner.overDays', {
        count: week.filter((d) => d.over).length,
        days: week
          .filter((d) => d.over)
          .map((d) => dayLabel(d.key))
          .join(', '),
      })}
    </p>
  {/if}
</section>

<section class="card">
  <div class="row-head">
    <h2>{t('planner.pull')}</h2>
    <button class="btn sm" onclick={autoFill} disabled={!candidates.length || remaining < 15}>{t('planner.autofill')}</button>
  </div>
  <p class="help">{t('planner.help')}</p>
  {#if planned.length}
    <ul class="list">
      {#each planned as tk (tk.id)}
        <li>
          <span class="dot" style="background:{store.courseById(tk.courseId)?.color ?? 'var(--border-strong)'}"></span>
          <span class="grow"
            >{tk.title}
            <span class="muted"
              >· {t('planner.due', { when: formatDue(tk.dueAt, store.now, store.settings.timeFormat) })}{tk.estimateMin ? ` · ${formatMinutes(tk.estimateMin)}` : ''}</span
            ></span
          >
          <button class="btn ghost sm" onclick={() => store.unpinToday(tk.id)}>{t('editor.remove')}</button>
        </li>
      {/each}
    </ul>
  {/if}
  {#if !candidates.length}
    <p class="muted">{t('planner.nothing')}</p>
  {:else}
    <ul class="list">
      {#each candidates as tk (tk.id)}
        <li>
          <span class="dot" style="background:{store.courseById(tk.courseId)?.color ?? 'var(--border-strong)'}"></span>
          <span class="grow"
            >{tk.title}
            <span class="muted"
              >· {t('planner.due', { when: formatDue(tk.dueAt, store.now, store.settings.timeFormat) })}{tk.estimateMin
                ? ` · ${formatMinutes(tk.estimateMin)}`
                : ` · ${t('planner.noEstimate')}`}</span
            ></span
          >
          <button class="btn sm" onclick={() => store.pinToToday(tk.id)}>+ {t('date.today')}</button>
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
