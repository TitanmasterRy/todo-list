<script lang="ts">
  import { focusTrap } from '../lib/focusTrap';
  import { store } from '../lib/store.svelte';
  import { ui } from '../lib/ui.svelte';
  import { addDaysKey, dayName, daysAgoKey, dueKey, formatMinutes, formatMonthDay, fromKey } from '../lib/dates';
  import { BASE_XP } from '../lib/gamification';
  import type { Task } from '../lib/types';
  import { formatNumber, t as tr } from '../lib/i18n/index.svelte';

  const since = $derived(daysAgoKey(6, store.now));
  const doneThisWeek = $derived(store.tasks.filter((t) => t.completedAt && dueKey(t.completedAt) >= since));
  const byCourse = $derived.by(() => {
    const m = new Map<string, { name: string; color: string; emoji?: string; n: number; min: number }>();
    for (const t of doneThisWeek) {
      const c = store.courseById(t.courseId);
      const key = c?.id ?? '';
      const row = m.get(key) ?? { name: c?.name ?? tr('inbox.noCourse'), color: c?.color ?? 'var(--text-faint)', emoji: c?.emoji, n: 0, min: 0 };
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
  // coins this week (local days), from the ledger
  const weekCoins = $derived.by(() => {
    let earned = 0;
    let spent = 0;
    let quests = 0;
    for (const e of store.ledger) {
      if (e.currency !== 'coins' || dueKey(e.at) < since) continue;
      if (e.amount > 0) earned += e.amount;
      else if (e.reason.startsWith('shop:')) spent -= e.amount;
      if (e.reason === 'quest' && e.amount > 0 && !e.ref?.endsWith(':all')) quests++;
    }
    return { earned, spent, quests };
  });
  const dayLabel = (k: string) => `${dayName(fromKey(k).getDay(), 'long')} ${formatMonthDay(fromKey(k), fromKey(k))}`;
  // the sentence with a slot for the bold amount
  const coinParts = $derived(tr(weekCoins.spent ? 'review.earnedSpent' : 'review.earned', { spent: formatNumber(weekCoins.spent) }).split('{earned}'));

  function close() {
    ui.weeklyReview = false;
  }
</script>

<div class="modal-backdrop" onclick={close} role="presentation">
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div use:focusTrap class="modal review" role="dialog" aria-modal="true" aria-label={tr('stats.review')} tabindex="-1" onclick={(e) => e.stopPropagation()}>
    <h2>📋 {tr('stats.review')}</h2>
    <p class="muted">{tr('review.sub')}</p>

    <section>
      <h3>{tr('review.byCourse')} <span class="muted">{tr('review.total', { n: doneThisWeek.length })}</span></h3>
      {#if !byCourse.length}<p class="muted">{tr('review.noneDone')}</p>{/if}
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
        <h3>{tr('review.wins')}</h3>
        <ul class="wins">
          {#each wins as t (t.id)}
            <li>
              🏆 <strong>{t.title}</strong>{#if store.courseById(t.courseId)}
                <span class="muted">· {store.courseById(t.courseId)?.name}</span>{/if}{#if t.estimateMin}
                <span class="muted">· {formatMinutes(t.estimateMin)}</span>{/if}
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    <section>
      <h3>{tr('review.stale')} <span class="muted">{tr('review.staleSub')}</span></h3>
      {#if !stale.length}
        <p class="muted">{tr('review.noStale')}</p>
      {:else}
        <ul class="stale">
          {#each stale as t (t.id)}
            <li>
              <span class="grow"><strong>{t.title}</strong> <span class="muted">· {tr('review.snoozed', { n: t.deferredCount })}</span></span>
              <button class="btn sm" onclick={() => store.snoozeTask(t.id, addDaysKey(store.today, 1), tr('snooze.rescheduled'))}>{tr('date.tomorrow')}</button>
              <button class="btn sm" onclick={() => store.moveTaskToDay(t.id, null)}>{tr('today.noDate')}</button>
              <button class="btn sm danger" onclick={() => store.deleteTask(t.id)}>{tr('common.delete')}</button>
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    {#if store.settings.economyEnabled}
      <section>
        <h3>{tr('review.coins')}</h3>
        <p>
          {coinParts[0]}<strong>{formatNumber(weekCoins.earned)} 🪙</strong>{coinParts[1]}{weekCoins.quests ? ` · ${tr('review.quests', { count: weekCoins.quests })}` : ''}.
        </p>
      </section>
    {/if}

    <section>
      <h3>{tr('review.next')}</h3>
      {#if overdue}<p class="warn">
          ⚠ {tr('review.overdue', { count: overdue })}
          <button
            class="link"
            onclick={() => {
              store.rollOverdueToToday();
            }}>{tr('review.roll')}</button
          >
        </p>{/if}
      {#if heaviest && heaviest.n}
        {@const parts = tr('review.heaviest', { tasks: tr('common.tasks', { count: heaviest.n }) }).split('{day}')}
        <p>
          {parts[0]}<strong>{dayLabel(heaviest.key)}</strong>{parts[1]}{heaviest.min ? ` (${formatMinutes(heaviest.min)})` : ''}{heaviest.exams
            ? tr('review.including', { count: heaviest.exams })
            : ''}.
        </p>
      {:else}
        <p class="muted">{tr('review.nothingNext')}</p>
      {/if}
      <div class="days" aria-hidden="true">
        {#each nextDays as d (d.key)}
          <div class="day" class:heavy={heaviest && d.key === heaviest.key && d.n > 0}>
            <div class="bar"><div class="fill" style="height:{Math.max(4, (d.min / maxMin) * 100)}%"></div></div>
            <span>{dayName(fromKey(d.key).getDay(), 'long').slice(0, 2)}</span>
            <span class="n">{d.n || ''}</span>
          </div>
        {/each}
      </div>
    </section>

    <div class="actions"><button class="btn primary" onclick={close}>{tr('common.done')}</button></div>
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
    color: var(--warn-text);
    font-size: 14px;
  }
  .link {
    color: var(--accent-text);
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
