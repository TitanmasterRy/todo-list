<script lang="ts">
  import { store } from '../lib/store.svelte';
  import { ui } from '../lib/ui.svelte';
  import { BADGES, levelProgress, xpForLevel } from '../lib/gamification';
  import { TITLE_TEXT } from '../lib/economy';
  import { endOfWeekKey, dueKey, formatMinutes, daysAgoKey } from '../lib/dates';
  import Heatmap from '../components/Heatmap.svelte';
  import GoalRing from '../components/GoalRing.svelte';

  const lp = $derived(levelProgress(store.stats.xp));
  const earned = $derived(new Set(store.stats.badges));
  const weekEnd = $derived(endOfWeekKey(store.today, store.settings.weekStart));
  const byCourse = $derived.by(() => {
    const rows = store.activeCourses.map((c) => {
      const tasks = store.openTasks.filter((t) => t.courseId === c.id && t.dueAt && dueKey(t.dueAt) <= weekEnd);
      return {
        course: c,
        count: tasks.length,
        minutes: tasks.reduce((a, t) => a + (t.estimateMin ?? 0), 0),
        exams: tasks.filter((t) => t.type === 'exam' || t.type === 'quiz').length,
      };
    });
    const none = store.openTasks.filter((t) => !t.courseId && t.dueAt && dueKey(t.dueAt) <= weekEnd);
    if (none.length)
      rows.push({
        course: { id: '', name: 'No course', color: 'var(--text-faint)', archived: false },
        count: none.length,
        minutes: none.reduce((a, t) => a + (t.estimateMin ?? 0), 0),
        exams: 0,
      });
    return rows.filter((r) => r.count > 0).sort((a, b) => b.minutes - a.minutes);
  });
  const maxMinutes = $derived(Math.max(1, ...byCourse.map((r) => r.minutes)));
  const last7 = $derived(Array.from({ length: 7 }, (_, i) => daysAgoKey(6 - i, store.now)).map((k) => ({ key: k, n: store.stats.completionsByDay[k] ?? 0 })));
  const week7 = $derived(last7.reduce((a, d) => a + d.n, 0));
  const pomToday = $derived(store.stats.pomodorosByDay[store.today] ?? 0);
</script>

<div class="page">
  <header class="page-head">
    <div>
      <h1>Stats</h1>
      <div class="sub">Streaks, levels, badges and your week.</div>
    </div>
    <div class="grow"></div>
    <button class="btn sm" onclick={() => (ui.weeklyReview = true)}>Weekly review</button>
  </header>

  {#if !store.settings.gamification}
    <div class="card muted">Gamification is off. Turn it on in Settings to see XP, streaks and badges. The heatmap and summaries still work.</div>
  {/if}

  <div class="tiles">
    {#if store.settings.gamification}
      <div class="card tile">
        <div class="k">Streak</div>
        <div class="v">🔥 {store.streak}<span class="unit">day{store.streak === 1 ? '' : 's'}</span></div>
        <div class="s">Best {store.stats.streak.best} · {store.stats.streak.freezes} freeze{store.stats.streak.freezes === 1 ? '' : 's'} banked 🧊</div>
      </div>
      <div class="card tile frame-{store.settings.equippedFrame ?? 'none'}">
        <div class="k">
          Level {lp.level}{#if store.settings.equippedTitle}
            · {TITLE_TEXT[store.settings.equippedTitle]}{/if}
        </div>
        <div class="v">{store.stats.xp}<span class="unit">XP</span></div>
        <div class="bar"><div class="fill" style="width:{lp.pct * 100}%"></div></div>
        <div class="s">{lp.needed - lp.into} XP to level {lp.level + 1} ({xpForLevel(lp.level)} total)</div>
      </div>
    {/if}
    <div class="card tile ring">
      <GoalRing value={store.completedToday} goal={store.settings.dailyGoal} size={64} stroke={7} />
      <div>
        <div class="k">Today</div>
        <div class="s">{store.completedToday} of {store.settings.dailyGoal} · {pomToday} pomodoro{pomToday === 1 ? '' : 's'}</div>
      </div>
    </div>
    <div class="card tile">
      <div class="k">Last 7 days</div>
      <div class="v">{week7}<span class="unit">done</span></div>
      <div class="spark" aria-hidden="true">
        {#each last7 as d}
          <span style="height:{Math.max(8, (d.n / Math.max(1, ...last7.map((x) => x.n))) * 100)}%" title="{d.n} on {d.key}"></span>
        {/each}
      </div>
    </div>
  </div>

  <div class="card block">
    <Heatmap data={store.stats.completionsByDay} weekStart={store.settings.weekStart} endKey={store.today} />
  </div>

  <div class="card block">
    <div class="block-title">Due this week by course</div>
    {#if !byCourse.length}
      <div class="muted">Nothing due this week.</div>
    {/if}
    <div class="bars">
      {#each byCourse as r (r.course.id)}
        <div class="row">
          <span class="name"><span class="dot" style="background:{r.course.color}"></span>{r.course.emoji ? r.course.emoji + ' ' : ''}{r.course.name}</span>
          <div class="track"><div class="fill" style="width:{(r.minutes / maxMinutes) * 100}%; background:{r.course.color}"></div></div>
          <span class="num">{r.count} task{r.count === 1 ? '' : 's'} · {formatMinutes(r.minutes)}{r.exams ? ` · ${r.exams} exam/quiz` : ''}</span>
        </div>
      {/each}
    </div>
  </div>

  {#if store.settings.gamification}
    <div class="card block">
      <div class="block-title">Badges <span class="muted">{earned.size}/{BADGES.length}</span></div>
      <div class="badges">
        {#each BADGES as b (b.id)}
          <div class="badge" class:on={earned.has(b.id)} title={b.description}>
            <span class="medal">{b.emoji}</span>
            <span class="bn">{b.name}</span>
            <span class="bd">{b.description}</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .frame-frame-gold {
    box-shadow:
      0 0 0 2px #f5c542,
      0 0 18px rgba(245, 197, 66, 0.35);
  }
  .frame-frame-neon {
    box-shadow:
      0 0 0 2px var(--accent),
      0 0 20px var(--accent);
  }
  .frame-frame-leaf {
    box-shadow:
      0 0 0 2px #2e7d32,
      0 0 14px rgba(46, 125, 50, 0.4);
  }
  .tiles {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
    gap: 10px;
    margin-bottom: 12px;
  }
  .tile {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .tile.ring {
    flex-direction: row;
    align-items: center;
    gap: 12px;
  }
  .k {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    font-weight: 600;
  }
  .v {
    font-size: 26px;
    font-weight: 700;
    line-height: 1.1;
  }
  .unit {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-muted);
    margin-left: 6px;
  }
  .s {
    font-size: 12px;
    color: var(--text-muted);
  }
  .bar {
    height: 6px;
    background: var(--bg-elev-2);
    border-radius: 3px;
    overflow: hidden;
    margin: 4px 0;
  }
  .bar .fill {
    height: 100%;
    background: var(--accent);
    transition: width 400ms var(--ease);
  }
  .spark {
    display: flex;
    align-items: flex-end;
    gap: 3px;
    height: 34px;
    margin-top: 4px;
  }
  .spark span {
    flex: 1;
    background: var(--accent);
    border-radius: 2px;
    opacity: 0.8;
  }
  .block {
    margin-bottom: 12px;
  }
  .block-title {
    font-weight: 700;
    margin-bottom: 10px;
  }
  .muted {
    color: var(--text-muted);
    font-size: 13px;
    font-weight: 400;
  }
  .bars {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .row {
    display: grid;
    grid-template-columns: 140px 1fr auto;
    align-items: center;
    gap: 10px;
    font-size: 13px;
  }
  .name {
    display: flex;
    align-items: center;
    gap: 6px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .track {
    height: 10px;
    background: var(--bg-elev-2);
    border-radius: 5px;
    overflow: hidden;
  }
  .track .fill {
    height: 100%;
    border-radius: 5px;
  }
  .num {
    color: var(--text-muted);
    white-space: nowrap;
  }
  .badges {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 8px;
  }
  .badge {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 2px;
    padding: 12px 8px;
    border-radius: 12px;
    border: 1px solid var(--border);
    background: var(--bg-elev-2);
    transition: transform var(--dur) var(--spring);
  }
  /* locked badges: gray, dashed and muted, but the text stays readable (no whole-card opacity) */
  .badge:not(.on) {
    border-style: dashed;
    color: var(--text-muted);
  }
  .badge:not(.on) .medal {
    filter: grayscale(1);
    opacity: 0.45;
  }
  .badge.on {
    border-color: color-mix(in srgb, var(--warn) 50%, var(--border));
  }
  .badge.on:hover {
    transform: translateY(-2px);
  }
  .medal {
    font-size: 26px;
  }
  .bn {
    font-weight: 600;
    font-size: 13px;
  }
  .bd {
    font-size: 11px;
    color: var(--text-muted);
  }
  @media (max-width: 720px) {
    .row {
      grid-template-columns: 100px 1fr;
    }
    .num {
      grid-column: 2;
      white-space: normal;
    }
  }
</style>
