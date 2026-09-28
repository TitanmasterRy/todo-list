<script lang="ts">
  // Orebelt production stats: power over the last two minutes, bottlenecks, items per minute with ten-minute
  // sparklines, lifetime totals, the workbench and how homework powers the factory.
  import { BUILDING, CAMP_POWER, ITEMS, RECIPES, REWARD, type ItemId } from '../../../lib/factory/data';
  import { benchCraft } from '../../../lib/factory/actions';
  import { has, unlocked } from '../../../lib/factory/state';
  import type { Status } from '../../../lib/factory/sim';
  import FactoryIcon from './FactoryIcon.svelte';
  import { fmt, fmtRate, fmtTime, itemName, SERIES_LEN, SERIES_STEP, type FactoryCtl } from './controller.svelte';

  interface Props {
    ctl: FactoryCtl;
  }
  let { ctl }: Props = $props();

  const W = 320;
  const H = 120;
  const PAD = { l: 34, r: 8, t: 8, b: 18 };
  let hover = $state<number | null>(null);

  const STATUS: Record<Status, string> = {
    ok: 'Running',
    starved: 'Input starved',
    blocked: 'Output blocked',
    power: 'Low power',
    off: 'Paused',
    idle: 'No recipe',
    nofuel: 'No fuel',
  };
  /** Worst first: what stops production outright, then what slows it, then what the player chose. */
  const STATUS_ORDER: Status[] = ['starved', 'blocked', 'power', 'nofuel', 'idle', 'off'];
  const SPARK_W = 72;
  const SPARK_H = 18;

  const v = $derived.by(() => {
    void ctl.rev;
    const s = ctl.game;
    const u = unlocked(s);
    const rows = ITEMS.filter((i) => (s.inv[i.id] ?? 0) >= 0.5 || (ctl.rates.made[i.id] ?? 0) > 0.05 || (ctl.rates.used[i.id] ?? 0) > 0.05).map((i) => ({
      id: i.id,
      stock: s.inv[i.id] ?? 0,
      made: ctl.rates.made[i.id] ?? 0,
      used: ctl.rates.used[i.id] ?? 0,
      stocked: ctl.rates.stocked[i.id] ?? 0,
      spark: sparkline(ctl.series.made[i.id]),
    }));
    const bench = RECIPES.filter((r) => (r.building === 'smelter' || r.building === 'constructor') && u.recipes.has(r.id)).map((r) => ({ r, can: has(s.inv, r.in) }));
    const p = ctl.report?.power;
    // bottlenecks: every machine that isn't simply running, grouped by what's wrong
    const groups = STATUS_ORDER.map((st) => ({
      st,
      name: STATUS[st],
      items: s.buildings.filter((b) => (b.off ? 'off' : ctl.report?.buildings[b.id]?.st) === st).map((b) => ({ id: b.id, name: BUILDING[b.type].name, x: b.x, y: b.y })),
    })).filter((g) => g.items.length);
    const stuck = groups.reduce((a, g) => a + g.items.length, 0);
    const lifetime = {
      top: (Object.entries(s.made) as [ItemId, number][]).sort((a, b) => b[1] - a[1]).slice(0, 10),
      time: s.simTime,
      buildings: s.buildings.length - 1,
      belts: s.belts.length,
    };
    return { rows, bench, power: p, s, groups, stuck, lifetime, samples: ctl.series.len };
  });

  /** A tiny polyline of the last ten minutes, scaled to its own peak so shape matters more than size. */
  function sparkline(vals: number[] | undefined): { d: string; peak: number } | null {
    if (!vals || vals.length < 2) return null;
    const peak = Math.max(...vals);
    if (peak <= 0.01) return null;
    const n = SERIES_LEN - 1;
    const x = (i: number) => (((i + (SERIES_LEN - vals.length)) / n) * SPARK_W).toFixed(1);
    const y = (v: number) => (SPARK_H - 1.5 - (v / peak) * (SPARK_H - 3)).toFixed(1);
    return { d: vals.map((v, i) => `${i ? 'L' : 'M'}${x(i)} ${y(v)}`).join(' '), peak };
  }

  const chart = $derived.by(() => {
    const h = ctl.history;
    const top = Math.max(CAMP_POWER, ...h.map((x) => x.cap)) * 1.1;
    const step = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000, 10000].find((st) => top / st <= 4) ?? 20000;
    const max = Math.ceil(top / step) * step;
    const n = Math.max(h.length - 1, 1);
    const x = (i: number) => PAD.l + (i / n) * (W - PAD.l - PAD.r);
    const y = (mw: number) => PAD.t + (1 - mw / max) * (H - PAD.t - PAD.b);
    const line = (key: 'cap' | 'use') => h.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p[key]).toFixed(1)}`).join(' ');
    const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => ({ mw: i * step, y: y(i * step) }));
    // direct labels at the right end, nudged apart when the lines are close
    const last = h.at(-1);
    let capY = last ? y(last.cap) - 4 : 0;
    let useY = last ? y(last.use) + 11 : 0;
    if (last && useY - capY < 12) [capY, useY] = [Math.min(capY, useY - 12), Math.max(useY, capY + 12)];
    return { h, cap: line('cap'), use: line('use'), ticks, x, y, n, capY: Math.max(PAD.t + 8, capY), useY: Math.min(H - PAD.b - 2, useY) };
  });

  function onMove(e: PointerEvent) {
    const svg = e.currentTarget as SVGSVGElement;
    const r = svg.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((px - PAD.l) / (W - PAD.l - PAD.r)) * chart.n);
    hover = chart.h.length ? Math.max(0, Math.min(chart.h.length - 1, i)) : null;
  }
</script>

<div class="cols">
  <section class="card" aria-labelledby="ob-power">
    <h3 id="ob-power">Power grid</h3>
    {#if v.power}
      <div class="kpis">
        <div><span class="k">Capacity</span><strong>{fmtRate(v.power.capacity)} MW</strong></div>
        <div><span class="k">Demand</span><strong>{fmtRate(v.power.demand)} MW</strong></div>
        <div>
          <span class="k">Grid</span><strong class:bad={v.power.factor < 0.999}>{v.power.factor < 0.999 ? `Overloaded: ${Math.round(v.power.factor * 100)}% speed` : 'OK'}</strong>
        </div>
      </div>
    {/if}
    <div class="legend">
      <span><i style="background:#14a3b1"></i>Capacity</span>
      <span><i style="background:#e0701a"></i>In use</span>
      <span class="muted">last {Math.max(1, chart.h.length)} s</span>
    </div>
    <div class="chartbox">
      <svg
        viewBox="0 0 {W} {H}"
        class="chart"
        role="img"
        aria-label="Power over the last two minutes: capacity {fmtRate(v.power?.capacity ?? 0)} MW, in use {fmtRate(v.power?.demand ?? 0)} MW"
        onpointermove={onMove}
        onpointerleave={() => (hover = null)}
      >
        {#each chart.ticks as tk (tk.mw)}
          <line x1={PAD.l} x2={W - PAD.r} y1={tk.y} y2={tk.y} class="grid" />
          <text x={PAD.l - 4} y={tk.y + 3} text-anchor="end" class="ax">{Math.round(tk.mw)}</text>
        {/each}
        <text x={W - PAD.r} y={H - 4} text-anchor="end" class="ax">now</text>
        <text x={PAD.l} y={H - 4} class="ax">MW</text>
        {#if chart.h.length > 1}
          <path d={chart.cap} class="ln" stroke="#14a3b1" />
          <path d={chart.use} class="ln" stroke="#e0701a" />
          <text x={W - PAD.r - 2} y={chart.capY} text-anchor="end" class="dl">Capacity</text>
          <text x={W - PAD.r - 2} y={chart.useY} text-anchor="end" class="dl">In use</text>
        {/if}
        {#if hover !== null && chart.h[hover]}
          {@const p = chart.h[hover]}
          <line x1={chart.x(hover)} x2={chart.x(hover)} y1={PAD.t} y2={H - PAD.b} class="cross" />
          <circle cx={chart.x(hover)} cy={chart.y(p.cap)} r="3.5" fill="#14a3b1" stroke="#1b1f24" stroke-width="2" />
          <circle cx={chart.x(hover)} cy={chart.y(p.use)} r="3.5" fill="#e0701a" stroke="#1b1f24" stroke-width="2" />
        {/if}
      </svg>
      {#if hover !== null && chart.h[hover]}
        {@const p = chart.h[hover]}
        <div class="tip" style="left: {(chart.x(hover) / W) * 100}%">
          <div class="muted">{chart.h.length - 1 - hover} s ago</div>
          <div><i style="background:#14a3b1"></i>Capacity <strong>{fmtRate(p.cap)} MW</strong></div>
          <div><i style="background:#e0701a"></i>In use <strong>{fmtRate(p.use)} MW</strong></div>
        </div>
      {/if}
    </div>
    <p class="muted small">
      The Base Camp gives {CAMP_POWER} MW. Build generators and belt fuel into them for more. When demand beats capacity, every machine slows down in proportion. Idle machines still
      draw 10%.
    </p>
  </section>

  <section class="card" aria-labelledby="ob-bott">
    <h3 id="ob-bott">Bottlenecks</h3>
    {#if v.stuck}
      <p class="muted small">{v.stuck} machine{v.stuck === 1 ? '' : 's'} not running. Tap one to jump to it on the map.</p>
      {#each v.groups as g (g.st)}
        <div class="bg">
          <span class="bh"><i class="led st-{g.st}"></i>{g.name} · {g.items.length}</span>
          <div class="bl">
            {#each g.items as b (b.id)}
              <button class="chip" data-bottleneck={b.id} onclick={() => ctl.select(b.id)}>{b.name} <span class="muted">{b.x + 1},{b.y + 1}</span></button>
            {/each}
          </div>
        </div>
      {/each}
    {:else if v.s.buildings.length > 1}
      <p class="ok">Everything is running. Nice.</p>
    {:else}
      <p class="muted small">Build something and any machine that's starved, blocked or short of power shows up here.</p>
    {/if}
  </section>

  <section class="card" aria-labelledby="ob-hw">
    <h3 id="ob-hw">Homework power-ups</h3>
    <ul class="hw">
      <li>
        Each finished task: <strong>+{REWARD.task.shards} overclock shard</strong>, +{REWARD.task.insight} insight and a {REWARD.task.boost / 60}-minute ×{REWARD.boostMult} production
        boost.
      </li>
      <li>Each notecard session or pomodoro: +{REWARD.study.insight} insight and a {REWARD.study.boost / 60}-minute boost.</li>
      <li>Boosts stack up to {REWARD.boostCap / 3600} hours. Rewards bank even while the game is closed.</li>
    </ul>
    <p class="small">
      Rewarded so far: {v.s.rewards.tasks} task{v.s.rewards.tasks === 1 ? '' : 's'}, {v.s.rewards.study} study session{v.s.rewards.study === 1 ? '' : 's'}.
      {#if v.s.boostLeft > 0}Boost: {fmtTime(v.s.boostLeft)} left.{/if}
    </p>
  </section>
</div>

<section class="card" aria-labelledby="ob-prod">
  <h3 id="ob-prod">Production</h3>
  {#if v.rows.length}
    <div class="tablewrap">
      <table class="prod">
        <thead>
          <tr
            ><th>Item</th><th>Stock</th><th>Made/min</th><th>Used/min</th><th>To stock/min</th><th
              class="sp"
              title="Made per minute, one point every {SERIES_STEP} s, up to {(SERIES_LEN * SERIES_STEP) / 60} min">Trend</th
            ></tr
          >
        </thead>
        <tbody>
          {#each v.rows as r (r.id)}
            <tr data-item={r.id}>
              <td><FactoryIcon item={r.id as ItemId} size={18} /> {itemName(r.id as ItemId)}</td>
              <td data-stock={r.id}>{fmt(r.stock)}</td>
              <td>{fmtRate(r.made)}</td>
              <td>{fmtRate(r.used)}</td>
              <td>{fmtRate(r.stocked)}</td>
              <td class="sp">
                {#if r.spark}
                  <svg
                    viewBox="0 0 {SPARK_W} {SPARK_H}"
                    width={SPARK_W}
                    height={SPARK_H}
                    role="img"
                    aria-label="Made per minute over the last {Math.max(1, Math.round((v.samples * SERIES_STEP) / 60))} min, peak {fmtRate(r.spark.peak)}"
                  >
                    <path d={r.spark.d} class="spark" />
                  </svg>
                {:else}
                  <span class="muted">·</span>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <p class="muted">Nothing yet.</p>
  {/if}
</section>

<section class="card" aria-labelledby="ob-life">
  <h3 id="ob-life">Lifetime</h3>
  <div class="kpis">
    <div><span class="k">Factory time</span><strong>{fmtTime(v.lifetime.time)}</strong></div>
    <div><span class="k">Buildings</span><strong>{v.lifetime.buildings}</strong></div>
    <div><span class="k">Belts</span><strong>{v.lifetime.belts}</strong></div>
  </div>
  {#if v.lifetime.top.length}
    <ol class="top">
      {#each v.lifetime.top as [k, n], i (k)}
        <li>
          <span class="rank">{i + 1}</span>
          <FactoryIcon item={k} size={16} />
          <span class="nm">{itemName(k)}</span>
          <span class="bar"><span style="width: {(n / v.lifetime.top[0][1]) * 100}%"></span></span>
          <strong>{fmt(n)}</strong>
        </li>
      {/each}
    </ol>
  {:else}
    <p class="muted small">Nothing made yet: every item your machines ever produce is counted here.</p>
  {/if}
</section>

<section class="card" aria-labelledby="ob-bench">
  <h3 id="ob-bench">Workbench</h3>
  <p class="muted small">Craft one batch by hand from your stock. Slow, but it means you can never get stuck.</p>
  <div class="bench">
    {#each v.bench as { r, can } (r.id)}
      <button class="btn" disabled={!can} aria-label="Craft {r.name}" onclick={() => ctl.run((s) => benchCraft(s, r.id))}>
        <span class="bn">{r.name}</span>
        {#each Object.entries(r.in) as [k, n] (k)}<FactoryIcon item={k as ItemId} size={14} />{n}{/each}
        →
        {#each Object.entries(r.out) as [k, n] (k)}<FactoryIcon item={k as ItemId} size={14} />{n}{/each}
      </button>
    {/each}
  </div>
</section>

<style>
  .cols {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 10px;
    margin-bottom: 10px;
  }
  .card {
    background: var(--f-panel);
    border: 1px solid var(--f-line);
    border-radius: 10px;
    padding: 12px;
    margin-bottom: 10px;
  }
  .cols .card {
    margin: 0;
  }
  h3 {
    margin: 0 0 8px;
    font-size: 15px;
  }
  .muted {
    color: var(--f-muted);
  }
  .small {
    font-size: 12px;
  }
  p {
    margin: 6px 0 0;
  }
  .kpis {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
    margin-bottom: 6px;
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
  .bad {
    color: #ff9b8f;
  }
  .ok {
    color: #3fb950;
    font-weight: 600;
  }
  .bg {
    margin-top: 8px;
  }
  .bh {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 700;
    margin-bottom: 4px;
  }
  .led {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    border: 1px solid #000;
  }
  .led.st-starved {
    background: #f2b632;
  }
  .led.st-blocked {
    background: #e0701a;
  }
  .led.st-power,
  .led.st-nofuel {
    background: #e5484d;
  }
  .led.st-off,
  .led.st-idle {
    background: #7a828c;
  }
  .bl {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .chip {
    font-size: 12px;
    padding: 4px 9px;
    min-height: 30px;
    border-radius: 999px;
    border: 1px solid var(--f-line);
    background: var(--f-panel2);
    color: var(--f-text);
  }
  .chip .muted {
    font-size: 11px;
  }
  .sp {
    width: 80px;
  }
  .spark {
    fill: none;
    stroke: var(--f-orange);
    stroke-width: 1.5;
    stroke-linejoin: round;
    stroke-linecap: round;
  }
  .top {
    list-style: none;
    margin: 8px 0 0;
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
  .top .bar {
    height: 6px;
    border-radius: 3px;
    background: var(--f-panel2);
    overflow: hidden;
  }
  .top .bar span {
    display: block;
    height: 100%;
    background: linear-gradient(90deg, var(--f-teal), var(--f-orange));
  }
  .legend {
    display: flex;
    gap: 12px;
    font-size: 12px;
    align-items: center;
  }
  .legend i,
  .tip i {
    display: inline-block;
    width: 10px;
    height: 3px;
    border-radius: 2px;
    margin-right: 5px;
    vertical-align: middle;
  }
  .chartbox {
    position: relative;
  }
  .chart {
    width: 100%;
    height: auto;
    display: block;
    touch-action: pan-y;
  }
  .grid {
    stroke: var(--f-line);
    stroke-width: 1;
  }
  .ax {
    fill: var(--f-muted);
    font-size: 9px;
  }
  .dl {
    fill: var(--f-text);
    font-size: 9.5px;
    font-weight: 600;
  }
  .ln {
    fill: none;
    stroke-width: 2;
    stroke-linejoin: round;
  }
  .cross {
    stroke: var(--f-muted);
    stroke-width: 1;
  }
  .tip {
    position: absolute;
    top: 0;
    transform: translateX(-50%);
    background: #0f1215;
    border: 1px solid var(--f-line);
    border-radius: 6px;
    padding: 5px 8px;
    font-size: 11.5px;
    pointer-events: none;
    white-space: nowrap;
  }
  .hw {
    margin: 0;
    padding-left: 18px;
    font-size: 13px;
    display: grid;
    gap: 4px;
  }
  .tablewrap {
    overflow-x: auto;
  }
  .prod {
    width: 100%;
    border-collapse: collapse;
    font-size: 12.5px;
    font-variant-numeric: tabular-nums;
  }
  .prod th {
    text-align: right;
    font-weight: 600;
    color: var(--f-muted);
    padding: 4px 6px;
    white-space: nowrap;
  }
  .prod td {
    text-align: right;
    padding: 4px 6px;
    border-top: 1px solid var(--f-line);
    white-space: nowrap;
  }
  .prod th:first-child,
  .prod td:first-child {
    text-align: left;
  }
  .bench {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
  }
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 12px;
    padding: 6px 10px;
    min-height: 36px;
    border-radius: 8px;
    border: 1px solid var(--f-line);
    background: var(--f-panel2);
    color: var(--f-text);
  }
  .bn {
    font-weight: 700;
    margin-right: 4px;
  }
  .btn:disabled {
    opacity: 0.45;
  }
</style>
