<script lang="ts">
  // Orebelt daily contracts: three delivery orders a day, counted from what reaches your stock, paid in shards or insight.
  import { canClaim, claimContract, contractProgress, contractsFor, isClaimed, type Contract } from '../../../lib/factory/contracts';
  import { store } from '../../../lib/store.svelte';
  import Burst from './Burst.svelte';
  import FactoryIcon from './FactoryIcon.svelte';
  import { fmt, itemName, type FactoryCtl } from './controller.svelte';

  interface Props {
    ctl: FactoryCtl;
  }
  let { ctl }: Props = $props();

  let burst = $state<{ id: string; n: number }>({ id: '', n: 0 });

  const v = $derived.by(() => {
    void ctl.rev;
    const s = ctl.game;
    const day = store.today;
    // the ledger rolls over on the next tick; until then yesterday's progress must not show
    const fresh = s.contracts.day === day;
    return {
      list: contractsFor(day, s.phase).map((c) => ({
        c,
        done: fresh ? contractProgress(s, c) : 0,
        claimed: fresh && isClaimed(s, c),
        can: fresh && canClaim(s, c),
        stock: s.inv[c.item] ?? 0,
      })),
    };
  });

  const rewardText = (c: Contract) => (c.reward.shards ? `+${c.reward.shards} overclock shard${c.reward.shards === 1 ? '' : 's'}` : `+${c.reward.insight ?? 0} insight`);

  function claim(c: Contract) {
    const ok = ctl.run(
      (s) => {
        const r = claimContract(s, c, store.today);
        return r.ok ? { ok: true } : { ok: false, error: r.error ?? "Can't claim that yet" };
      },
      `Contract paid: ${rewardText(c)}`,
      'coin',
    );
    if (ok) burst = { id: c.id, n: burst.n + 1 };
  }
</script>

<section class="card" aria-labelledby="ob-contracts">
  <div class="head">
    <h3 id="ob-contracts">Contracts</h3>
    <span class="muted small">New orders every day</span>
  </div>
  <p class="muted small">Deliver these to the Base Camp or a depot today (belts into stock count). Rewards are shards or insight, never coins.</p>
  <div class="grid">
    {#each v.list as { c, done, claimed, can, stock } (c.id)}
      <article class="ct" class:claimed class:ready={can} data-contract={c.id}>
        {#if burst.id === c.id}<Burst trigger={burst.n} kind="deliver" size={60} />{/if}
        <header>
          <FactoryIcon item={c.item} size={28} />
          <div class="nm">
            <strong>{itemName(c.item)}</strong>
            <span class="muted small">{fmt(stock)} in stock</span>
          </div>
          <span class="prog" data-contract-progress>{fmt(done)} / {c.qty}</span>
        </header>
        <div class="bar" role="progressbar" aria-label="{itemName(c.item)} delivered" aria-valuemin="0" aria-valuemax={c.qty} aria-valuenow={done}>
          <span style="width: {Math.min(100, (done / c.qty) * 100)}%"></span>
        </div>
        <div class="foot">
          <span class="reward">{rewardText(c)}</span>
          {#if claimed}
            <span class="ok">✓ Paid</span>
          {:else}
            <button class="btn" class:primary={can} disabled={!can} onclick={() => claim(c)}>Claim</button>
          {/if}
        </div>
      </article>
    {/each}
  </div>
</section>

<style>
  .card {
    position: relative;
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
    margin: 4px 0 8px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 8px;
  }
  .ct {
    position: relative;
    display: grid;
    gap: 6px;
    padding: 10px;
    border-radius: 8px;
    background: linear-gradient(180deg, #2a3138, var(--f-panel2));
    border: 1px solid var(--f-line);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
  }
  .ct.ready {
    border-color: var(--f-yellow);
  }
  .ct.claimed {
    border-color: #2c7a3a;
    opacity: 0.8;
  }
  .ct header {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .nm {
    flex: 1;
    display: grid;
    min-width: 0;
  }
  .prog {
    font-variant-numeric: tabular-nums;
    font-weight: 700;
    font-size: 13px;
  }
  .bar {
    height: 7px;
    border-radius: 4px;
    background: var(--f-panel);
    overflow: hidden;
  }
  .bar span {
    display: block;
    height: 100%;
    background: repeating-linear-gradient(-45deg, #e0701a 0 6px, #f2b632 6px 12px);
    transition: width 0.4s;
  }
  .foot {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }
  .reward {
    font-size: 12px;
    color: #7ee0ea;
  }
  .ok {
    color: #3fb950;
    font-size: 12px;
    font-weight: 700;
  }
  .btn {
    font-size: 13px;
    font-weight: 700;
    padding: 6px 12px;
    min-height: 34px;
    border-radius: 8px;
    border: 1px solid var(--f-line);
    background: var(--f-panel);
    color: var(--f-text);
  }
  .btn:disabled {
    opacity: 0.5;
  }
  .btn.primary {
    background: var(--f-orange);
    border-color: var(--f-orange);
    color: #1b1f24;
  }
</style>
