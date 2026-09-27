<script lang="ts">
  // Admin → Economy: grant or take coins, chips and vouchers, give shop items, set XP and streaks, undo ledger entries.
  // Every change is a ledger entry with reason "admin" (entries are never edited), so it syncs and can be undone.
  import { store } from '../../lib/store.svelte';
  import { economy } from '../../lib/economy.svelte';
  import { SHOP, owned } from '../../lib/economy';
  import { adjustEntries, reversal } from '../../lib/admin';
  import { levelForXp, MAX_FREEZES } from '../../lib/gamification';
  import { toasts } from '../../lib/toast.svelte';
  import type { Currency, LedgerEntry } from '../../lib/types';

  let currency = $state<Currency>('coins');
  let amount = $state(100);
  let note = $state('');
  let itemId = $state(SHOP.find((i) => i.unique)?.id ?? '');
  let xp = $state(store.stats.xp);
  let streak = $state(store.stats.streak.current);
  let best = $state(store.stats.streak.best);
  let freezes = $state(store.stats.streak.freezes);
  let filter = $state('');

  const EMOJI: Record<Currency, string> = { coins: '🪙', chips: '🎰', vouchers: '🎟️' };
  const items = SHOP.filter((i) => i.unique);

  function adjust(sign: 1 | -1) {
    const n = Math.abs(Math.trunc(amount)) * sign;
    if (!n) return;
    store.addLedger(adjustEntries(currency, n, note));
    toasts.push({ message: `${n > 0 ? 'Gave' : 'Took'} ${Math.abs(n).toLocaleString()} ${EMOJI[currency]}`, kind: 'success' });
    note = '';
  }

  function giveItem() {
    const item = SHOP.find((i) => i.id === itemId);
    if (!item) return;
    if (owned(store.ledger, item.id) > 0) {
      toasts.push({ message: `Already owned: ${item.name}`, kind: 'info' });
      return;
    }
    store.addLedger(adjustEntries(`item:${item.id}`, 1, 'gift'));
    toasts.push({ message: `Gave ${item.emoji} ${item.name}`, kind: 'success' });
  }

  function unlockAll() {
    const missing = items.filter((i) => owned(store.ledger, i.id) <= 0);
    if (!missing.length) return;
    store.addLedger(missing.flatMap((i) => adjustEntries(`item:${i.id}`, 1, 'unlock all')));
    toasts.push({ message: `Unlocked ${missing.length} items`, kind: 'success', emoji: '🎁' });
  }

  function saveStats() {
    const x = Math.max(0, Math.trunc(xp) || 0);
    const cur = Math.max(0, Math.trunc(streak) || 0);
    store.stats = {
      ...store.stats,
      xp: x,
      level: levelForXp(x),
      streak: {
        ...store.stats.streak,
        current: cur,
        best: Math.max(cur, Math.trunc(best) || 0),
        lastDate: cur ? store.today : store.stats.streak.lastDate,
        freezes: Math.max(0, Math.min(MAX_FREEZES, Math.trunc(freezes) || 0)),
      },
    };
    store.persistStats();
    toasts.push({ message: 'Stats saved', detail: 'When devices sync, the copy with more XP wins, so lowering XP may be undone by the next sync.', kind: 'success' });
  }

  function undo(e: LedgerEntry) {
    if (!confirm(`Reverse this entry (${e.amount > 0 ? '+' : ''}${e.amount} ${e.currency}, ${e.reason})?`)) return;
    store.addLedger([reversal(e)]);
  }

  const recent = $derived(
    store.ledger
      .filter((e) => !filter || `${e.reason} ${e.ref ?? ''} ${e.currency}`.toLowerCase().includes(filter.toLowerCase()))
      .slice(-150)
      .reverse(),
  );
</script>

<section class="card">
  <h3>Wallet</h3>
  <p class="big">🪙 {economy.wallet.coins.toLocaleString()} · 🎰 {economy.wallet.chips.toLocaleString()} · 🎟️ {economy.wallet.vouchers.toLocaleString()}</p>
  {#if !economy.enabled}<p class="muted">The economy is turned off in Settings, so the app hides these. You can still adjust them.</p>{/if}
  <div class="row">
    <select class="select" bind:value={currency} aria-label="Currency">
      <option value="coins">🪙 Coins</option>
      <option value="chips">🎰 Chips</option>
      <option value="vouchers">🎟️ Vouchers</option>
    </select>
    <input class="input num" type="number" min="1" max="1000000" bind:value={amount} aria-label="Amount" />
    <input class="input grow" bind:value={note} placeholder="Note (optional)" aria-label="Note" />
    <button class="btn primary sm" onclick={() => adjust(1)}>Give</button>
    <button class="btn sm" onclick={() => adjust(-1)}>Take</button>
  </div>
  <div class="row">
    <select class="select grow" bind:value={itemId} aria-label="Shop item">
      {#each items as i (i.id)}<option value={i.id}>{i.emoji} {i.name}{owned(store.ledger, i.id) > 0 ? ' (owned)' : ''}</option>{/each}
    </select>
    <button class="btn sm" onclick={giveItem}>Give item</button>
    <button class="btn sm" onclick={unlockAll}>Unlock every item</button>
  </div>
</section>

<section class="card">
  <h3>Level and streak</h3>
  <div class="row">
    <label>XP <input class="input num" type="number" min="0" bind:value={xp} /></label>
    <span class="muted">→ level {levelForXp(Math.max(0, xp || 0))}</span>
    <label>Streak <input class="input num" type="number" min="0" bind:value={streak} /></label>
    <label>Best <input class="input num" type="number" min="0" bind:value={best} /></label>
    <label>Freezes <input class="input num" type="number" min="0" max={MAX_FREEZES} bind:value={freezes} /></label>
    <button class="btn sm primary" onclick={saveStats}>Save</button>
  </div>
</section>

<section class="card">
  <h3>Ledger <span class="muted">({store.ledger.length} entries, newest first)</span></h3>
  <input class="input" bind:value={filter} placeholder="Filter by reason, game, currency…" aria-label="Filter ledger" />
  <table>
    <thead><tr><th>When</th><th>Amount</th><th>Reason</th><th>Ref</th><th></th></tr></thead>
    <tbody>
      {#each recent as e (e.id)}
        <tr>
          <td class="nowrap">{new Date(e.at).toLocaleString()}</td>
          <td class="nowrap" class:neg={e.amount < 0}>{e.amount > 0 ? '+' : ''}{e.amount} {e.currency in EMOJI ? EMOJI[e.currency as Currency] : e.currency}</td>
          <td>{e.reason}</td>
          <td class="ref">{e.ref ?? ''}</td>
          <td><button class="btn ghost sm" onclick={() => undo(e)}>Undo</button></td>
        </tr>
      {/each}
    </tbody>
  </table>
</section>

<style>
  section {
    margin-bottom: 12px;
  }
  h3 {
    margin: 0 0 8px;
    font-size: 15px;
  }
  .big {
    font-size: 18px;
    margin: 4px 0 8px;
  }
  .muted {
    color: var(--text-muted);
    font-size: 13px;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin: 8px 0;
    font-size: 13px;
  }
  .row label {
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--text-muted);
  }
  .row .select {
    width: auto;
  }
  .grow {
    flex: 1;
    min-width: 140px;
  }
  .num {
    width: 96px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
    margin-top: 8px;
  }
  th {
    text-align: left;
    font-weight: 500;
    color: var(--text-muted);
    padding: 4px;
  }
  td {
    padding: 3px 4px;
    border-top: 1px solid var(--border);
  }
  .nowrap {
    white-space: nowrap;
  }
  .neg {
    color: var(--danger-text);
  }
  .ref {
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
