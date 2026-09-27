<script lang="ts">
  // Orebelt trade: spend homework coins on supply drops (confirmed first, limited per day), and sell spare late-game
  // parts at the market for a few coins (capped per day). Hidden entirely when the app's coin economy is off.
  import { economy } from '../../../lib/economy.svelte';
  import { store } from '../../../lib/store.svelte';
  import { toasts } from '../../../lib/toast.svelte';
  import { ITEMS, MARKET_DAILY_CAP, type ItemId } from '../../../lib/factory/data';
  import { roomToday, sellQuote } from '../../../lib/factory/market';
  import { applyOffer, boughtToday, canBuyOffer, COIN_SHOP, crateFor, ledgerReason, OFFER, type OfferId } from '../../../lib/factory/shop';
  import FactoryIcon from './FactoryIcon.svelte';
  import { fmt, itemName, type FactoryCtl } from './controller.svelte';

  interface Props {
    ctl: FactoryCtl;
  }
  let { ctl }: Props = $props();

  let confirming = $state<OfferId | null>(null);
  let sellQty = $state<Partial<Record<ItemId, number>>>({});

  const v = $derived.by(() => {
    void ctl.rev;
    const s = ctl.game;
    const day = store.today;
    const coins = economy.wallet.coins;
    const offers = COIN_SHOP.map((o) => {
      const bought = boughtToday(store.ledger, o.id, day);
      return { o, bought, check: canBuyOffer(s, o.id, coins, bought) };
    });
    const room = roomToday(store.ledger, day);
    const sellable = ITEMS.filter((i) => (i.value ?? 0) > 0 && (s.inv[i.id] ?? 0) >= 1).map((i) => ({ i, have: Math.floor(s.inv[i.id] ?? 0) }));
    return { coins, offers, room, sellable, day, crate: crateFor(s.phase), credit: s.credit };
  });

  function buy(id: OfferId) {
    const o = OFFER[id];
    // re-check right before spending: the wallet or the limits may have changed
    const bought = boughtToday(store.ledger, id, store.today);
    if (!economy.enabled || economy.wallet.coins < o.price || !canBuyOffer(ctl.game, id, economy.wallet.coins, bought).ok) {
      confirming = null;
      return ctl.say("Can't buy that right now", true);
    }
    store.addLedger([{ currency: 'coins', amount: -o.price, reason: ledgerReason(id), ref: store.today }]);
    let line = '';
    ctl.run((s) => {
      line = applyOffer(s, id);
    });
    confirming = null;
    toasts.push({ message: o.name, detail: line, kind: 'success', emoji: '📦' });
  }

  function sell(item: ItemId, qty: number) {
    const s = ctl.game;
    const q = sellQuote(item, s.inv[item] ?? 0, qty, s.credit, roomToday(store.ledger, store.today));
    if (q.qty <= 0) return ctl.say(v.room <= 0 ? "The market is closed for today: you've hit the daily coin cap" : 'Nothing sold', true);
    ctl.run(
      (g) => {
        g.inv[item] = Math.max(0, (g.inv[item] ?? 0) - q.qty);
        g.credit = q.credit;
      },
      `Sold ${q.qty} ${itemName(item)}${q.coins ? ` for ${q.coins} coin${q.coins === 1 ? '' : 's'}` : ''}`,
    );
    if (q.coins > 0) economy.earn(q.coins, 'factory', `${store.today}:${Date.now()}`);
  }
</script>

{#if economy.enabled}
  <section class="card" aria-labelledby="ob-shop">
    <div class="head">
      <h3 id="ob-shop">Supply drops</h3>
      <span class="wallet" data-wallet>🪙 <strong>{v.coins.toLocaleString()}</strong> coins</span>
    </div>
    <p class="muted small">Spend coins you earned from homework. Each drop has a daily limit, so the factory still grows by playing.</p>
    <div class="grid">
      {#each v.offers as { o, bought, check } (o.id)}
        <article class="offer" data-offer={o.id}>
          <header><strong>{o.name}</strong><span class="price">🪙 {o.price}</span></header>
          <p class="small">{o.desc}</p>
          {#if o.id === 'crate'}
            <p class="small muted">
              Now: {Object.entries(v.crate)
                .map(([k, n]) => `${n} ${itemName(k as ItemId)}`)
                .join(', ')}
            </p>
          {/if}
          <p class="small muted">Today: {bought}/{o.perDay}</p>
          {#if confirming === o.id}
            <div class="confirm" role="group" aria-label="Confirm purchase">
              <span class="small">Spend {o.price} of your {v.coins.toLocaleString()} coins?</span>
              <button class="btn primary" onclick={() => buy(o.id)}>Confirm</button>
              <button class="btn" onclick={() => (confirming = null)}>Cancel</button>
            </div>
          {:else}
            <button class="btn" disabled={!check.ok} onclick={() => (confirming = o.id)}>{check.ok ? `Buy for ${o.price}` : check.error}</button>
          {/if}
        </article>
      {/each}
    </div>
  </section>

  <section class="card" aria-labelledby="ob-market">
    <div class="head">
      <h3 id="ob-market">Market</h3>
      <span class="small muted">Paid today: {MARKET_DAILY_CAP - v.room}/{MARKET_DAILY_CAP} coins</span>
    </div>
    <p class="muted small">Sell spare parts from tier 2 up. Payouts are capped at {MARKET_DAILY_CAP} coins a day: homework is still the way to earn.</p>
    {#if v.sellable.length}
      <ul class="sell">
        {#each v.sellable as { i, have } (i.id)}
          {@const q = sellQty[i.id] ?? Math.min(have, 10)}
          <li>
            <FactoryIcon item={i.id} size={22} />
            <span class="nm">{i.name}<span class="muted small"> · {fmt(have)} · {i.value} coin{i.value === 1 ? '' : 's'} each</span></span>
            <label class="sr" for="ob-q-{i.id}">How many {i.name} to sell</label>
            <input
              id="ob-q-{i.id}"
              type="number"
              min="1"
              max={have}
              value={q}
              oninput={(e) => (sellQty[i.id] = Math.max(1, Number((e.currentTarget as HTMLInputElement).value) || 1))}
            />
            <button class="btn" disabled={v.room <= 0 && v.credit + q * (i.value ?? 0) >= 1} onclick={() => sell(i.id, q)}>Sell</button>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="muted small">Nothing to sell yet: reinforced plates and later parts can be sold.</p>
    {/if}
  </section>
{:else}
  <section class="card">
    <p class="muted">The coin economy is switched off in Settings, so supply drops and the market are hidden.</p>
  </section>
{/if}

<style>
  .card {
    background: var(--f-panel);
    border: 1px solid var(--f-line);
    border-radius: 10px;
    padding: 12px;
    margin-bottom: 10px;
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
    flex-wrap: wrap;
  }
  h3 {
    margin: 0;
    font-size: 15px;
  }
  .muted {
    color: var(--f-muted);
  }
  .small {
    font-size: 12px;
  }
  p {
    margin: 4px 0;
  }
  .wallet {
    background: var(--f-panel2);
    border-radius: 999px;
    padding: 3px 10px;
    font-size: 13px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
    gap: 8px;
    margin-top: 8px;
  }
  .offer {
    background: var(--f-panel2);
    border: 1px solid var(--f-line);
    border-radius: 8px;
    padding: 10px;
    display: grid;
    gap: 4px;
    align-content: start;
  }
  .offer header {
    display: flex;
    justify-content: space-between;
    gap: 6px;
  }
  .price {
    font-weight: 700;
    color: var(--f-yellow);
  }
  .confirm {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }
  .btn {
    font-size: 13px;
    font-weight: 600;
    padding: 7px 12px;
    min-height: 36px;
    border-radius: 8px;
    border: 1px solid var(--f-line);
    background: var(--f-panel);
    color: var(--f-text);
    justify-self: start;
  }
  .btn:disabled {
    opacity: 0.5;
  }
  .btn.primary {
    background: var(--f-orange);
    border-color: var(--f-orange);
    color: #1b1f24;
  }
  .sell {
    list-style: none;
    margin: 8px 0 0;
    padding: 0;
    display: grid;
    gap: 6px;
  }
  .sell li {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .nm {
    flex: 1;
    min-width: 140px;
    font-size: 13px;
  }
  input[type='number'] {
    width: 72px;
    background: var(--f-panel2);
    color: var(--f-text);
    border: 1px solid var(--f-line);
    border-radius: 8px;
    padding: 6px;
    min-height: 36px;
  }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
</style>
