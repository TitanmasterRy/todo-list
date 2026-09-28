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

<div class="summary stagger">
  <div class="card stat lift gold">
    <span class="orb" aria-hidden="true">🪙</span>
    {#key lifetimeEarned(store.ledger)}<div class="n gold-text bump">{lifetimeEarned(store.ledger).toLocaleString()}</div>{/key}
    <div class="l">coins earned, all time</div>
  </div>
  <div class="card stat lift">
    <span class="orb" aria-hidden="true">✨</span>
    {#key earnedToday}<div class="n grad-text bump">{earnedToday.toLocaleString()}</div>{/key}
    <div class="l">coins earned today</div>
  </div>
  <div class="card stat lift">
    <span class="orb" aria-hidden="true">🎒</span>
    {#key Object.keys(economy.wallet.items).length}<div class="n grad-text bump">{Object.keys(economy.wallet.items).length}</div>{/key}
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
        <span class="amt" class:pos={e.amount > 0} class:neg={e.amount < 0}>{e.amount > 0 ? '+' : ''}{e.amount.toLocaleString()} {EMOJI[e.currency] ?? '📦'}</span>
      </li>
    {/each}
  </ul>
  {#if store.ledger.length > limit}<button class="btn ghost sm" onclick={() => (limit += 100)}>Show more</button>{/if}
{/if}

<style>
  /* ---- cash-out card with a gold accent ---- */
  .cash {
    position: relative;
    margin: 12px 0;
    padding: 14px;
    overflow: hidden;
    border-color: color-mix(in srgb, var(--gold) 40%, var(--border));
    background: radial-gradient(60% 100% at 0% 0%, color-mix(in srgb, var(--gold) 12%, transparent), transparent 60%), var(--bg-elev);
    box-shadow:
      inset 0 1px 0 var(--sheen),
      var(--shadow-sm),
      0 0 30px -12px color-mix(in srgb, var(--gold) 50%, transparent);
  }
  .cash::before {
    content: '';
    position: absolute;
    inset: 0 auto 0 0;
    width: 4px;
    background: var(--grad-gold);
    box-shadow: 0 0 10px color-mix(in srgb, var(--gold) 60%, transparent);
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
    font-variant-numeric: tabular-nums;
  }
  .grow {
    flex: 1;
  }
  /* ---- glossy stat tiles with big gradient numbers ---- */
  .summary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 8px;
  }
  .stat {
    position: relative;
    padding: 14px 14px 12px;
    overflow: hidden;
    background: radial-gradient(70% 70% at 100% 0%, color-mix(in srgb, var(--accent) 14%, transparent), transparent 70%), var(--bg-elev);
  }
  .stat.gold {
    border-color: color-mix(in srgb, var(--gold) 45%, var(--border));
    background: radial-gradient(70% 70% at 100% 0%, color-mix(in srgb, var(--gold) 18%, transparent), transparent 70%), var(--bg-elev);
  }
  .stat.gold:hover {
    border-color: color-mix(in srgb, var(--gold) 70%, var(--border));
    box-shadow:
      inset 0 1px 0 var(--sheen),
      var(--shadow),
      0 0 24px -6px color-mix(in srgb, var(--gold) 60%, transparent);
  }
  .orb {
    position: absolute;
    top: 8px;
    right: 10px;
    font-size: 26px;
    opacity: 0.9;
    filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3));
    transition: transform var(--dur-slow) var(--spring);
  }
  :global([dir='rtl']) .orb {
    right: auto;
    left: 10px;
  }
  .stat:hover .orb {
    transform: scale(1.2) rotate(-10deg);
  }
  .n {
    font-size: 30px;
    font-weight: 900;
    letter-spacing: -0.02em;
    line-height: 1.1;
    font-variant-numeric: tabular-nums;
    padding-inline-end: 36px;
  }
  .l {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted);
    margin-top: 2px;
  }
  .sec {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 15px;
    margin: 18px 0 8px;
  }
  .sec::before {
    content: '';
    width: 4px;
    height: 16px;
    border-radius: 2px;
    background: var(--grad-accent);
    box-shadow: 0 0 8px color-mix(in srgb, var(--accent) 50%, transparent);
    flex-shrink: 0;
  }
  .cash .sec {
    margin: 0 0 6px;
  }
  .cash .sec::before {
    background: var(--grad-gold);
    box-shadow: 0 0 8px color-mix(in srgb, var(--gold) 60%, transparent);
  }
  /* ---- history: colored amounts, soft row hover ---- */
  .hist {
    list-style: none;
    margin: 0;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--bg-elev);
    box-shadow:
      inset 0 1px 0 var(--sheen),
      var(--shadow-sm);
    overflow: hidden;
  }
  .hist li {
    display: grid;
    grid-template-columns: 120px 1fr auto;
    gap: 10px;
    align-items: center;
    padding: 8px 12px;
    font-size: 13px;
    transition:
      background var(--dur),
      transform var(--dur) var(--spring);
  }
  .hist li + li {
    border-top: 1px solid var(--border);
  }
  .hist li:hover {
    background: color-mix(in srgb, var(--accent) 6%, var(--bg-elev-2));
  }
  .hist li:hover .amt {
    transform: scale(1.08);
  }
  .when {
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
  }
  .amt {
    display: inline-block;
    font-variant-numeric: tabular-nums;
    color: var(--text-muted);
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 999px;
    transition: transform var(--dur) var(--spring);
  }
  .amt.pos {
    color: var(--success-text);
    font-weight: 800;
    background: color-mix(in srgb, var(--success) 12%, transparent);
  }
  .amt.neg {
    color: var(--danger-text);
    font-weight: 700;
    background: color-mix(in srgb, var(--danger) 10%, transparent);
  }
  .muted {
    color: var(--text-muted);
    font-size: 13px;
  }
  @media (max-width: 520px) {
    .hist li {
      grid-template-columns: 1fr auto;
    }
    .when {
      grid-column: 1 / -1;
      font-size: 11px;
    }
  }
</style>
