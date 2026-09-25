<script lang="ts">
  import { economy } from '../../lib/economy.svelte';
  import { store } from '../../lib/store.svelte';
  import { SECTION_LABEL, SHOP, TITLE_TEXT, type ShopItem, type ShopSection } from '../../lib/economy';
  import { toasts } from '../../lib/toast.svelte';

  const sections: ShopSection[] = ['currency', 'boosts', 'cosmetics', 'prizes'];
  const s = $derived(store.settings);

  function buy(item: ShopItem) {
    if (economy.buy(item.id)) toasts.push({ message: `Bought ${item.name}`, kind: 'success', emoji: item.emoji, timeout: 1800 });
  }
  function equipped(item: ShopItem): boolean {
    return (
      (item.kind === 'title' && s.equippedTitle === item.id) ||
      (item.kind === 'frame' && s.equippedFrame === item.id) ||
      (item.kind === 'confetti' && s.equippedConfetti === item.id)
    );
  }
  function toggleEquip(item: ShopItem) {
    if (item.kind !== 'title' && item.kind !== 'frame' && item.kind !== 'confetti') return;
    economy.equip(item.kind, equipped(item) ? undefined : item.id);
  }
  const ownedCount = (id: string) => economy.wallet.items[id] ?? 0;
</script>

{#each sections as sec (sec)}
  {@const items = SHOP.filter((i) => i.section === sec && (sec !== 'prizes' || s.casinoEnabled))}
  {#if items.length}
    <h2 class="sec">{SECTION_LABEL[sec]}</h2>
    <div class="items">
      {#each items as item (item.id)}
        {@const check = economy.check(item)}
        {@const own = ownedCount(item.id)}
        <div class="item card" class:owned={item.unique && own > 0}>
          <div class="emoji" aria-hidden="true">{item.emoji}</div>
          <div class="info">
            <div class="name">
              {item.name}{#if !item.unique && own > 0}<span class="own">×{own}</span>{/if}
            </div>
            <div class="desc">{item.description}</div>
          </div>
          <div class="act">
            {#if item.unique && own > 0}
              {#if item.kind === 'title' || item.kind === 'frame' || item.kind === 'confetti'}
                <button class="btn sm" class:primary={equipped(item)} onclick={() => toggleEquip(item)}>{equipped(item) ? 'Equipped' : 'Equip'}</button>
              {:else}
                <span class="got">Owned</span>
              {/if}
            {:else}
              <button class="btn sm primary" onclick={() => buy(item)} disabled={!check.ok} title={check.ok ? '' : check.reason}>
                {item.price.toLocaleString()}
                {item.pay === 'coins' ? '🪙' : '🎰'}
              </button>
              {#if !check.ok}<span class="why">{check.reason}</span>{/if}
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
{/each}

{#if s.equippedTitle}
  <p class="muted">Your title: <strong>{TITLE_TEXT[s.equippedTitle]}</strong> (shown in the sidebar and on Stats).</p>
{/if}
<p class="muted">Coins only come from schoolwork: tasks, the daily ring, streaks, grades, notecards and Pomodoros. Chips can't be turned back into coins.</p>

<style>
  .sec {
    font-size: 15px;
    margin: 18px 0 8px;
  }
  .items {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 8px;
  }
  .item {
    display: grid;
    grid-template-columns: 40px 1fr;
    gap: 4px 10px;
    align-items: center;
    padding: 12px;
  }
  .item.owned {
    opacity: 0.85;
  }
  .emoji {
    font-size: 28px;
    grid-row: span 2;
    text-align: center;
  }
  .name {
    font-weight: 700;
    font-size: 14px;
  }
  .own {
    margin-left: 6px;
    color: var(--accent);
  }
  .desc {
    font-size: 12px;
    color: var(--text-muted);
  }
  .act {
    grid-column: 2;
    display: flex;
    gap: 8px;
    align-items: center;
    margin-top: 4px;
  }
  .why {
    font-size: 11px;
    color: var(--text-muted);
  }
  .got {
    font-size: 12px;
    color: var(--success);
    font-weight: 700;
  }
  .muted {
    color: var(--text-muted);
    font-size: 13px;
  }
</style>
