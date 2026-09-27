<script lang="ts">
  import { economy } from '../../lib/economy.svelte';
  import { store } from '../../lib/store.svelte';
  import { cashedOutOn, cashoutQuote, CASHOUT_DAILY_MAX, CASHOUT_RATE, lifetimeEarned, reasonLabel } from '../../lib/economy';
  import { toasts } from '../../lib/toast.svelte';

  // cash chips back into coins: half what they cost, up to CASHOUT_DAILY_MAX coins a day
  let cashChips = $state(CASHOUT_RATE * 10);
  const quote = $derived(cashoutQuote(store.ledger, cashChips, store.today));
  const cashedToday = $derived(cashedOutOn(store.ledger, store.today));
  function cashOut() {
    const got = economy.cashOut(cashChips);
    if (got) toasts.push({ message: `Cashed out ${(got * CASHOUT_RATE).toLocaleString()} chips for ${got} coins`, kind: 'success', emoji: '🪙' });
  }

  let limit = $state(50);
  const rows = $derived(
    store.ledger
      .slice(-limit)
      .reverse()
      .filter((e) => !e.currency.startsWith('item:') || e.reason.startsWith('shop:') || e.reason.startsWith('gift:')),
  );
  const EMOJI: Record<string, string> = { coins: '🪙', chips: '🎰', vouchers: '🎟️' };
  const earnedToday = $derived(
    store.ledger
      .filter((e) => e.currency === 'coins' && e.amount > 0 && !e.reason.startsWith('shop:') && e.at.slice(0, 10) === new Date().toISOString().slice(0, 10))
      .reduce((a, e) => a + e.amount, 0),
  );
</script>

<div class="summary">
  <div class="card stat">
    <div class="n">{lifetimeEarned(store.ledger).toLocaleString()}</div>
    <div class="l">coins earned, all time</div>
  </div>
  <div class="card stat">
    <div class="n">{earnedToday.toLocaleString()}</div>
    <div class="l">coins earned today</div>
  </div>
  <div class="card stat">
    <div class="n">{Object.keys(economy.wallet.items).length}</div>
    <div class="l">items owned</div>
  </div>
</div>

<section class="card cash">
  <h2 class="sec">🎰 → 🪙 Cash out chips</h2>
  <p class="muted">
    {CASHOUT_RATE} chips = 1 coin (half what chips cost), up to {CASHOUT_DAILY_MAX} coins a day. You have {economy.wallet.chips.toLocaleString()} chips; {cashedToday} of today's
    {CASHOUT_DAILY_MAX} coins used.
  </p>
  <div class="row">
    <label
      >Chips <input
        class="input num"
        type="number"
        min={CASHOUT_RATE}
        step={CASHOUT_RATE}
        max={economy.wallet.chips}
        bind:value={cashChips}
        aria-label="Chips to cash out"
      /></label
    >
    <button class="btn ghost sm" onclick={() => (cashChips = Math.min(economy.wallet.chips, quote.leftToday * CASHOUT_RATE))}>Max</button>
    <span class="grow"></span>
    <button class="btn primary sm" onclick={cashOut} disabled={quote.coins <= 0}>Get {quote.coins} 🪙</button>
  </div>
  {#if quote.leftToday <= 0}<p class="muted">Today's limit is used up. More tomorrow.</p>{/if}
</section>

<h2 class="sec">History</h2>
{#if !rows.length}
  <p class="muted">Nothing yet. Finish a task to earn your first coins.</p>
{:else}
  <ul class="hist">
    {#each rows as e (e.id)}
      <li>
        <span class="when">{new Date(e.at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
        <span class="what">{reasonLabel(e)}</span>
        <span class="amt" class:pos={e.amount > 0}>{e.amount > 0 ? '+' : ''}{e.amount.toLocaleString()} {EMOJI[e.currency] ?? '📦'}</span>
      </li>
    {/each}
  </ul>
  {#if store.ledger.length > limit}<button class="btn ghost sm" onclick={() => (limit += 100)}>Show more</button>{/if}
{/if}

<style>
  .cash {
    margin: 12px 0;
    padding: 12px;
  }
  .cash .row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }
  .cash label {
    display: flex;
    gap: 6px;
    align-items: center;
    font-size: 13px;
    color: var(--text-muted);
  }
  .num {
    width: 110px;
  }
  .grow {
    flex: 1;
  }
  .summary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 8px;
  }
  .stat {
    padding: 12px;
  }
  .n {
    font-size: 22px;
    font-weight: 800;
  }
  .l {
    font-size: 12px;
    color: var(--text-muted);
  }
  .sec {
    font-size: 15px;
    margin: 18px 0 8px;
  }
  .hist {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .hist li {
    display: grid;
    grid-template-columns: 120px 1fr auto;
    gap: 10px;
    padding: 6px 0;
    border-top: 1px solid var(--border);
    font-size: 13px;
  }
  .when {
    color: var(--text-muted);
  }
  .amt {
    font-variant-numeric: tabular-nums;
    color: var(--text-muted);
  }
  .amt.pos {
    color: var(--success-text);
    font-weight: 700;
  }
  .muted {
    color: var(--text-muted);
    font-size: 13px;
  }
</style>
