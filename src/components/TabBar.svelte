<script lang="ts">
  // Phone navigation: four tabs and a More button that opens a sheet with everything else.
  import { store, VIEWS } from '../lib/store.svelte';
  import { economy } from '../lib/economy.svelte';
  import { buzz } from '../lib/haptics';
  import { playSound } from '../lib/sounds';
  import Sheet from './Sheet.svelte';
  import { t } from '../lib/i18n/index.svelte';
  const tabs = VIEWS.filter((v) => ['today', 'upcoming', 'inbox', 'courses'].includes(v.id));
  const more = $derived(VIEWS.filter((v) => ['focus', 'stats', 'tools', 'schoology', 'play', 'settings'].includes(v.id) && (v.id !== 'play' || store.settings.economyEnabled)));
  let open = $state(false);
  const moreActive = $derived(more.some((v) => v.id === store.view));
  function go(id: (typeof VIEWS)[number]['id']) {
    buzz('tap');
    playSound('nav');
    open = false;
    store.go(id);
  }
</script>

<nav class="tabbar" aria-label={t('nav.main')}>
  {#each tabs as v (v.id)}
    <button class:active={store.view === v.id} onclick={() => go(v.id)} aria-current={store.view === v.id ? 'page' : undefined} aria-label={v.label}>
      <span class="ico" aria-hidden="true">{v.icon}</span>
      <span class="lbl">{v.label}</span>
    </button>
  {/each}
  <button
    class:active={moreActive}
    onclick={() => (open = !open)}
    aria-label={moreActive ? (VIEWS.find((v) => v.id === store.view)?.label ?? t('nav.more')) : t('nav.more')}
    aria-expanded={open}
    aria-haspopup="dialog"
  >
    <span class="ico" aria-hidden="true">{moreActive ? VIEWS.find((v) => v.id === store.view)?.icon : '⋯'}</span>
    <span class="lbl">{moreActive ? VIEWS.find((v) => v.id === store.view)?.label : t('nav.more')}</span>
  </button>
</nav>
{#if open}
  <Sheet title={t('nav.more')} onclose={() => (open = false)}>
    <div class="grid" role="menu">
      {#each more as v (v.id)}
        <button role="menuitem" class="tile" class:active={store.view === v.id} onclick={() => go(v.id)} aria-current={store.view === v.id ? 'page' : undefined}>
          <span class="ico" aria-hidden="true">{v.icon}</span>
          <span>{v.label}</span>
          {#if v.id === 'play' && economy.wallet.coins > 0}<span class="badge">🪙 {economy.wallet.coins}</span>{/if}
        </button>
      {/each}
    </div>
    {#if store.settings.gamification}
      <div class="me">
        <span>🔥 {store.streak}</span>
        <span>⭐ Lv {store.stats.level}</span>
        <span>🎯 {store.completedToday}/{store.settings.dailyGoal}</span>
      </div>
    {/if}
  </Sheet>
{/if}

<style>
  .tabbar {
    display: none;
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    height: calc(var(--tabbar-h) + env(safe-area-inset-bottom));
    padding: 4px 6px env(safe-area-inset-bottom);
    background: var(--glass);
    backdrop-filter: blur(16px) saturate(1.4);
    -webkit-backdrop-filter: blur(16px) saturate(1.4);
    border-top: 1px solid color-mix(in srgb, var(--accent) 18%, var(--border));
    box-shadow: 0 -8px 30px -12px rgba(0, 0, 0, 0.35);
    z-index: 20;
  }
  .tabbar button {
    position: relative;
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    color: var(--text-faint);
    font-size: 11px;
    font-weight: 700;
    border-radius: 14px;
    -webkit-tap-highlight-color: transparent;
    transition:
      color var(--dur),
      background var(--dur);
  }
  .tabbar button.active {
    color: var(--accent-text);
    background: linear-gradient(180deg, color-mix(in srgb, var(--accent) 18%, transparent), color-mix(in srgb, var(--accent) 6%, transparent));
  }
  .tabbar button.active::before {
    content: '';
    position: absolute;
    top: 0;
    width: 22px;
    height: 3px;
    border-radius: 0 0 3px 3px;
    background: var(--grad-accent);
    box-shadow: 0 0 10px var(--accent);
  }
  .tabbar .ico {
    font-size: 22px;
    transition: transform var(--dur-slow) var(--spring);
  }
  .tabbar button.active .ico {
    transform: translateY(-2px) scale(1.15);
    filter: drop-shadow(0 4px 8px color-mix(in srgb, var(--accent) 50%, transparent));
  }
  .tabbar button:active .ico {
    transform: scale(0.9);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  .tile {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 14px 6px 12px;
    border-radius: var(--radius);
    background: var(--bg-elev-2);
    border: 1px solid var(--border);
    font-size: 13px;
    font-weight: 700;
    color: var(--text);
    min-height: 84px;
    -webkit-tap-highlight-color: transparent;
  }
  .tile:active {
    transform: scale(0.96);
  }
  .tile.active {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 14%, var(--bg-elev-2));
    color: var(--accent-text);
  }
  .tile .ico {
    font-size: 28px;
  }
  .badge {
    position: absolute;
    top: 6px;
    inset-inline-end: 6px;
    font-size: 11px;
    padding: 1px 6px;
    border-radius: 999px;
    background: var(--grad-gold);
    color: #3a2a00;
    font-weight: 800;
  }
  .me {
    display: flex;
    justify-content: center;
    gap: 18px;
    margin-top: 14px;
    font-size: 13px;
    font-weight: 700;
    color: var(--text-muted);
  }
  @media (max-width: 720px) {
    .tabbar {
      display: flex;
    }
  }
</style>
