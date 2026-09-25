<script lang="ts">
  // A course's grade over time: the running weighted average (line, course color) and each score (muted dots),
  // with the target as a reference line. Hover or arrow keys step through the points; the grade table is the table view.
  import { fromKey, MONTH_SHORT } from '../lib/dates';
  import type { gradeTimeline } from '../lib/grades';

  interface Props {
    points: ReturnType<typeof gradeTimeline>;
    color: string;
    target: number;
    letter: (pct: number) => string;
    label: string;
  }
  let { points, color, target, letter, label }: Props = $props();

  const W = 560;
  const H = 180;
  const pad = { l: 34, r: 14, t: 12, b: 24 };
  const lo = $derived(Math.max(0, Math.floor((Math.min(target, ...points.map((p) => Math.min(p.score, p.average))) - 5) / 10) * 10));
  const hi = $derived(Math.max(100, Math.ceil(Math.max(...points.map((p) => p.score)) / 10) * 10));
  const x = (i: number) => pad.l + (points.length < 2 ? (W - pad.l - pad.r) / 2 : (i / (points.length - 1)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo || 1)) * (H - pad.t - pad.b);
  const ticks = $derived(Array.from({ length: Math.floor((hi - lo) / 10) + 1 }, (_, i) => lo + i * 10).filter((v, i, a) => a.length <= 6 || i % 2 === 0 || v === hi));
  const path = $derived(points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.average).toFixed(1)}`).join(' '));
  const day = (d: string) => {
    const k = fromKey(d.slice(0, 10));
    return `${MONTH_SHORT[k.getMonth()]} ${k.getDate()}`;
  };

  let active = $state<number | null>(null);
  let svg: SVGSVGElement | undefined = $state();
  function onMove(e: PointerEvent) {
    if (!svg || !points.length) return;
    const r = svg.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    let best = 0;
    for (let i = 1; i < points.length; i++) if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
    active = best;
  }
  function onKey(e: KeyboardEvent) {
    if (!points.length) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const d = e.key === 'ArrowRight' ? 1 : -1;
      active = Math.max(0, Math.min(points.length - 1, (active ?? (d > 0 ? -1 : points.length)) + d));
    }
    if (e.key === 'Escape') active = null;
  }
  const last = $derived(points[points.length - 1]);
  const a = $derived(active === null ? undefined : points[active]);
</script>

<figure class="trend">
  <div class="legend" aria-hidden="true">
    <span><i class="line" style="background:{color}"></i> Course average</span>
    <span><i class="dot"></i> Each score</span>
    <span><i class="ref"></i> Target {target}%</span>
  </div>
  <div class="plot">
    <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
    <svg
      bind:this={svg}
      viewBox="0 0 {W} {H}"
      role="img"
      aria-label="{label}: average {last ? `${last.average.toFixed(1)}% after ${points.length} graded items` : 'no scores yet'}. Use the arrow keys to step through scores."
      tabindex="0"
      onpointermove={onMove}
      onpointerleave={() => (active = null)}
      onkeydown={onKey}
      onblur={() => (active = null)}
    >
      {#each ticks as t (t)}
        <line class="grid" x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} />
        <text class="tick" x={pad.l - 6} y={y(t) + 4} text-anchor="end">{t}</text>
      {/each}
      <line class="target" x1={pad.l} x2={W - pad.r} y1={y(target)} y2={y(target)} />
      {#if points.length}
        <text class="tick" x={pad.l} y={H - 6}>{day(points[0].date)}</text>
        {#if points.length > 1}<text class="tick" x={W - pad.r} y={H - 6} text-anchor="end">{day(last.date)}</text>{/if}
        {#if a}<line class="cross" x1={x(active!)} x2={x(active!)} y1={pad.t} y2={H - pad.b} />{/if}
        {#each points as p, i (p.id)}
          <circle class="score" cx={x(i)} cy={y(p.score)} r={active === i ? 5 : 4} />
        {/each}
        <path d={path} fill="none" stroke={color} stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
        <circle class="end" cx={x(points.length - 1)} cy={y(last.average)} r="4.5" fill={color} />
        {#if a}<circle class="end" cx={x(active!)} cy={y(a.average)} r="5" fill={color} />{/if}
      {/if}
    </svg>
    {#if last}
      <span class="endlabel" style="top:{(y(last.average) / H) * 100}%">{last.average.toFixed(1)}% {letter(last.average)}</span>
    {/if}
    {#if a}
      {@const pos = x(active!) / W}
      <div class="tip" class:edge-l={pos < 0.3} class:edge-r={pos > 0.7} role="status" style="left:{pos * 100}%">
        <strong>{a.average.toFixed(1)}%</strong> average after
        <div>{a.title}: <strong>{a.score}%</strong> <span class="muted">({a.weight}% of grade · {day(a.date)})</span></div>
      </div>
    {/if}
  </div>
</figure>

<style>
  .trend {
    margin: 8px 0 4px;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    font-size: 12px;
    color: var(--text-muted);
    margin-bottom: 4px;
  }
  .legend span {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }
  .legend i {
    display: inline-block;
  }
  .legend .line {
    width: 14px;
    height: 2px;
    border-radius: 1px;
  }
  .legend .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--text-muted);
    opacity: 0.6;
  }
  .legend .ref {
    width: 14px;
    height: 0;
    border-top: 1px solid var(--text-muted);
  }
  .plot {
    position: relative;
    padding-right: 76px;
  }
  svg {
    width: 100%;
    height: auto;
    display: block;
    overflow: visible;
    touch-action: pan-y;
  }
  svg:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
    border-radius: 6px;
  }
  .grid {
    stroke: var(--border);
    stroke-width: 1;
  }
  .target {
    stroke: var(--text-muted);
    stroke-width: 1;
    opacity: 0.7;
  }
  .cross {
    stroke: var(--text-muted);
    stroke-width: 1;
  }
  .tick {
    font-size: 10px;
    fill: var(--text-muted);
  }
  .score {
    fill: var(--text-muted);
    fill-opacity: 0.55;
    stroke: var(--bg-elev);
    stroke-width: 2;
  }
  .end {
    stroke: var(--bg-elev);
    stroke-width: 2;
  }
  .endlabel {
    position: absolute;
    right: 0;
    transform: translateY(-50%);
    font-size: 12px;
    font-weight: 600;
    color: var(--text);
    white-space: nowrap;
  }
  .tip {
    position: absolute;
    top: 4px;
    transform: translateX(-50%);
    background: var(--bg-elev-2, var(--bg-elev));
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 6px 8px;
    font-size: 12px;
    color: var(--text);
    white-space: nowrap;
    pointer-events: none;
    box-shadow: 0 4px 14px rgb(0 0 0 / 0.15);
    z-index: 2;
  }
  /* near the ends, pin the tooltip to that side of the crosshair so it stays inside the chart */
  .tip.edge-l {
    transform: translateX(8px);
  }
  .tip.edge-r {
    transform: translateX(calc(-100% - 8px));
  }
  .muted {
    color: var(--text-muted);
  }
</style>
