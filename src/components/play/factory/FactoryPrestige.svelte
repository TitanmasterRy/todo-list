<script lang="ts">
  // Orebelt prestige: relaunch a finished tower for stars, and spend them on permanent Star Charts perks.
  import { buyPerk, canBuyPerk, canRelaunch, launched, PERKS, relaunch, starsFor } from '../../../lib/factory/prestige';
  import { toasts } from '../../../lib/toast.svelte';
  import Burst from './Burst.svelte';
  import { fmt, type FactoryCtl } from './controller.svelte';

  interface Props {
    ctl: FactoryCtl;
  }
  let { ctl }: Props = $props();

  let confirming = $state(false);
  let burst = $state(0);

  const v = $derived.by(() => {
    void ctl.rev;
    const s = ctl.game;
    return {
      launched: launched(s),
      check: canRelaunch(s),
      offer: starsFor(s),
      stars: s.stars,
      runs: s.runs,
      made: s.madeTotal,
      perks: PERKS.map((p) => ({ p, owned: s.perks.includes(p.id), check: canBuyPerk(s, p.id) })),
    };
  });

  function doRelaunch() {
    confirming = false;
    let stars = 0;
    const ok = ctl.run(
      (s) => {
        const r = relaunch(s);
        stars = r.stars ?? 0;
        return r;
      },
      undefined,
      'launch',
    );
    if (!ok) return;
    // the old floor is gone: nothing to inspect or copy any more
    ctl.sel = null;
    ctl.copyFrom = null;
    ctl.tool = 'select';
    burst++;
    toasts.push({
      message: `Relaunched with +${stars} star${stars === 1 ? '' : 's'}`,
      detail: 'A fresh basin, your perks and stars kept. Spend them in Star Charts.',
      kind: 'levelup',
      emoji: '⭐',
    });
  }
</script>

<section class="card relaunch" aria-labelledby="ob-relaunch" data-relaunch>
  <Burst trigger={burst} kind="deliver" size={120} />
  <div class="head">
    <h3 id="ob-relaunch">Relaunch</h3>
    <span class="pill">Run {v.runs + 1}</span>
  </div>
  <p class="muted small">
    Start over with stars to spend on permanent perks. Two stars per Launch Tower phase delivered, plus a bonus for everything made this run. Stars, perks, achievements and records
    stay; the floor, stock and milestones go.
  </p>
  <div class="kpis">
    <div><span class="k">Stars on offer</span><strong data-stars-offer>{v.offer}</strong></div>
    <div><span class="k">Stars banked</span><strong>{v.stars}</strong></div>
    <div><span class="k">Relaunches</span><strong>{v.runs}</strong></div>
    <div><span class="k">Made this run</span><strong>{fmt(v.made)}</strong></div>
  </div>
  {#if confirming}
    <div class="confirm" role="group" aria-label="Confirm relaunch">
      <span class="small">Clear the whole floor and bank {v.offer} star{v.offer === 1 ? '' : 's'}?</span>
      <button class="btn primary" onclick={doRelaunch}>Confirm relaunch</button>
      <button class="btn" onclick={() => (confirming = false)}>Cancel</button>
    </div>
  {:else}
    <button class="btn" class:primary={v.launched} disabled={!v.check.ok} title={v.check.ok ? '' : v.check.error} onclick={() => (confirming = true)}>Relaunch</button>
    {#if !v.check.ok}<p class="muted small">{v.check.error}.</p>{/if}
  {/if}
</section>

<h3 class="sec" id="ob-perks">Star Charts</h3>
<p class="muted small">Perks bought with stars last for every run. You have <strong>{v.stars}</strong> star{v.stars === 1 ? '' : 's'}.</p>
<div class="grid" role="list" aria-labelledby="ob-perks">
  {#each v.perks as { p, owned, check } (p.id)}
    <article class="perk card" class:owned role="listitem" data-perk={p.id} data-owned={owned ? 'true' : 'false'}>
      <header>
        <strong>{p.name}</strong>
        <span class="cost">★ {p.cost}</span>
      </header>
      <p class="muted small">{p.desc}</p>
      {#if owned}
        <span class="ok">✓ Owned</span>
      {:else}
        <button class="btn" disabled={!check.ok} title={check.ok ? '' : check.error} onclick={() => ctl.run((s) => buyPerk(s, p.id), `${p.name} charted`, 'milestone')}>Buy</button>
      {/if}
    </article>
  {/each}
</div>

<style>
  .card {
    background: var(--f-panel);
    border: 1px solid var(--f-line);
    border-radius: 10px;
    padding: 12px;
  }
  .relaunch {
    position: relative;
    margin-top: 10px;
    display: grid;
    gap: 6px;
    border-color: #6d3f86;
    background: linear-gradient(180deg, #2a2233, var(--f-panel));
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }
  h3 {
    margin: 0;
    font-size: 17px;
  }
  .sec {
    margin: 18px 0 4px;
  }
  .muted {
    color: var(--f-muted);
  }
  .small {
    font-size: 12px;
  }
  p {
    margin: 0 0 6px;
  }
  .pill {
    font-size: 12px;
    font-weight: 700;
    padding: 2px 9px;
    border-radius: 999px;
    background: var(--f-panel2);
    border: 1px solid var(--f-line);
  }
  .kpis {
    display: flex;
    gap: 10px 18px;
    flex-wrap: wrap;
  }
  .kpis div {
    display: grid;
  }
  .k {
    font-size: 11px;
    color: var(--f-muted);
  }
  .kpis strong {
    font-size: 16px;
    font-variant-numeric: tabular-nums;
  }
  .confirm {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
    gap: 8px;
  }
  .perk {
    display: grid;
    gap: 6px;
    align-content: start;
  }
  .perk.owned {
    border-color: #8a6a12;
  }
  .perk header {
    display: flex;
    justify-content: space-between;
    gap: 6px;
    align-items: baseline;
  }
  .cost {
    font-weight: 700;
    color: var(--f-yellow);
    white-space: nowrap;
  }
  .ok {
    color: var(--f-yellow);
    font-size: 12px;
    font-weight: 700;
  }
  .btn {
    font-size: 13px;
    font-weight: 700;
    padding: 8px 12px;
    min-height: 38px;
    border-radius: 8px;
    border: 1px solid var(--f-line);
    background: var(--f-panel2);
    color: var(--f-text);
    justify-self: start;
  }
  .btn:disabled {
    opacity: 0.5;
  }
  .btn.primary {
    background: #b15fd6;
    border-color: #b15fd6;
    color: #1b1f24;
  }
</style>
