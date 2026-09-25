<script lang="ts">
  import { economy } from '../lib/economy.svelte';
  import { store } from '../lib/store.svelte';
  import ShopTab from '../components/play/ShopTab.svelte';
  import CasinoTab from '../components/play/CasinoTab.svelte';
  import ArcadeTab from '../components/play/ArcadeTab.svelte';
  import WalletTab from '../components/play/WalletTab.svelte';

  type Tab = 'shop' | 'casino' | 'arcade' | 'study' | 'stars' | 'wallet';
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
        { id: 'wallet', label: 'Wallet', icon: '👛' },
      ] as { id: Tab; label: string; icon: string }[]
    ).filter((t) => t.id !== 'casino' || store.settings.casinoEnabled),
  );
  function pick(t: Tab) {
    tab = t;
    try {
      localStorage.setItem(TAB_KEY, t);
    } catch {
      /* ignore */
    }
  }
  const active = $derived(tab === 'casino' && !store.settings.casinoEnabled ? 'shop' : tab);
</script>

<div class="page">
  <header class="page-head">
    <div>
      <h1>Play</h1>
      <div class="sub">Spend the coins you earn from schoolwork.</div>
    </div>
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
  {:else if active === 'casino'}
    <CasinoTab />
  {:else if active === 'arcade'}
    <ArcadeTab />
  {:else if active === 'study'}
    {#await import('../components/play/StudyTab.svelte')}
      <p class="sub">Loading study games…</p>
    {:then m}
      <m.default />
    {/await}
  {:else if active === 'stars'}
    {#await import('../components/play/StarMapTab.svelte')}
      <p class="sub">Loading the star map…</p>
    {:then m}
      <m.default />
    {/await}
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
    border-bottom-color: var(--accent);
  }
</style>
