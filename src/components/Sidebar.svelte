<script lang="ts">
  import { store, VIEWS } from '../lib/store.svelte';
  import { levelProgress, levelTitle } from '../lib/gamification';
  import { ui } from '../lib/ui.svelte';
  import { economy } from '../lib/economy.svelte';
  import { TITLE_TEXT } from '../lib/economy';
  import { formatNumber, t } from '../lib/i18n/index.svelte';

  const lp = $derived(levelProgress(store.stats.xp));
  const views = $derived(VIEWS.filter((v) => v.id !== 'play' || store.settings.economyEnabled));
  const title = $derived(store.settings.equippedTitle ? TITLE_TEXT[store.settings.equippedTitle] : levelTitle(lp.level));
</script>

<nav class="sidebar" aria-label={t('nav.main')}>
  <div class="brand">
    <span class="logo" aria-hidden="true">✓</span>
    <span class="brand-name">Homework</span>
  </div>
  <ul>
    {#each views as v (v.id)}
      <li>
        <button class:active={store.view === v.id} onclick={() => store.go(v.id)} aria-current={store.view === v.id ? 'page' : undefined}>
          <span class="ico" aria-hidden="true">{v.icon}</span>
          <span class="lbl">{v.label}</span>
          {#if v.key}<span class="kbd">{v.key}</span>{/if}
        </button>
      </li>
    {/each}
  </ul>
  {#if store.settings.smartLists.length}
    <div class="courses">
      <div class="head">{t('nav.lists')}</div>
      {#each store.settings.smartLists as l (l.id)}
        <button
          class="course"
          class:active={store.view === 'inbox' && ui.inboxList === l.id}
          onclick={() => {
            ui.inboxList = l.id;
            ui.inboxListNonce++;
            if (store.view !== 'inbox') store.go('inbox');
          }}
        >
          <span class="lbl">{l.emoji} {l.name}</span>
        </button>
      {/each}
    </div>
  {/if}
  {#if store.activeCourses.length}
    <div class="courses">
      <div class="head">{t('nav.coursesHead')}</div>
      {#each store.activeCourses as c (c.id)}
        <button class="course" class:active={store.view === 'courses' && store.courseFilter === c.id} onclick={() => store.go('courses', { courseId: c.id })}>
          <span class="dot" style="background:{c.color}"></span>
          <span class="lbl">{c.emoji ? c.emoji + ' ' : ''}{c.name}</span>
          <span class="n">{store.openTasks.filter((t) => t.courseId === c.id).length}</span>
        </button>
      {/each}
    </div>
  {/if}
  <div class="grow"></div>
  {#if store.settings.economyEnabled}
    <button class="wallet" onclick={() => store.go('play')} title={t('nav.wallet')}>
      {#key economy.wallet.coins}<span class="bump">🪙 {formatNumber(economy.wallet.coins)}</span>{/key}
      {#if store.settings.casinoEnabled}{#key economy.wallet.chips}<span class="bump">🎰 {formatNumber(economy.wallet.chips)}</span>{/key}{/if}
      {#key economy.wallet.vouchers}<span class="bump">🎟️ {economy.wallet.vouchers}</span>{/key}
    </button>
  {/if}
  {#if store.settings.gamification}
    <div class="level frame-{store.settings.equippedFrame ?? 'none'}" title="{store.stats.xp} XP">
      <div class="lvl-row"><span>{t('nav.level', { level: lp.level, title })}</span><span class="muted">{lp.into}/{lp.needed}</span></div>
      <div class="bar"><div class="fill" style="width:{lp.pct * 100}%"><i class="shine"></i></div></div>
    </div>
  {/if}
  <button class="btn ghost sm palette" onclick={() => (ui.palette = true)}>
    <span>{t('nav.palette')}</span><span class="kbd">⌘K</span>
  </button>
</nav>

<style>
  .sidebar {
    position: fixed;
    top: 0;
    inset-inline-start: 0;
    bottom: 0;
    width: var(--sidebar-w);
    background: linear-gradient(180deg, color-mix(in srgb, var(--accent) 7%, var(--bg-elev)), var(--bg-elev) 40%);
    border-inline-end: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    padding: 16px 10px;
    gap: 4px;
    z-index: 10;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 800;
    padding: 4px 8px 16px;
    font-size: 17px;
    letter-spacing: -0.01em;
  }
  .brand-name {
    background: linear-gradient(135deg, var(--text), color-mix(in srgb, var(--accent) 60%, var(--text)));
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  .logo {
    width: 30px;
    height: 30px;
    border-radius: 10px;
    background: var(--grad-accent);
    color: var(--accent-contrast, #fff);
    display: grid;
    place-items: center;
    font-size: 16px;
    font-weight: 900;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.35),
      0 6px 16px -4px color-mix(in srgb, var(--accent) 70%, transparent);
    transition: transform var(--dur-slow) var(--spring);
  }
  .brand:hover .logo {
    transform: rotate(-8deg) scale(1.08);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  li button,
  .course {
    position: relative;
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 8px 10px;
    border-radius: 10px;
    color: var(--text-muted);
    font-weight: 600;
    text-align: start;
    transition:
      background var(--dur),
      color var(--dur),
      transform var(--dur) var(--spring);
  }
  li button:hover,
  .course:hover {
    background: var(--bg-hover);
    color: var(--text);
    transform: translateX(2px);
  }
  li button:hover .ico {
    transform: scale(1.18) rotate(-6deg);
  }
  li button.active,
  .course.active {
    background: linear-gradient(90deg, color-mix(in srgb, var(--accent) 22%, transparent), color-mix(in srgb, var(--accent-2) 8%, transparent));
    color: var(--text);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 30%, transparent);
  }
  li button.active::before {
    content: '';
    position: absolute;
    inset-inline-start: -10px;
    top: 20%;
    height: 60%;
    width: 4px;
    border-radius: 0 4px 4px 0;
    background: var(--grad-accent);
    box-shadow: 0 0 10px var(--accent);
  }
  .ico {
    width: 20px;
    text-align: center;
    transition: transform var(--dur-slow) var(--spring);
  }
  .lbl {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .courses {
    margin-top: 16px;
  }
  .courses .head {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text-faint);
    padding: 0 10px 6px;
    font-weight: 700;
  }
  .course {
    font-size: 14px;
    padding: 6px 10px;
  }
  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
    box-shadow: 0 0 8px color-mix(in srgb, currentColor 0%, transparent);
  }
  .course:hover .dot {
    transform: scale(1.3);
  }
  .n {
    font-size: 11px;
    font-weight: 700;
    color: var(--text-faint);
    background: var(--bg-elev-2);
    border-radius: 999px;
    padding: 0 6px;
    line-height: 1.6;
  }
  .grow {
    flex: 1;
  }
  .wallet {
    display: flex;
    justify-content: space-between;
    gap: 6px;
    font-size: 12px;
    font-weight: 800;
    padding: 7px 10px;
    margin: 0 4px 8px;
    border-radius: 999px;
    color: #3a2a00;
    background: var(--grad-gold);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.6),
      inset 0 -2px 0 rgba(0, 0, 0, 0.15),
      0 6px 16px -6px rgba(245, 197, 66, 0.7);
    font-variant-numeric: tabular-nums;
    transition: transform var(--dur) var(--spring);
  }
  .wallet:hover {
    transform: translateY(-1px) scale(1.02);
  }
  .level.frame-frame-gold {
    box-shadow:
      0 0 0 2px #f5c542,
      0 0 14px rgba(245, 197, 66, 0.35);
    border-radius: var(--radius-sm);
  }
  .level.frame-frame-neon {
    box-shadow:
      0 0 0 2px var(--accent),
      0 0 16px var(--accent);
    border-radius: var(--radius-sm);
  }
  .level.frame-frame-leaf {
    box-shadow:
      0 0 0 2px #2e7d32,
      0 0 12px rgba(46, 125, 50, 0.4);
    border-radius: var(--radius-sm);
  }
  .level {
    padding: 10px 12px;
    margin: 0 2px 6px;
    font-size: 13px;
    border-radius: var(--radius);
    background: color-mix(in srgb, var(--accent) 8%, var(--bg-elev-2));
    border: 1px solid color-mix(in srgb, var(--accent) 20%, var(--border));
  }
  .lvl-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 6px;
    font-weight: 700;
  }
  .muted {
    color: var(--text-faint);
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }
  .bar {
    height: 8px;
    background: var(--bg);
    border-radius: 4px;
    overflow: hidden;
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.3);
  }
  .fill {
    position: relative;
    height: 100%;
    border-radius: 4px;
    background: var(--grad-accent);
    box-shadow: 0 0 10px color-mix(in srgb, var(--accent) 60%, transparent);
    transition: width 600ms var(--spring);
    overflow: hidden;
  }
  .shine {
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.45), transparent);
    background-size: 200% 100%;
    animation: shimmer 2.6s linear infinite;
  }
  .palette {
    justify-content: space-between;
    width: 100%;
  }
  @media (max-width: 720px) {
    .sidebar {
      display: none;
    }
  }
</style>
