<script lang="ts">
  import { economy } from '../lib/economy.svelte';
  import { store } from '../lib/store.svelte';
  import ShopTab from '../components/play/ShopTab.svelte';
  import ArcadeTab from '../components/play/ArcadeTab.svelte';
  import WalletTab from '../components/play/WalletTab.svelte';
  import { activeSeason, daysLeft } from '../lib/seasons';
  import { site } from '../lib/site.svelte';

  type Tab = 'shop' | 'casino' | 'arcade' | 'study' | 'stars' | 'pet' | 'garden' | 'dungeon' | 'boards' | 'factory' | 'watch' | 'wallet';
  // the newer tabs load on first open (each is its own chunk)
  const LAZY: Partial<Record<Tab, { load: () => Promise<{ default: import('svelte').Component }>; what: string }>> = {
    casino: { load: () => import('../components/play/CasinoTab.svelte'), what: 'the casino' },
    study: { load: () => import('../components/play/StudyTab.svelte'), what: 'study games' },
    stars: { load: () => import('../components/play/StarMapTab.svelte'), what: 'the star map' },
    pet: { load: () => import('../components/play/PetTab.svelte'), what: 'your pet' },
    garden: { load: () => import('../components/play/GardenTab.svelte'), what: 'the garden' },
    dungeon: { load: () => import('../components/play/DungeonTab.svelte'), what: 'the dungeon' },
    boards: { load: () => import('../components/play/LeaderboardsTab.svelte'), what: 'leaderboards' },
    factory: { load: () => import('../components/play/factory/FactoryGame.svelte'), what: 'the factory' },
    watch: { load: () => import('../components/play/watch/WatchTab.svelte'), what: 'Watch' },
  };
  // a seasonal event (Halloween, winter, finals, summer) gives the page a themed look
  const event = $derived(activeSeason(store.today));
  const TAB_KEY = 'homework-todo:play-tab';
  let tab = $state<Tab>(
    ((): Tab => {
      try {
        return (localStorage.getItem(TAB_KEY) as Tab) || 'shop';
      } catch {
        return 'shop';
      }
    })(),
  );
  const tabs = $derived(
    (
      [
        { id: 'shop', label: 'Shop', icon: '🛍️' },
        { id: 'casino', label: 'Casino', icon: '🎰' },
        { id: 'arcade', label: 'Arcade', icon: '🕹️' },
        { id: 'study', label: 'Study games', icon: '🧠' },
        { id: 'stars', label: 'Star map', icon: '🌌' },
        { id: 'factory', label: 'Factory', icon: '🏭' },
        { id: 'watch', label: 'Watch', icon: '📺' },
        { id: 'pet', label: 'Pet', icon: '🐣' },
        { id: 'garden', label: 'Garden', icon: '🌱' },
        { id: 'dungeon', label: 'Dungeon', icon: '🏰' },
        { id: 'boards', label: 'Leaderboards', icon: '🏆' },
        { id: 'wallet', label: 'Wallet', icon: '👛' },
      ] as { id: Tab; label: string; icon: string }[]
    ).filter((t) => available(t.id)),
  );
  // the casino can be off in Settings; the site admin can switch the casino, arcade and shop off for everyone (site.json)
  function available(id: Tab): boolean {
    if (id === 'casino') return store.settings.casinoEnabled && site.on('casino');
    if (id === 'arcade') return site.on('arcade');
    if (id === 'shop') return site.on('shop');
    return true;
  }
  function pick(t: Tab) {
    tab = t;
    try {
      localStorage.setItem(TAB_KEY, t);
    } catch {
      /* ignore */
    }
  }
  const active = $derived(available(tab) ? tab : (tabs[0]?.id ?? 'wallet'));
</script>

<div class="page" class:event={!!event} data-season={event?.season.id}>
  <header class="page-head">
    <div>
      <h1>Play</h1>
      <div class="sub">Spend the coins you earn from schoolwork.</div>
    </div>
    {#if event}
      <div class="grow"></div>
      <div class="event-tag" data-event-banner>
        <span class="decor" aria-hidden="true">{event.season.decor.join(' ')}</span>
        <strong>{event.season.emoji} {event.season.name} event</strong>
        <span class="left">{daysLeft(event.window, store.today)} day{daysLeft(event.window, store.today) === 1 ? '' : 's'} left · limited items in the Shop</span>
      </div>
    {/if}
  </header>

  <div class="wallet" aria-label="Wallet">
    <div class="w"><span class="e">🪙</span><span class="n">{economy.wallet.coins.toLocaleString()}</span><span class="l">coins</span></div>
    {#if store.settings.casinoEnabled}<div class="w"><span class="e">🎰</span><span class="n">{economy.wallet.chips.toLocaleString()}</span><span class="l">chips</span></div>{/if}
    <div class="w"><span class="e">🎟️</span><span class="n">{economy.wallet.vouchers.toLocaleString()}</span><span class="l">vouchers</span></div>
    {#if economy.wallet.items.booster}<div class="w"><span class="e">⚡</span><span class="n">{economy.wallet.items.booster}</span><span class="l">boosted tasks</span></div>{/if}
  </div>

  <div class="tabs" role="tablist">
    {#each tabs as t (t.id)}
      <button role="tab" aria-selected={active === t.id} class:on={active === t.id} onclick={() => pick(t.id)}>{t.icon} {t.label}</button>
    {/each}
  </div>

  {#if active === 'shop'}
    <ShopTab />
  {:else if active === 'arcade'}
    <ArcadeTab />
  {:else if LAZY[active]}
    {@const lazy = LAZY[active]!}
    {#key active}
      {#await lazy.load()}
        <p class="sub">Loading {lazy.what}…</p>
      {:then m}
        <m.default />
      {/await}
    {/key}
  {:else}
    <WalletTab />
  {/if}
</div>

<style>
  .sub {
    color: var(--text-muted);
    font-size: 13px;
  }
  .page {
    max-width: 980px;
  }
  .wallet {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 12px;
  }
  .w {
    display: flex;
    align-items: baseline;
    gap: 6px;
    background: var(--bg-elev);
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 6px 14px;
  }
  .e {
    font-size: 18px;
  }
  .n {
    font-weight: 800;
    font-size: 18px;
    font-variant-numeric: tabular-nums;
  }
  .l {
    font-size: 12px;
    color: var(--text-muted);
  }
  .tabs {
    display: flex;
    gap: 4px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 14px;
    overflow-x: auto;
  }
  .tabs button {
    padding: 10px 14px;
    border-bottom: 2px solid transparent;
    color: var(--text-muted);
    font-weight: 600;
    white-space: nowrap;
  }
  .tabs button.on {
    color: var(--text);
    border-bottom-color: var(--season, var(--accent));
  }
  .grow {
    flex: 1;
  }
  /* seasonal look: a tinted header and tab underline in the event's colors (text colors stay the theme's) */
  .page[data-season='halloween'] {
    --season: #ff7518;
    --season-2: #7b2cbf;
  }
  .page[data-season='winter'] {
    --season: #4ea8de;
    --season-2: #b8e0ff;
  }
  .page[data-season='finals'] {
    --season: #6c5ce7;
    --season-2: #fdcb6e;
  }
  .page[data-season='summer'] {
    --season: #f4a261;
    --season-2: #2ec4b6;
  }
  .page.event .page-head {
    background: linear-gradient(120deg, color-mix(in srgb, var(--season) 20%, var(--bg-elev)), color-mix(in srgb, var(--season-2) 16%, var(--bg-elev)));
    border: 1px solid color-mix(in srgb, var(--season) 45%, var(--border));
    border-radius: var(--radius);
    padding: 12px 14px;
    flex-wrap: wrap;
    gap: 8px;
  }
  .page.event .w {
    border-color: color-mix(in srgb, var(--season) 40%, var(--border));
  }
  .event-tag {
    display: grid;
    gap: 2px;
    justify-items: end;
    text-align: end;
    font-size: 13px;
  }
  .decor {
    font-size: 20px;
    letter-spacing: 4px;
  }
  .left {
    color: var(--text-muted);
    font-size: 12px;
  }
</style>
