<script lang="ts">
  // Play → Star map: each day you finished a task lights a star; days in a row join into constellations.
  // The sky is decorative, so it also has a text summary and a month table. Lit stars are one tab stop (arrows move between them).
  import { store } from '../../lib/store.svelte';
  import { dayLabel, layoutStars, periodFor, shiftPeriod, starSummary, type PeriodKind } from '../../lib/starmap';

  const KIND_KEY = 'homework-todo:starmap-kind';
  let kind = $state<PeriodKind>(
    ((): PeriodKind => {
      try {
        return localStorage.getItem(KIND_KEY) === 'semester' ? 'semester' : 'year';
      } catch {
        return 'year';
      }
    })(),
  );
  let anchor = $state(store.today);
  const period = $derived(periodFor(kind, anchor));
  const map = $derived(layoutStars(period, store.stats.completionsByDay, store.today));
  const sum = $derived(starSummary(map));
  const lit = $derived(map.stars.map((s, i) => ({ s, i })).filter((x) => x.s.lit));
  const isCurrent = $derived(period.end >= store.today);
  let focusIdx = $state(-1); // index into `lit` that holds the tab stop
  const tabStop = $derived(focusIdx >= 0 && focusIdx < lit.length ? focusIdx : lit.length - 1);
  let info = $state('');
  let stars: SVGGElement[] = $state([]);

  const tasks = (n: number) => `${n} task${n === 1 ? '' : 's'}`;
  const starText = (key: string, count: number) => `${dayLabel(key)}: ${tasks(count)} done`;

  function pickKind(k: PeriodKind) {
    kind = k;
    focusIdx = -1;
    try {
      localStorage.setItem(KIND_KEY, k);
    } catch {
      /* ignore */
    }
  }
  function shift(dir: 1 | -1) {
    anchor = shiftPeriod(period, dir).start;
    focusIdx = -1;
    info = '';
  }
  function onKey(e: KeyboardEvent, i: number) {
    const to =
      e.key === 'ArrowRight' || e.key === 'ArrowDown' ? i + 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? lit.length - 1 : -2;
    if (to === -2) return;
    e.preventDefault();
    focusIdx = Math.max(0, Math.min(lit.length - 1, to));
    stars[focusIdx]?.focus();
  }
</script>

<div class="head">
  <div class="seg" role="group" aria-label="Sky size">
    <button class:on={kind === 'year'} aria-pressed={kind === 'year'} onclick={() => pickKind('year')}>Year</button>
    <button class:on={kind === 'semester'} aria-pressed={kind === 'semester'} onclick={() => pickKind('semester')}>Semester</button>
  </div>
  <span class="grow"></span>
  <button class="btn ghost sm" aria-label="Previous" onclick={() => shift(-1)}>‹</button>
  <strong class="label">{period.label}</strong>
  <button class="btn ghost sm" aria-label="Next" disabled={isCurrent} onclick={() => shift(1)}>›</button>
</div>

<p class="summary" data-summary>
  {#if sum.lit}
    <strong>{sum.lit}</strong> star{sum.lit === 1 ? '' : 's'} lit {isCurrent ? `of ${sum.pastDays} days so far` : `of ${map.stars.length} days`} ({tasks(sum.tasks)}). Longest
    constellation: {sum.longest}
    day{sum.longest === 1 ? '' : 's'} in a row.
  {:else if isCurrent}
    No stars yet this {kind === 'year' ? 'year' : 'semester'}. Finish a task today to light your first one.
  {:else}
    No stars in {period.label}.
  {/if}
</p>

<div class="sky-wrap card">
  <svg class="sky" viewBox="0 0 {map.width} {map.height}" role="group" aria-label="Star map for {period.label}: {sum.lit} days lit">
    <defs>
      <linearGradient id="sky-bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" class="sky-top" />
        <stop offset="1" class="sky-bottom" />
      </linearGradient>
      <radialGradient id="star-glow">
        <stop offset="0" class="glow-in" />
        <stop offset="1" class="glow-out" />
      </radialGradient>
    </defs>
    <rect width={map.width} height={map.height} fill="url(#sky-bg)" rx="10" />
    <g aria-hidden="true">
      {#each map.months as m (m.label)}
        <text class="month" x={m.x} y={m.y}>{m.label.split(' ')[0]}</text>
      {/each}
      {#each map.stars as s (s.key)}
        {#if !s.lit}<circle class="dust" class:future={s.future} cx={s.x} cy={s.y} r={s.r} />{/if}
      {/each}
      {#each map.links as [a, b] (a)}
        <line class="link" x1={map.stars[a].x} y1={map.stars[a].y} x2={map.stars[b].x} y2={map.stars[b].y} />
      {/each}
    </g>
    {#each lit as { s }, i (s.key)}
      <!-- a labelled image you can focus (like a heatmap cell) so keyboard users can read each day; arrows move between them -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
      <g
        bind:this={stars[i]}
        class="star"
        style="--d:{(i * 0.37) % 4}s"
        role="img"
        tabindex={i === tabStop ? 0 : -1}
        aria-label={starText(s.key, s.count)}
        data-day={s.key}
        onfocus={() => ((focusIdx = i), (info = starText(s.key, s.count)))}
        onmouseenter={() => (info = starText(s.key, s.count))}
        onmouseleave={() => (info = '')}
        onkeydown={(e) => onKey(e, i)}
      >
        <circle class="glow" cx={s.x} cy={s.y} r={s.r * 3.2} />
        <circle class="core" cx={s.x} cy={s.y} r={s.r} />
        <circle class="hit" cx={s.x} cy={s.y} r={Math.max(8, s.r * 2)} />
      </g>
    {/each}
    {#each map.stars as s (s.key)}
      {#if s.key === store.today}<circle class="today" cx={s.x} cy={s.y} r={s.r + 5} aria-hidden="true" />{/if}
    {/each}
  </svg>
  <div class="info" aria-live="polite">{info || (lit.length ? 'Hover or tab to a star to see its day.' : '')}</div>
</div>

<details class="table">
  <summary>Show as a table</summary>
  <table>
    <thead>
      <tr><th scope="col">Month</th><th scope="col">Days lit</th><th scope="col">Tasks done</th></tr>
    </thead>
    <tbody>
      {#each map.months as m (m.label)}
        <tr><th scope="row">{m.label}</th><td>{m.lit} of {m.days}</td><td>{m.tasks}</td></tr>
      {/each}
    </tbody>
  </table>
</details>

<style>
  .head {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
    margin-bottom: 8px;
  }
  .grow {
    flex: 1;
  }
  .seg {
    display: inline-flex;
    border: 1px solid var(--border);
    border-radius: 999px;
    overflow: hidden;
  }
  .seg button {
    padding: 6px 14px;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-muted);
  }
  .seg button.on {
    background: var(--accent);
    color: var(--accent-contrast);
  }
  .label {
    min-width: 8em;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }
  .summary {
    margin: 0 0 10px;
    font-size: 14px;
  }
  .sky-wrap {
    padding: 8px;
  }
  .sky {
    display: block;
    width: 100%;
    height: auto;
    --star: color-mix(in srgb, var(--warn) 70%, var(--text));
  }
  .sky-top {
    stop-color: color-mix(in srgb, var(--accent) 22%, var(--bg-elev));
  }
  .sky-bottom {
    stop-color: var(--bg-elev-2);
  }
  .glow-in {
    stop-color: var(--warn);
    stop-opacity: 0.45;
  }
  .glow-out {
    stop-color: var(--warn);
    stop-opacity: 0;
  }
  .month {
    fill: var(--text-muted);
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .dust {
    fill: var(--text-muted);
    opacity: 0.4;
  }
  .dust.future {
    opacity: 0.15;
  }
  .link {
    stroke: color-mix(in srgb, var(--accent) 50%, var(--star));
    stroke-width: 1.4;
    stroke-linecap: round;
    opacity: 0.75;
  }
  .glow {
    fill: url(#star-glow);
  }
  .core {
    fill: var(--star);
    animation: twinkle 4s ease-in-out infinite;
    animation-delay: var(--d);
  }
  .hit {
    fill: transparent;
  }
  .star {
    cursor: default;
    outline: none;
  }
  .star:hover .core,
  .star:focus-visible .core {
    fill: var(--accent-text);
  }
  .star:focus-visible .hit {
    stroke: var(--accent);
    stroke-width: 2;
  }
  .today {
    fill: none;
    stroke: var(--accent);
    stroke-width: 1.5;
    stroke-dasharray: 3 3;
  }
  .info {
    min-height: 1.4em;
    margin-top: 6px;
    text-align: center;
    font-size: 13px;
    font-weight: 600;
  }
  .table {
    margin-top: 10px;
    font-size: 14px;
  }
  .table summary {
    cursor: pointer;
    color: var(--text-muted);
  }
  table {
    border-collapse: collapse;
    margin-top: 8px;
  }
  th,
  td {
    text-align: left;
    padding: 4px 14px 4px 0;
    border-bottom: 1px solid var(--border);
    font-variant-numeric: tabular-nums;
  }
  thead th {
    color: var(--text-muted);
    font-size: 12px;
  }
  @keyframes twinkle {
    50% {
      opacity: 0.55;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    :global(:root:not(.motion-ok)) .core {
      animation: none;
    }
  }
  :global(.reduced-motion) .core {
    animation: none;
  }
</style>
