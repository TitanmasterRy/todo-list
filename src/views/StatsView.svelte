<script lang="ts">
  import { store } from '../lib/store.svelte';
  import { ui } from '../lib/ui.svelte';
  import { BADGES, levelProgress, xpForLevel } from '../lib/gamification';
  import { TITLE_TEXT } from '../lib/economy';
  import { estimateAccuracy } from '../lib/estimates';
  import { endOfWeekKey, dueKey, formatMinutes, daysAgoKey, formatFullDate, fromKey } from '../lib/dates';
  import Heatmap from '../components/Heatmap.svelte';
  import GoalRing from '../components/GoalRing.svelte';
  import { t } from '../lib/i18n/index.svelte';

  const lp = $derived(levelProgress(store.stats.xp));
  const accuracy = $derived(estimateAccuracy(store.completedTasks));
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
        course: { id: '', name: t('inbox.noCourse'), color: 'var(--text-faint)', archived: false },
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
  let sharing = $state(false);
</script>

<div class="page">
  <header class="page-head">
    <div>
      <h1>{t('nav.stats')}</h1>
      <div class="sub">{t('stats.sub')}</div>
    </div>
    <div class="grow"></div>
    <button class="btn sm" onclick={() => (sharing = true)}>{t('stats.share')}</button>
    <button class="btn sm" onclick={() => (ui.weeklyReview = true)}>{t('stats.review')}</button>
  </header>
  {#if sharing}
    {#await import('../components/ShareStatsCard.svelte') then m}<m.default onclose={() => (sharing = false)} />{/await}
  {/if}

  {#if !store.settings.gamification}
    <div class="card muted">{t('stats.gameOff')}</div>
  {/if}

  <div class="tiles">
    {#if store.settings.gamification}
      <div class="card tile lift streak">
        <span class="ico" aria-hidden="true">🔥</span>
        <div class="k">{t('today.streak')}</div>
        <div class="v">
          {#key store.streak}<span class="bump">{store.streak}</span>{/key}<span class="unit">{t('stats.days', { count: store.streak })}</span>
        </div>
        <div class="s">{t('stats.best', { best: store.stats.streak.best, count: store.stats.streak.freezes })}</div>
      </div>
      <div class="card tile lift level frame-{store.settings.equippedFrame ?? 'none'}">
        <span class="ico" aria-hidden="true">⭐</span>
        <div class="k">
          {t('stats.level', { level: lp.level })}{#if store.settings.equippedTitle}
            · {TITLE_TEXT[store.settings.equippedTitle]}{/if}
        </div>
        <div class="v">
          {#key store.stats.xp}<span class="bump">{store.stats.xp}</span>{/key}<span class="unit">XP</span>
        </div>
        <div class="bar"><div class="fill" style="width:{lp.pct * 100}%"></div></div>
        <div class="s">{t('stats.toLevel', { xp: lp.needed - lp.into, level: lp.level + 1, total: xpForLevel(lp.level) })}</div>
      </div>
    {/if}
    {#if accuracy}
      <div class="card tile lift est">
        <span class="ico" aria-hidden="true">⏱</span>
        <div class="k">{t('stats.estimates')}</div>
        <div class="v">×{accuracy.medianRatio}<span class="unit">{t('stats.ratio')}</span></div>
        <div class="s">{accuracy.message} {t('stats.basedOn', { count: accuracy.n })}</div>
      </div>
    {/if}
    <div class="card tile lift ring">
      <GoalRing value={store.completedToday} goal={store.settings.dailyGoal} size={64} stroke={7} />
      <div>
        <div class="k">{t('nav.today')}</div>
        <div class="s">{t('stats.todayOf', { done: store.completedToday, goal: store.settings.dailyGoal })} · {t('stats.pomodoros', { count: pomToday })}</div>
      </div>
    </div>
    <div class="card tile lift week">
      <span class="ico" aria-hidden="true">📈</span>
      <div class="k">{t('stats.last7')}</div>
      <div class="v">{week7}<span class="unit">{t('stats.done', { count: week7 })}</span></div>
      <div class="spark" aria-hidden="true">
        {#each last7 as d}
          <span style="height:{Math.max(8, (d.n / Math.max(1, ...last7.map((x) => x.n))) * 100)}%" title={t('heat.onDay', { n: d.n, date: formatFullDate(fromKey(d.key)) })}></span>
        {/each}
      </div>
    </div>
  </div>

  <div class="card block lift">
    <Heatmap data={store.stats.completionsByDay} weekStart={store.settings.weekStart} endKey={store.today} />
  </div>

  <div class="card block">
    <div class="block-title">{t('stats.byCourse')}</div>
    {#if !byCourse.length}
      <div class="muted">{t('stats.nothingDue')}</div>
    {/if}
    <div class="bars">
      {#each byCourse as r (r.course.id)}
        <div class="row">
          <span class="name"><span class="dot" style="background:{r.course.color}"></span>{r.course.emoji ? r.course.emoji + ' ' : ''}{r.course.name}</span>
          <div class="track"><div class="fill" style="width:{(r.minutes / maxMinutes) * 100}%; background:{r.course.color}"></div></div>
          <span class="num">{t('common.tasks', { count: r.count })} · {formatMinutes(r.minutes)}{r.exams ? ` · ${t('upcoming.exams', { count: r.exams })}` : ''}</span>
        </div>
      {/each}
    </div>
  </div>

  {#await import('../components/social/FriendsCard.svelte') then m}<m.default />{/await}

  {#if store.settings.gamification}
    <div class="card block">
      <div class="block-title">{t('stats.badges')} <span class="muted">{earned.size}/{BADGES.length}</span></div>
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
    --tc: var(--accent);
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 4px;
    overflow: hidden;
  }
  .tile.streak {
    --tc: #ff7a18;
  }
  .tile.level {
    --tc: var(--gold);
  }
  .tile.est {
    --tc: var(--info);
  }
  .tile.week {
    --tc: var(--accent-2);
  }
  /* a colored badge in the corner holding the tile's emoji */
  .ico {
    position: absolute;
    top: 12px;
    inset-inline-end: 12px;
    width: 34px;
    height: 34px;
    display: grid;
    place-items: center;
    border-radius: 10px;
    font-size: 17px;
    background: color-mix(in srgb, var(--tc) 18%, var(--bg-elev-2));
    box-shadow:
      inset 0 1px 0 var(--sheen),
      0 0 14px -4px color-mix(in srgb, var(--tc) 60%, transparent);
    transition: transform var(--dur-slow) var(--spring);
  }
  .tile:hover .ico {
    transform: scale(1.15) rotate(-8deg);
  }
  .tile.level {
    background: radial-gradient(60% 80% at 100% 0%, color-mix(in srgb, var(--gold) 18%, transparent), transparent 70%), var(--bg-elev);
    border-color: color-mix(in srgb, var(--gold) 35%, var(--border));
  }
  .tile.level .v {
    background: var(--grad-gold);
    -webkit-background-clip: text;
    background-clip: text;
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
    font-size: 32px;
    font-weight: 800;
    line-height: 1.1;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
    background: linear-gradient(135deg, var(--text) 25%, color-mix(in srgb, var(--tc) 75%, var(--text)));
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  .unit {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-muted);
    -webkit-text-fill-color: var(--text-muted);
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
    position: relative;
    height: 100%;
    background: var(--grad-gold);
    box-shadow: 0 0 10px -2px var(--gold);
    transition: width 400ms var(--ease);
    overflow: hidden;
  }
  .bar .fill::after,
  .track .fill::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(115deg, transparent 30%, rgba(255, 255, 255, 0.45) 50%, transparent 70%);
    background-size: 200% 100%;
    animation: shimmer 2.6s linear infinite;
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
    background: linear-gradient(180deg, var(--accent-2), var(--accent));
    border-radius: 3px 3px 2px 2px;
    opacity: 0.85;
    transform-origin: bottom;
    transition:
      transform var(--dur) var(--spring),
      opacity var(--dur);
  }
  .spark span:hover {
    opacity: 1;
    transform: scaleY(1.08);
    box-shadow: 0 0 10px -2px var(--accent);
  }
  .block {
    margin-bottom: 12px;
  }
  .block-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 700;
    margin-bottom: 10px;
  }
  .block-title::before {
    content: '';
    width: 4px;
    height: 14px;
    border-radius: 2px;
    background: var(--grad-accent);
    box-shadow: 0 0 8px color-mix(in srgb, var(--accent) 50%, transparent);
  }
  .num {
    font-variant-numeric: tabular-nums;
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
    position: relative;
    height: 100%;
    border-radius: 5px;
    overflow: hidden;
    transition: width 400ms var(--ease);
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
    border-color: color-mix(in srgb, var(--gold) 55%, var(--border));
    background: linear-gradient(180deg, color-mix(in srgb, var(--gold) 14%, var(--bg-elev-2)), var(--bg-elev-2));
    box-shadow:
      inset 0 1px 0 var(--sheen),
      0 0 18px -6px color-mix(in srgb, var(--gold) 70%, transparent);
  }
  .badge.on .medal {
    filter: drop-shadow(0 4px 10px color-mix(in srgb, var(--gold) 60%, transparent));
  }
  .badge.on:hover {
    transform: translateY(-3px);
    box-shadow:
      inset 0 1px 0 var(--sheen),
      0 8px 24px -10px color-mix(in srgb, var(--gold) 90%, transparent);
  }
  .badge.on:hover .medal {
    transform: scale(1.2) rotate(-8deg);
  }
  .medal {
    font-size: 26px;
    transition: transform var(--dur-slow) var(--spring);
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
