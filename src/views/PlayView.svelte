<script lang="ts">
  import { economy } from '../lib/economy.svelte';
  import { store } from '../lib/store.svelte';
  import ShopTab from '../components/play/ShopTab.svelte';
  import CasinoTab from '../components/play/CasinoTab.svelte';
  import ArcadeTab from '../components/play/ArcadeTab.svelte';
  import WalletTab from '../components/play/WalletTab.svelte';
  import { activeSeason, daysLeft } from '../lib/seasons';
  import { site } from '../lib/site.svelte';

  type Tab = 'shop' | 'casino' | 'arcade' | 'study' | 'stars' | 'pet' | 'garden' | 'dungeon' | 'boards' | 'wallet';
  // the newer tabs load on first open (each is its own chunk)
  const LAZY: Partial<Record<Tab, { load: () => Promise<{ default: import('svelte').Component }>; what: string }>> = {
    study: { load: () => import('../components/play/StudyTab.svelte'), what: 'study games' },
    stars: { load: () => import('../components/play/StarMapTab.svelte'), what: 'the star map' },
    pet: { load: () => import('../components/play/PetTab.svelte'), what: 'your pet' },
    garden: { load: () => import('../components/play/GardenTab.svelte'), what: 'the garden' },
    dungeon: { load: () => import('../components/play/DungeonTab.svelte'), what: 'the dungeon' },
    boards: { load: () => import('../components/play/LeaderboardsTab.svelte'), what: 'leaderboards' },
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
  <header class="page-head hero">
    <div class="hero-orb" aria-hidden="true">🎮</div>
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

  <div class="wallet stagger" aria-label="Wallet">
    <div class="w coins">
      <span class="e">🪙</span>{#key economy.wallet.coins}<span class="n bump">{economy.wallet.coins.toLocaleString()}</span>{/key}<span class="l">coins</span>
    </div>
    {#if store.settings.casinoEnabled}<div class="w chips">
        <span class="e">🎰</span>{#key economy.wallet.chips}<span class="n bump">{economy.wallet.chips.toLocaleString()}</span>{/key}<span class="l">chips</span>
      </div>{/if}
    <div class="w vouchers">
      <span class="e">🎟️</span>{#key economy.wallet.vouchers}<span class="n bump">{economy.wallet.vouchers.toLocaleString()}</span>{/key}<span class="l">vouchers</span>
    </div>
    {#if economy.wallet.items.booster}<div class="w boost">
        <span class="e">⚡</span><span class="n">{economy.wallet.items.booster}</span><span class="l">boosted tasks</span>
      </div>{/if}
  </div>

  <div class="tabs" role="tablist">
    {#each tabs as t (t.id)}
      <button role="tab" aria-selected={active === t.id} class:on={active === t.id} onclick={() => pick(t.id)}>{t.icon} {t.label}</button>
    {/each}
  </div>

  {#if active === 'shop'}
    <ShopTab />
  {:else if active === 'casino'}
    <CasinoTab />
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
  .hero {
    position: relative;
    padding: 14px 16px;
    border-radius: var(--radius-lg);
    background:
      radial-gradient(60% 120% at 0% 0%, color-mix(in srgb, var(--season, var(--accent)) 26%, transparent), transparent 60%),
      radial-gradient(50% 120% at 100% 100%, color-mix(in srgb, var(--season-2, var(--accent-2)) 20%, transparent), transparent 60%), var(--bg-elev);
    border: 1px solid color-mix(in srgb, var(--season, var(--accent)) 35%, var(--border));
    box-shadow:
      inset 0 1px 0 var(--sheen),
      var(--shadow-sm),
      0 0 40px -16px color-mix(in srgb, var(--season, var(--accent)) 60%, transparent);
    overflow: hidden;
  }
  .hero-orb {
    width: 52px;
    height: 52px;
    border-radius: 16px;
    display: grid;
    place-items: center;
    font-size: 28px;
    background: linear-gradient(135deg, var(--season, var(--accent)), var(--season-2, var(--accent-2)));
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.35),
      0 10px 24px -8px color-mix(in srgb, var(--season, var(--accent)) 80%, transparent);
    animation: float 3.4s ease-in-out infinite;
  }
  .wallet {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin: 12px 0;
  }
  .w {
    display: flex;
    align-items: baseline;
    gap: 6px;
    border-radius: 999px;
    padding: 7px 16px 7px 12px;
    border: 1px solid transparent;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.5),
      inset 0 -2px 0 rgba(0, 0, 0, 0.12),
      var(--shadow-sm);
    transition: transform var(--dur) var(--spring);
  }
  .w:hover {
    transform: translateY(-2px) scale(1.03);
  }
  .w.coins {
    background: var(--grad-gold);
    color: #3a2a00;
  }
  .w.chips {
    background: linear-gradient(135deg, #ff8a80, #d63031 60%, #a31515);
    color: #fff;
  }
  .w.vouchers {
    background: linear-gradient(135deg, #a29bfe, #6c5ce7 60%, #4834d4);
    color: #fff;
  }
  .w.boost {
    background: linear-gradient(135deg, #81ecec, #00cec9 60%, #00a8a3);
    color: #003a38;
  }
  .e {
    font-size: 18px;
    filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.25));
  }
  .n {
    font-weight: 900;
    font-size: 18px;
    font-variant-numeric: tabular-nums;
  }
  .l {
    font-size: 12px;
    font-weight: 700;
    opacity: 0.8;
  }
  .tabs {
    display: flex;
    gap: 4px;
    margin-bottom: 14px;
    overflow-x: auto;
    padding: 4px;
    border-radius: 999px;
    background: var(--bg-elev-2);
    border: 1px solid var(--border);
    scrollbar-width: none;
  }
  .tabs::-webkit-scrollbar {
    display: none;
  }
  .tabs button {
    padding: 8px 14px;
    border-radius: 999px;
    color: var(--text-muted);
    font-weight: 700;
    font-size: 13px;
    white-space: nowrap;
    transition:
      background var(--dur),
      color var(--dur),
      transform var(--dur) var(--spring),
      box-shadow var(--dur);
  }
  .tabs button:hover {
    color: var(--text);
    background: var(--bg-hover);
  }
  .tabs button.on {
    color: var(--accent-contrast, #fff);
    background: linear-gradient(135deg, var(--season, var(--accent)), var(--season-2, var(--accent-2)));
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.3),
      0 6px 16px -6px color-mix(in srgb, var(--season, var(--accent)) 80%, transparent);
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
  .page.event .w {
    border-color: color-mix(in srgb, var(--season) 40%, transparent);
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
    animation: float 3s ease-in-out infinite;
  }
  .left {
    color: var(--text-muted);
    font-size: 12px;
  }
</style>
