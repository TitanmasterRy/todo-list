<script lang="ts">
  import { economy } from '../../lib/economy.svelte';
  import { store } from '../../lib/store.svelte';
  import { lifetimeEarned, reasonLabel } from '../../lib/economy';

  let limit = $state(50);
  const rows = $derived(
    store.ledger
      .slice(-limit)
      .reverse()
      .filter((e) => !e.currency.startsWith('item:') || e.reason.startsWith('shop:')),
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
    color: var(--success);
    font-weight: 700;
  }
  .muted {
    color: var(--text-muted);
    font-size: 13px;
  }
</style>
