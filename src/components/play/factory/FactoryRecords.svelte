<script lang="ts">
  // Orebelt records: the achievement wall (each one earned pays a shard) and the lifetime numbers that survive a relaunch.
  import { ACH_SHARDS, ACHIEVEMENTS } from '../../../lib/factory/achievements';
  import { PHASES, type ItemId } from '../../../lib/factory/data';
  import FactoryIcon from './FactoryIcon.svelte';
  import { fmt, fmtTime, itemName, type FactoryCtl } from './controller.svelte';

  interface Props {
    ctl: FactoryCtl;
  }
  let { ctl }: Props = $props();

  const v = $derived.by(() => {
    void ctl.rev;
    const s = ctl.game;
    const earned = new Set(s.ach);
    return {
      list: ACHIEVEMENTS.map((a) => ({ a, earned: earned.has(a.id) })),
      earned: earned.size,
      top: (Object.entries(s.made) as [ItemId, number][]).sort((a, b) => b[1] - a[1]).slice(0, 8),
      allTime: Object.values(s.made).reduce((a, n) => a + n, 0),
      run: s.madeTotal,
      time: s.simTime,
      launches: s.lifetime.launches,
      relaunches: s.lifetime.relaunches,
      contracts: s.lifetime.contracts,
      runs: s.runs,
      stars: s.stars,
      perks: s.perks.length,
      phase: Math.min(s.phase, PHASES.length),
    };
  });
</script>

<section class="card" aria-labelledby="ob-ach">
  <div class="head">
    <h3 id="ob-ach">Achievements</h3>
    <span class="pill">{v.earned}/{v.list.length}</span>
  </div>
  <p class="muted small">Each one earned pays {ACH_SHARDS} overclock shard. They stay with you through a relaunch.</p>
  <div class="grid">
    {#each v.list as { a, earned } (a.id)}
      <article class="ach" class:earned data-achievement={a.id} data-earned={earned ? 'true' : 'false'}>
        <span class="em" aria-hidden="true">{a.emoji}</span>
        <div>
          <strong>{a.name}</strong>
          <p class="muted small">{a.desc}</p>
        </div>
        <span class="state">{earned ? 'Earned' : 'Locked'}</span>
      </article>
    {/each}
  </div>
</section>

<section class="card" aria-labelledby="ob-lifetime">
  <h3 id="ob-lifetime">Lifetime</h3>
  <div class="kpis">
    <div><span class="k">Made this run</span><strong data-made-total>{fmt(v.run)}</strong></div>
    <div><span class="k">Made all time</span><strong>{fmt(v.allTime)}</strong></div>
    <div><span class="k">Factory time</span><strong>{fmtTime(v.time)}</strong></div>
    <div><span class="k">Tower phases</span><strong>{v.phase}/{PHASES.length}</strong></div>
    <div><span class="k">Launches</span><strong>{v.launches}</strong></div>
    <div><span class="k">Relaunches</span><strong>{v.relaunches}</strong></div>
    <div><span class="k">Contracts filled</span><strong>{v.contracts}</strong></div>
    <div><span class="k">Run</span><strong>#{v.runs + 1}</strong></div>
    <div><span class="k">Stars banked</span><strong>{v.stars}</strong></div>
    <div><span class="k">Perks</span><strong>{v.perks}</strong></div>
  </div>
  {#if v.top.length}
    <h4>Most made, all time</h4>
    <ol class="top">
      {#each v.top as [k, n], i (k)}
        <li>
          <span class="rank">{i + 1}</span>
          <FactoryIcon item={k} size={16} />
          <span class="nm">{itemName(k)}</span>
          <span class="bar"><span style="width: {(n / v.top[0][1]) * 100}%"></span></span>
          <strong>{fmt(n)}</strong>
        </li>
      {/each}
    </ol>
  {:else}
    <p class="muted small">Nothing made yet: every item your machines ever produce is counted here, across every run.</p>
  {/if}
</section>

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
    align-items: center;
    gap: 8px;
  }
  h3 {
    margin: 0 0 4px;
    font-size: 15px;
  }
  h4 {
    margin: 10px 0 4px;
    font-size: 12px;
    color: var(--f-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .muted {
    color: var(--f-muted);
  }
  .small {
    font-size: 12px;
  }
  p {
    margin: 2px 0 6px;
  }
  .pill {
    font-size: 12px;
    font-weight: 700;
    padding: 2px 9px;
    border-radius: 999px;
    background: var(--f-panel2);
    border: 1px solid var(--f-line);
    font-variant-numeric: tabular-nums;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
    gap: 8px;
  }
  .ach {
    display: grid;
    grid-template-columns: 38px 1fr auto;
    gap: 8px;
    align-items: center;
    padding: 8px 10px;
    border-radius: 8px;
    background: linear-gradient(180deg, #2a3138, var(--f-panel2));
    border: 1px solid var(--f-line);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
  }
  .ach:not(.earned) {
    background: transparent;
    border-style: dashed;
    color: var(--f-muted);
  }
  .ach:not(.earned) .em {
    filter: grayscale(1);
    opacity: 0.45;
  }
  .ach.earned {
    border-color: #8a6a12;
  }
  .em {
    font-size: 26px;
    text-align: center;
    line-height: 1;
  }
  .ach p {
    margin: 1px 0 0;
  }
  .state {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--f-muted);
  }
  .earned .state {
    color: var(--f-yellow);
  }
  .kpis {
    display: flex;
    gap: 14px 18px;
    flex-wrap: wrap;
    margin: 6px 0 4px;
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
  .top {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 4px;
    font-size: 12.5px;
    font-variant-numeric: tabular-nums;
  }
  .top li {
    display: grid;
    grid-template-columns: 18px 18px minmax(90px, 1fr) minmax(40px, 2fr) auto;
    gap: 6px;
    align-items: center;
  }
  .rank {
    color: var(--f-muted);
    font-size: 11px;
  }
  .nm {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .bar {
    height: 6px;
    border-radius: 3px;
    background: var(--f-panel2);
    overflow: hidden;
  }
  .bar span {
    display: block;
    height: 100%;
    background: linear-gradient(90deg, var(--f-teal), var(--f-orange));
  }
</style>
