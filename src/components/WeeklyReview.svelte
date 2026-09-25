<script lang="ts">
  import { focusTrap } from '../lib/focusTrap';
  import { store } from '../lib/store.svelte';
  import { ui } from '../lib/ui.svelte';
  import { addDaysKey, daysAgoKey, dueKey, formatMinutes, fromKey, DAY_NAMES, MONTH_SHORT } from '../lib/dates';
  import { BASE_XP } from '../lib/gamification';
  import type { Task } from '../lib/types';

  const since = $derived(daysAgoKey(6, store.now));
  const doneThisWeek = $derived(store.tasks.filter((t) => t.completedAt && dueKey(t.completedAt) >= since));
  const byCourse = $derived.by(() => {
    const m = new Map<string, { name: string; color: string; emoji?: string; n: number; min: number }>();
    for (const t of doneThisWeek) {
      const c = store.courseById(t.courseId);
      const key = c?.id ?? '';
      const row = m.get(key) ?? { name: c?.name ?? 'No course', color: c?.color ?? 'var(--text-faint)', emoji: c?.emoji, n: 0, min: 0 };
      row.n++;
      row.min += t.estimateMin ?? 0;
      m.set(key, row);
    }
    return [...m.values()].sort((a, b) => b.n - a.n);
  });
  const stale = $derived(store.openTasks.filter((t) => t.deferredCount >= 3).sort((a, b) => b.deferredCount - a.deferredCount));
  const score = (t: Task) => (BASE_XP[t.priority] ?? 10) + (t.estimateMin ?? 0) / 10 + t.subtasks.length * 2;
  const wins = $derived([...doneThisWeek].sort((a, b) => score(b) - score(a)).slice(0, 3));
  const nextDays = $derived(
    Array.from({ length: 7 }, (_, i) => addDaysKey(store.today, i + 1)).map((k) => {
      const tasks = store.openTasks.filter((t) => t.dueAt && dueKey(t.dueAt) === k);
      return { key: k, n: tasks.length, min: tasks.reduce((a, t) => a + (t.estimateMin ?? 0), 0), exams: tasks.filter((t) => t.type === 'exam' || t.type === 'quiz').length };
    }),
  );
  const heaviest = $derived(nextDays.reduce((best, d) => (d.min > best.min || (d.min === best.min && d.n > best.n) ? d : best), nextDays[0]));
  const maxMin = $derived(Math.max(1, ...nextDays.map((d) => d.min)));
  const overdue = $derived(store.overdueTasks.length);
  const dayLabel = (k: string) => {
    const d = fromKey(k);
    return `${DAY_NAMES[d.getDay()]} ${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
  };

  function close() {
    ui.weeklyReview = false;
  }
</script>

<div class="modal-backdrop" onclick={close} role="presentation">
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div use:focusTrap class="modal review" role="dialog" aria-modal="true" aria-label="Weekly review" tabindex="-1" onclick={(e) => e.stopPropagation()}>
    <h2>📋 Weekly review</h2>
    <p class="muted">Last 7 days, and a look at the week ahead.</p>

    <section>
      <h3>Completed by course <span class="muted">{doneThisWeek.length} total</span></h3>
      {#if !byCourse.length}<p class="muted">Nothing completed this week yet.</p>{/if}
      <ul class="bars">
        {#each byCourse as r (r.name)}
          <li>
            <span class="name"><span class="dot" style="background:{r.color}"></span>{r.emoji ?? ''} {r.name}</span>
            <span class="track"><span class="fill" style="width:{(r.n / Math.max(1, byCourse[0]?.n ?? 1)) * 100}%; background:{r.color}"></span></span>
            <span class="num">{r.n}{r.min ? ` · ${formatMinutes(r.min)}` : ''}</span>
          </li>
        {/each}
      </ul>
    </section>

    {#if wins.length}
      <section>
        <h3>Biggest wins</h3>
        <ul class="wins">
          {#each wins as t (t.id)}
            <li>🏆 <strong>{t.title}</strong>{#if store.courseById(t.courseId)} <span class="muted">· {store.courseById(t.courseId)?.name}</span>{/if}{#if t.estimateMin} <span class="muted">· {formatMinutes(t.estimateMin)}</span>{/if}</li>
          {/each}
        </ul>
      </section>
    {/if}

    <section>
      <h3>Stale tasks <span class="muted">snoozed 3+ times</span></h3>
      {#if !stale.length}
        <p class="muted">None. Nothing is being pushed around.</p>
      {:else}
        <ul class="stale">
          {#each stale as t (t.id)}
            <li>
              <span class="grow"><strong>{t.title}</strong> <span class="muted">· snoozed {t.deferredCount}×</span></span>
              <button class="btn sm" onclick={() => store.snoozeTask(t.id, addDaysKey(store.today, 1), 'Rescheduled')}>Tomorrow</button>
              <button class="btn sm" onclick={() => store.moveTaskToDay(t.id, null)}>No date</button>
              <button class="btn sm danger" onclick={() => store.deleteTask(t.id)}>Delete</button>
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    <section>
      <h3>Next week</h3>
      {#if overdue}<p class="warn">⚠ {overdue} overdue task{overdue > 1 ? 's' : ''} to deal with first. <button class="link" onclick={() => { store.rollOverdueToToday(); }}>Roll to today</button></p>{/if}
      {#if heaviest && heaviest.n}
        <p>Heaviest day: <strong>{dayLabel(heaviest.key)}</strong> with {heaviest.n} task{heaviest.n > 1 ? 's' : ''}{heaviest.min ? ` (${formatMinutes(heaviest.min)})` : ''}{heaviest.exams ? ` including ${heaviest.exams} exam/quiz` : ''}.</p>
      {:else}
        <p class="muted">Nothing scheduled for the next 7 days.</p>
      {/if}
      <div class="days" aria-hidden="true">
        {#each nextDays as d (d.key)}
          <div class="day" class:heavy={heaviest && d.key === heaviest.key && d.n > 0}>
            <div class="bar"><div class="fill" style="height:{Math.max(4, (d.min / maxMin) * 100)}%"></div></div>
            <span>{DAY_NAMES[fromKey(d.key).getDay()].slice(0, 2)}</span>
            <span class="n">{d.n || ''}</span>
          </div>
        {/each}
      </div>
    </section>

    <div class="actions"><button class="btn primary" onclick={close}>Done</button></div>
  </div>
</div>

<style>
  .review {
    max-width: 620px;
  }
  section {
    margin: 14px 0;
  }
  h3 {
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    margin: 0 0 8px;
    display: flex;
    gap: 8px;
    align-items: baseline;
  }
  .muted {
    color: var(--text-muted);
    font-size: 13px;
    text-transform: none;
    letter-spacing: 0;
  }
  .warn {
    color: var(--warn);
    font-size: 14px;
  }
  .link {
    color: var(--accent);
    font-weight: 500;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .bars li {
    display: grid;
    grid-template-columns: 130px 1fr auto;
    gap: 10px;
    align-items: center;
    font-size: 13px;
  }
  .name {
    display: flex;
    align-items: center;
    gap: 6px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .track {
    height: 8px;
    background: var(--bg-elev-2);
    border-radius: 4px;
    overflow: hidden;
    display: block;
  }
  .track .fill {
    display: block;
    height: 100%;
    border-radius: 4px;
  }
  .num {
    color: var(--text-muted);
    white-space: nowrap;
  }
  .wins li,
  .stale li {
    font-size: 14px;
  }
  .stale li {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  .grow {
    flex: 1;
    min-width: 160px;
  }
  .days {
    display: flex;
    gap: 6px;
    margin-top: 8px;
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
  .bar {
    width: 100%;
    height: 44px;
    background: var(--bg-elev-2);
    border-radius: 6px;
    display: flex;
    align-items: flex-end;
    overflow: hidden;
  }
  .bar .fill {
    width: 100%;
    background: var(--accent);
    opacity: 0.7;
  }
  .day.heavy .fill {
    opacity: 1;
    background: var(--warn);
  }
  .n {
    font-weight: 600;
    color: var(--text);
    min-height: 1.2em;
  }
</style>
