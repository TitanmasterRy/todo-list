<script lang="ts">
  // Tools → Plan my week: spread the next week's work over days by estimate and how much time you have each day.
  // Applying pins each task to its planned day (it shows on Today that day); due dates don't change.
  import { store } from '../../lib/store.svelte';
  import { toasts } from '../../lib/toast.svelte';
  import { dayName, formatMinutes, formatMonthDay, fromKey } from '../../lib/dates';
  import { t } from '../../lib/i18n/index.svelte';
  import { DEFAULT_ESTIMATE, pinsFor, planWeek } from '../../lib/weekplan';

  let includeUndated = $state(false);
  let showCaps = $state(false);
  const base = $derived(store.settings.dailyCapacityMin || 180);
  const capFor = (dow: number) => store.settings.weekdayCapacityMin?.[dow] ?? base;
  const plan = $derived(planWeek(store.tasks, { today: store.today, capacity: (k) => capFor(fromKey(k).getDay()), includeUndated }));
  const pins = $derived(pinsFor(plan));
  const changes = $derived(Object.entries(pins).filter(([id, day]) => store.taskById(id)?.pinnedDay !== day).length);
  const total = $derived(plan.days.reduce((a, d) => a + d.used, 0));
  const late = $derived(plan.days.flatMap((d) => d.items.filter((i) => i.late)));
  const guessed = $derived(plan.days.flatMap((d) => d.items.filter((i) => i.guessed)).length);

  function setCap(dow: number, v: string) {
    const n = Math.max(0, Math.min(24 * 60, Number(v) || 0));
    store.updateSettings({ weekdayCapacityMin: { ...(store.settings.weekdayCapacityMin ?? {}), [dow]: n } });
  }
  function apply() {
    const n = store.applyPins(pins, t('wplan.undo'));
    toasts.push({
      message: n ? t('wplan.planned', { count: n }) : t('wplan.already'),
      detail: n ? t('wplan.plannedDetail') : undefined,
      kind: 'success',
      emoji: '🗓️',
    });
  }
  const md = (k: string) => formatMonthDay(fromKey(k), fromKey(k));
</script>

<section class="card">
  <div class="head">
    <h2>📅 {t('tools.week')}</h2>
    <span class="muted">{t('wplan.total', { time: formatMinutes(total) })}</span>
  </div>
  <p class="help">
    {t('wplan.help', { n: DEFAULT_ESTIMATE })}
  </p>
  <div class="row">
    <label class="chk"><input type="checkbox" bind:checked={includeUndated} /> {t('wplan.undated')}</label>
    <button class="btn sm ghost" aria-expanded={showCaps} onclick={() => (showCaps = !showCaps)}>{t('wplan.perDay')}</button>
    <span class="grow"></span>
    <button class="btn primary sm" onclick={apply} disabled={!changes}>{t('wplan.apply')}{changes ? ` (${changes})` : ''}</button>
  </div>
  {#if showCaps}
    <div class="caps">
      {#each [1, 2, 3, 4, 5, 6, 0] as d (d)}
        <label
          >{dayName(d)}
          <input
            class="input n"
            type="number"
            min="0"
            step="15"
            value={capFor(d)}
            onchange={(e) => setCap(d, e.currentTarget.value)}
            aria-label={t('wplan.minutesOn', { day: dayName(d, 'long') })}
          /></label
        >
      {/each}
    </div>
  {/if}
  {#if late.length}
    <p class="warn" role="status">
      ⚠ {t('wplan.late', { count: late.length, titles: late.map((i) => i.task.title).join(', ') })}
    </p>
  {/if}

  <div class="days">
    {#each plan.days as d (d.key)}
      {@const pct = d.capacity ? Math.min(100, (d.used / d.capacity) * 100) : d.used ? 100 : 0}
      <div class="day" class:today={d.key === store.today} aria-label="{dayName(fromKey(d.key).getDay(), 'long')} {md(d.key)}">
        <h3>{d.key === store.today ? t('date.today') : dayName(fromKey(d.key).getDay())} <small>{md(d.key)}</small></h3>
        <div class="meter" class:over={d.used > d.capacity} title={t('wplan.of', { used: formatMinutes(d.used), cap: formatMinutes(d.capacity) })}>
          <span style="width:{pct}%"></span>
        </div>
        <div class="load">{formatMinutes(d.used)} / {formatMinutes(d.capacity)}</div>
        <ul>
          {#each d.items as it (it.task.id)}
            {@const c = store.courseById(it.task.courseId)}
            <li class:late={it.late} style="--c:{c?.color ?? 'var(--border-strong, var(--border))'}">
              <button class="t" onclick={() => (store.editingTaskId = it.task.id)}>{it.task.title}</button>
              <span class="m">{it.guessed ? '~' : ''}{formatMinutes(it.min)}{it.task.dueAt && it.task.dueAt.slice(0, 10) === d.key ? ` · ${t('wplan.due')}` : ''}</span>
            </li>
          {/each}
        </ul>
      </div>
    {/each}
  </div>
  {#if guessed}<p class="muted">{t('wplan.guessed')}</p>{/if}
  {#if plan.unplaced.length}
    <p class="muted">{t('wplan.unplaced', { titles: plan.unplaced.map((x) => x.title).join(', ') })}</p>
  {/if}
</section>

<style>
  .head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
  }
  h2 {
    font-size: 16px;
    margin: 0 0 6px;
  }
  .help,
  .muted {
    font-size: 13px;
    color: var(--text-muted);
    margin: 6px 0;
  }
  .warn {
    color: var(--warn-text);
    font-size: 13px;
    margin: 6px 0;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin: 8px 0;
    font-size: 13px;
  }
  .grow {
    flex: 1;
  }
  .chk {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .caps {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin: 6px 0 10px;
    font-size: 13px;
  }
  .caps label {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .n {
    width: 72px;
    padding: 4px 6px;
  }
  .days {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 8px;
  }
  @media (max-width: 900px) {
    .days {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  @media (max-width: 480px) {
    .days {
      grid-template-columns: 1fr;
    }
  }
  .day {
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 8px;
    min-width: 0;
  }
  .day.today {
    border-color: var(--accent);
  }
  .day h3 {
    font-size: 13px;
    margin: 0 0 6px;
  }
  .day h3 small {
    color: var(--text-muted);
    font-weight: 400;
  }
  .meter {
    height: 6px;
    border-radius: 3px;
    background: color-mix(in srgb, var(--accent) 15%, transparent);
    overflow: hidden;
  }
  .meter span {
    display: block;
    height: 100%;
    background: var(--accent);
    border-radius: 3px;
  }
  .meter.over span {
    background: var(--danger, #e5484d);
  }
  .load {
    font-size: 11px;
    color: var(--text-muted);
    margin: 3px 0 6px;
    font-variant-numeric: tabular-nums;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 4px;
  }
  li {
    border-left: 3px solid var(--c);
    padding: 3px 6px;
    border-radius: 4px;
    background: var(--bg-sunken, var(--bg-elev));
    font-size: 12px;
  }
  li.late {
    outline: 1px solid var(--warn-text);
  }
  .t {
    display: block;
    text-align: left;
    width: 100%;
    color: var(--text);
    font-size: 12px;
    font-weight: 600;
    padding: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .m {
    color: var(--text-muted);
  }
</style>
