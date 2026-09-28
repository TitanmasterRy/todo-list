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
    <strong
      >{#key sum.lit}<span class="gold-text bump">{sum.lit}</span>{/key}</strong
    >
    star{sum.lit === 1 ? '' : 's'} lit {isCurrent ? `of ${sum.pastDays} days so far` : `of ${map.stars.length} days`} ({tasks(sum.tasks)}). Longest constellation: {sum.longest}
    day{sum.longest === 1 ? '' : 's'} in a row.
  {:else if isCurrent}
    No stars yet this {kind === 'year' ? 'year' : 'semester'}. Finish a task today to light your first one.
  {:else}
    No stars in {period.label}.
  {/if}
</p>

<div class="sky-wrap card">
  <span class="dots" aria-hidden="true"></span>
  <span class="dots far" aria-hidden="true"></span>
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
      <g class="links">
        {#each map.links as [a, b] (a)}
          <line class="link" x1={map.stars[a].x} y1={map.stars[a].y} x2={map.stars[b].x} y2={map.stars[b].y} />
        {/each}
      </g>
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
    background: var(--bg-elev-2);
    padding: 3px;
    gap: 2px;
  }
  .seg button {
    padding: 5px 12px;
    font-size: 13px;
    font-weight: 600;
    border-radius: 999px;
    color: var(--text-muted);
    transition:
      background var(--dur),
      color var(--dur),
      box-shadow var(--dur);
  }
  .seg button:hover {
    color: var(--text);
  }
  .seg button.on {
    background: var(--grad-accent);
    color: var(--accent-contrast, #fff);
    box-shadow: 0 2px 10px -3px color-mix(in srgb, var(--accent) 70%, transparent);
  }
  .label {
    min-width: 8em;
    text-align: center;
    font-variant-numeric: tabular-nums;
    padding: 3px 12px;
    border-radius: 999px;
    background: var(--bg-elev);
    border: 1px solid var(--border);
    box-shadow: inset 0 1px 0 var(--sheen);
  }
  .summary {
    margin: 0 0 10px;
    font-size: 14px;
    font-variant-numeric: tabular-nums;
  }
  .summary strong {
    font-size: 18px;
    font-weight: 900;
  }
  /* deep space: a dark card (whatever the theme) with two layers of twinkling star dots behind the sky */
  .sky-wrap {
    position: relative;
    padding: 8px;
    overflow: hidden;
    border-color: color-mix(in srgb, var(--accent) 35%, var(--border));
    background:
      radial-gradient(60% 50% at 20% 0%, color-mix(in srgb, var(--accent) 38%, transparent), transparent 70%),
      radial-gradient(50% 45% at 85% 100%, color-mix(in srgb, var(--accent-2) 22%, transparent), transparent 70%), linear-gradient(180deg, #0b0d1c, #05060d);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.08),
      var(--shadow),
      0 0 40px -12px color-mix(in srgb, var(--accent) 55%, transparent);
    animation: pop-in var(--dur-slow) var(--spring) both;
  }
  .dots {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
      radial-gradient(1px 1px at 12% 22%, rgba(255, 255, 255, 0.8), transparent 100%), radial-gradient(1.5px 1.5px at 31% 68%, rgba(255, 255, 255, 0.7), transparent 100%),
      radial-gradient(1px 1px at 47% 12%, rgba(255, 255, 255, 0.75), transparent 100%), radial-gradient(1px 1px at 63% 81%, rgba(255, 255, 255, 0.6), transparent 100%),
      radial-gradient(1.5px 1.5px at 78% 34%, rgba(255, 255, 255, 0.8), transparent 100%), radial-gradient(1px 1px at 91% 66%, rgba(255, 255, 255, 0.65), transparent 100%),
      radial-gradient(1px 1px at 55% 45%, rgba(255, 255, 255, 0.55), transparent 100%), radial-gradient(1px 1px at 8% 88%, rgba(255, 255, 255, 0.6), transparent 100%);
    animation: twinkle 3.6s ease-in-out infinite;
  }
  .dots.far {
    background:
      radial-gradient(1px 1px at 22% 48%, rgba(255, 255, 255, 0.45), transparent 100%), radial-gradient(1px 1px at 39% 91%, rgba(255, 255, 255, 0.4), transparent 100%),
      radial-gradient(1px 1px at 71% 15%, rgba(255, 255, 255, 0.5), transparent 100%), radial-gradient(1px 1px at 84% 84%, rgba(255, 255, 255, 0.4), transparent 100%),
      radial-gradient(1px 1px at 5% 40%, rgba(255, 255, 255, 0.35), transparent 100%), radial-gradient(1px 1px at 96% 8%, rgba(255, 255, 255, 0.45), transparent 100%),
      radial-gradient(1px 1px at 50% 72%, rgba(255, 255, 255, 0.35), transparent 100%), radial-gradient(1px 1px at 66% 57%, rgba(255, 255, 255, 0.4), transparent 100%);
    animation-duration: 5.2s;
    animation-delay: 1.3s;
  }
  .sky {
    position: relative;
    z-index: 1;
    display: block;
    width: 100%;
    height: auto;
    --star: var(--gold);
  }
  .sky-top {
    stop-color: color-mix(in srgb, var(--accent) 30%, transparent);
  }
  .sky-bottom {
    stop-color: color-mix(in srgb, var(--accent-2) 8%, transparent);
  }
  .glow-in {
    stop-color: var(--gold);
    stop-opacity: 0.55;
  }
  .glow-out {
    stop-color: var(--gold);
    stop-opacity: 0;
  }
  .month {
    fill: color-mix(in srgb, var(--accent-2) 40%, #fff);
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    opacity: 0.85;
  }
  .dust {
    fill: color-mix(in srgb, var(--accent-2) 30%, #fff);
    opacity: 0.35;
  }
  .dust.future {
    opacity: 0.12;
  }
  /* constellation lines glow in the accent */
  .links {
    filter: drop-shadow(0 0 3px color-mix(in srgb, var(--accent) 80%, transparent));
  }
  .link {
    stroke: color-mix(in srgb, var(--accent-2) 60%, #fff);
    stroke-width: 1.4;
    stroke-linecap: round;
    opacity: 0.8;
  }
  /* lit stars: a gold core that twinkles and a halo that slowly breathes */
  .glow {
    fill: url(#star-glow);
    transform-box: fill-box;
    transform-origin: center;
    animation: halo 4.4s ease-in-out infinite;
    animation-delay: var(--d);
  }
  .core {
    fill: var(--star);
    filter: drop-shadow(0 0 3px color-mix(in srgb, var(--gold) 90%, transparent));
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
    fill: #fff;
    filter: drop-shadow(0 0 6px var(--gold));
  }
  .star:hover .glow,
  .star:focus-visible .glow {
    transform: scale(1.5);
  }
  .star:focus-visible .hit {
    stroke: var(--accent-2);
    stroke-width: 2;
  }
  .today {
    fill: none;
    stroke: var(--accent-2);
    stroke-width: 1.5;
    stroke-dasharray: 3 3;
    filter: drop-shadow(0 0 4px color-mix(in srgb, var(--accent-2) 80%, transparent));
    animation: orbit 6s linear infinite;
  }
  .info {
    position: relative;
    z-index: 1;
    min-height: 1.4em;
    margin: 6px auto 0;
    text-align: center;
    font-size: 13px;
    font-weight: 700;
    color: #fff;
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
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
  @keyframes halo {
    0%,
    100% {
      transform: scale(1);
      opacity: 0.8;
    }
    50% {
      transform: scale(1.35);
      opacity: 1;
    }
  }
  @keyframes orbit {
    to {
      stroke-dashoffset: -24;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    :global(:root:not(.motion-ok)) .core,
    :global(:root:not(.motion-ok)) .glow,
    :global(:root:not(.motion-ok)) .dots {
      animation: none;
    }
  }
  :global(.reduced-motion) .core,
  :global(.reduced-motion) .glow,
  :global(.reduced-motion) .dots {
    animation: none;
  }
</style>
