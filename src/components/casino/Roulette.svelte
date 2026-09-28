<script lang="ts">
  import { onDestroy } from 'svelte';
  import { economy } from '../../lib/economy.svelte';
  import { betKey, betLabel, color, settleRoulette, spinRoulette, WHEEL_ORDER, wins, type RouletteBet } from '../../lib/casino/roulette';
  import ArtImg from '../ArtImg.svelte';
  import Chip from './Chip.svelte';
  import WinFx from './WinFx.svelte';
  import { chipsIn, chipsOut, reduced, wait } from './fx';
  import { sfx } from './sfx';

  const CHIPS = [5, 10, 25, 100, 500];
  let chip = $state(10);
  let bets = $state<{ bet: RouletteBet; amount: number }[]>([]);
  let last = $state<number | null>(null);
  let history = $state<number[]>([]);
  let result = $state<{ text: string; win: boolean } | null>(null);
  let spinning = $state(false);
  let settled = $state(false);
  let fx = $state<WinFx>();
  let board = $state<HTMLElement>();
  const total = $derived(bets.reduce((a, b) => a + b.amount, 0));

  // wheel geometry: angles in degrees clockwise from 12 o'clock; pocket i is centered at i × 360/37
  const STEP = 360 / 37;
  let wheelDeg = $state(0);
  let ball = $state<{ a: number; r: number } | null>(null);
  let raf = 0;
  onDestroy(() => cancelAnimationFrame(raf));

  function place(bet: RouletteBet, e?: MouseEvent) {
    if (spinning || total + chip > economy.wallet.chips) return;
    const k = betKey(bet);
    const i = bets.findIndex((b) => betKey(b.bet) === k);
    if (i >= 0) bets = bets.map((b, j) => (j === i ? { ...b, amount: b.amount + chip } : b));
    else bets = [...bets, { bet, amount: chip }];
    settled = false;
    if (e?.currentTarget) chipsIn(e.currentTarget as Element, chip);
    else sfx('chip');
  }
  function on(bet: RouletteBet): number {
    return bets.find((b) => betKey(b.bet) === betKey(bet))?.amount ?? 0;
  }
  const easeOut = (t: number, p = 3) => 1 - (1 - t) ** p;
  function bounce(t: number): number {
    // settles from the track into the pocket with two little hops
    if (t < 0.55) return (t / 0.55) ** 2;
    if (t < 0.8) return 1 - 0.18 * Math.sin(((t - 0.55) / 0.25) * Math.PI);
    return 1 - 0.06 * Math.sin(((t - 0.8) / 0.2) * Math.PI);
  }

  function animate(n: number, ms: number): void {
    const i = WHEEL_ORDER.indexOf(n);
    const w0 = wheelDeg % 360;
    const wEnd = w0 + 720 + Math.random() * 360;
    const relEnd = i * STEP;
    const rel0 = relEnd + 360 * 4 + Math.random() * 360;
    const t0 = performance.now();
    const clacks = [0.66, 0.73, 0.79];
    let c = 0;
    const frame = (now: number) => {
      const t = Math.min(1, (now - t0) / ms);
      const w = w0 + (wEnd - w0) * easeOut(t);
      const tb = Math.min(1, t / 0.84);
      const rel = relEnd + (rel0 - relEnd) * (1 - easeOut(tb, 2.4));
      const drop = t < 0.58 ? 0 : bounce(Math.min(1, (t - 0.58) / 0.26));
      wheelDeg = w;
      ball = { a: w + rel, r: 83 - 17 * drop };
      if (c < clacks.length && t >= clacks[c]) {
        sfx('ball');
        c++;
      }
      if (t < 1) raf = requestAnimationFrame(frame);
    };
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
  }

  async function spin() {
    if (!bets.length || spinning || !economy.bet('roulette', total)) return;
    spinning = true;
    settled = false;
    result = null;
    fx?.clear();
    const n = spinRoulette();
    const ms = reduced() ? 0 : 4300;
    sfx('spin');
    if (ms) animate(n, ms);
    await wait(ms || 700);
    cancelAnimationFrame(raf);
    // land exactly (also covers a hidden tab, where animation frames pause)
    const i = WHEEL_ORDER.indexOf(n);
    ball = { a: wheelDeg + i * STEP, r: 66 };
    last = n;
    history = [n, ...history].slice(0, 14);
    const back = settleRoulette(bets, n);
    economy.payout('roulette', back);
    if (bets.some((b) => b.bet.kind === 'straight' && b.bet.n === n)) economy.achieve('straight-up');
    settled = true;
    result = back > 0 ? { text: `${n} ${color(n)} · returned ${back.toLocaleString()}`, win: back > total } : { text: `${n} ${color(n)} · no win`, win: false };
    fx?.show(back, total);
    if (back > 0) {
      const spots = board?.querySelectorAll('[data-won="true"]');
      spots?.forEach((s, k) => setTimeout(() => chipsOut(s, Math.ceil(back / spots.length)), 250 + k * 120));
    }
    spinning = false;
  }
  const hit = (b: RouletteBet) => settled && last !== null && wins(b, last);
  const name = (b: RouletteBet) => {
    const amt = on(b);
    const base = b.kind === 'column' ? `2 to 1, column ${b.c}` : betLabel(b);
    return amt ? `${base}, ${amt} on it` : base;
  };
  const rows = [3, 2, 1].map((r) => Array.from({ length: 12 }, (_, c) => c * 3 + r));
  const outside: RouletteBet[] = [{ kind: 'low' }, { kind: 'even' }, { kind: 'red' }, { kind: 'black' }, { kind: 'odd' }, { kind: 'high' }];
  const RED_FILL = '#c8102e';
  const pockColor = (n: number) => (n === 0 ? '#12a061' : color(n) === 'red' ? RED_FILL : '#18181d');
  const pt = (r: number, deg: number) => {
    const a = (deg * Math.PI) / 180;
    return { x: r * Math.sin(a), y: -r * Math.cos(a) };
  };
  function wedge(i: number, r0: number, r1: number): string {
    const a0 = (i - 0.5) * STEP;
    const a1 = (i + 0.5) * STEP;
    const p = (r: number, a: number) => {
      const q = pt(r, a);
      return `${q.x.toFixed(2)},${q.y.toFixed(2)}`;
    };
    return `M${p(r0, a0)} L${p(r1, a0)} A${r1},${r1} 0 0 1 ${p(r1, a1)} L${p(r0, a1)} A${r0},${r0} 0 0 0 ${p(r0, a0)} Z`;
  }
</script>

{#snippet spot(b: RouletteBet, cls: string, label: string)}
  <button class="{cls} spotbtn" class:win={hit(b)} data-won={hit(b) && on(b) > 0} onclick={(e) => place(b, e)} aria-label={name(b)} disabled={spinning}>
    <span class="lab" aria-hidden="true">{label}</span>
    {#if on(b)}<span class="chipon" aria-hidden="true"><Chip value={on(b)} size={24} /></span>{/if}
  </button>
{/snippet}

<div class="cz-game">
  <div class="cz-table roul">
    <div class="wheelside">
      <div class="wheel" aria-hidden="true">
        <div class="bowl"></div>
        <div class="spinner" style="transform: rotate({wheelDeg}deg)">
          <ArtImg name="casino/roulette-wheel.webp" class="wheelimg">
            {#snippet fallback()}
              <svg viewBox="-100 -100 200 200" class="wheelsvg">
                <defs>
                  <radialGradient id="rw-cone" cx="40%" cy="35%" r="80%">
                    <stop offset="0" stop-color="#b0743a" />
                    <stop offset=".6" stop-color="#6b3a14" />
                    <stop offset="1" stop-color="#3a1d08" />
                  </radialGradient>
                  <linearGradient id="rw-gold" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stop-color="#fff2b8" />
                    <stop offset=".5" stop-color="#e7b84a" />
                    <stop offset="1" stop-color="#8a5c0c" />
                  </linearGradient>
                </defs>
                <circle r="78" fill="#2b1606" />
                {#each WHEEL_ORDER as n, i (n)}
                  {@const q = pt(68.5, i * STEP)}
                  <path d={wedge(i, 56, 77)} fill={pockColor(n)} stroke="#e7b84a" stroke-width=".6" />
                  <text x={q.x} y={q.y} transform="rotate({i * STEP} {q.x} {q.y})" text-anchor="middle" dominant-baseline="central" font-size="7" font-weight="800" fill="#fff"
                    >{n}</text
                  >
                {/each}
                <circle r="77.5" fill="none" stroke="url(#rw-gold)" stroke-width="1.6" />
                <circle r="56" fill="url(#rw-cone)" stroke="url(#rw-gold)" stroke-width="1.6" />
                {#each [0, 1, 2, 3, 4, 5, 6, 7] as k (k)}
                  {@const q = pt(47, k * 45 + 22.5)}
                  <circle cx={q.x} cy={q.y} r="1.6" fill="#f3d27c" opacity=".8" />
                {/each}
                <g fill="url(#rw-gold)" stroke="#8a5c0c" stroke-width=".6">
                  <path d="M-3 -34 L3 -34 L4 -6 L34 -3 L34 3 L4 6 L3 34 L-3 34 L-4 6 L-34 3 L-34 -3 L-4 -6 Z" />
                  <circle cx="0" cy="-36" r="4" />
                  <circle cx="36" cy="0" r="4" />
                  <circle cx="0" cy="36" r="4" />
                  <circle cx="-36" cy="0" r="4" />
                  <circle r="9" />
                </g>
                <circle r="4" fill="#fff6d6" />
              </svg>
            {/snippet}
          </ArtImg>
        </div>
        <svg class="ballsvg" viewBox="-100 -100 200 200">
          {#if ball}
            {@const q = pt(ball.r, ball.a)}
            <circle cx={q.x + 1.2} cy={q.y + 1.6} r="4.6" fill="rgba(0,0,0,.35)" />
            <circle cx={q.x} cy={q.y} r="4.4" fill="url(#rw-ball)" />
          {/if}
          <defs>
            <radialGradient id="rw-ball" cx="35%" cy="30%" r="70%">
              <stop offset="0" stop-color="#fff" />
              <stop offset=".6" stop-color="#e8e8ec" />
              <stop offset="1" stop-color="#9a9aa6" />
            </radialGradient>
          </defs>
        </svg>
      </div>
      <div class="readout">
        <div class="last {last === null ? '' : color(last)}" class:pop={settled} aria-live="polite">
          <span class="sr">Last number:</span>{spinning ? '·' : (last ?? '–')}
        </div>
        <div class="hist" aria-label="Recent numbers">
          {#each history as h, i (i)}<span class="h {color(h)}">{h}</span>{/each}
        </div>
      </div>
    </div>
    <div class="layout">
      <div class="board" role="group" aria-label="Roulette table" bind:this={board}>
        {@render spot({ kind: 'straight', n: 0 }, 'n green zero', '0')}
        <div class="nums">
          {#each rows as row, r (r)}
            {#each row as n (n)}
              {@render spot({ kind: 'straight', n }, `n ${color(n)}`, String(n))}
            {/each}
            {@render spot({ kind: 'column', c: (3 - r) as 1 | 2 | 3 }, 'n col', '2:1')}
          {/each}
        </div>
      </div>
      <div class="outs">
        {#each [1, 2, 3] as d (d)}
          {@render spot({ kind: 'dozen', d: d as 1 | 2 | 3 }, 'o', betLabel({ kind: 'dozen', d: d as 1 | 2 | 3 }))}
        {/each}
      </div>
      <div class="outs six">
        {#each outside as b (b.kind)}
          {@render spot(b, `o ${b.kind}`, b.kind === 'red' || b.kind === 'black' ? '' : betLabel(b))}
        {/each}
      </div>
    </div>
    <div class="cz-result center" class:win={result?.win} class:lose={result && !result.win}>{result?.text ?? (spinning ? 'No more bets…' : 'Place your bets')}</div>
    <WinFx bind:this={fx} />
  </div>
  <div class="cz-deck">
    <div class="rack" role="radiogroup" aria-label="Chip">
      {#each CHIPS as c (c)}
        <button
          class="chipbtn"
          role="radio"
          aria-checked={chip === c}
          aria-label="{c} chip"
          class:on={chip === c}
          onclick={() => {
            chip = c;
            sfx('chip');
          }}><Chip value={c} size={38} /></button
        >
      {/each}
    </div>
    <span class="muted">On the table: <strong>{total.toLocaleString()}</strong></span>
    <button class="btn ghost sm" onclick={() => (bets = [])} disabled={!bets.length || spinning}>Clear</button>
    <div class="grow"></div>
    <button class="btn cz-go" onclick={spin} disabled={!bets.length || spinning || total > economy.wallet.chips}>Spin</button>
  </div>
  <p class="cz-edge">
    European wheel (single zero): numbers pay 35:1, dozens and columns 2:1, even-money bets 1:1. House edge 2.7%. Tap a spot to place a chip; bets stay on for the next spin.
  </p>
</div>

<style>
  .roul {
    grid-template-columns: minmax(200px, 280px) 1fr;
    align-items: center;
    gap: 16px 20px;
  }
  .wheelside {
    display: grid;
    gap: 10px;
    justify-items: center;
  }
  .wheel {
    position: relative;
    width: min(260px, 70vw);
    aspect-ratio: 1;
  }
  .bowl {
    position: absolute;
    inset: -4%;
    border-radius: 50%;
    background: radial-gradient(circle, transparent 60%, rgba(0, 0, 0, 0.35) 61%, transparent 63%), radial-gradient(circle at 40% 30%, #8a5426, #4a2a10 60%, #2a1605);
    box-shadow:
      inset 0 0 0 3px #e7b84a,
      inset 0 0 0 7px #3a1d08,
      inset 0 0 18px rgba(0, 0, 0, 0.7),
      0 10px 24px rgba(0, 0, 0, 0.5);
  }
  .spinner {
    position: absolute;
    inset: 10%;
    will-change: transform;
  }
  .spinner :global(.wheelsvg),
  .spinner :global(.wheelimg) {
    width: 100%;
    height: 100%;
    display: block;
    border-radius: 50%;
    filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.5));
  }
  .ballsvg {
    position: absolute;
    inset: 10%;
    width: 80%;
    height: 80%;
    overflow: visible;
    pointer-events: none;
  }
  .readout {
    display: flex;
    gap: 8px;
    align-items: center;
    max-width: 100%;
  }
  .last {
    width: 52px;
    height: 52px;
    flex: none;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-weight: 900;
    font-size: 22px;
    background: #fffdf4;
    color: #111;
    box-shadow:
      0 0 0 3px #e7b84a,
      0 4px 10px rgba(0, 0, 0, 0.45);
  }
  .last.red {
    background: #c8102e;
    color: #fff;
  }
  .last.black {
    background: #18181d;
    color: #fff;
  }
  .last.green {
    background: #12a061;
    color: #fff;
  }
  .last.pop {
    animation: lastpop 600ms cubic-bezier(0.3, 1.6, 0.5, 1);
  }
  @keyframes lastpop {
    from {
      transform: scale(0.4);
    }
  }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }
  .hist {
    display: flex;
    gap: 3px;
    flex-wrap: wrap;
    max-height: 48px;
    overflow: hidden;
  }
  .h {
    font-size: 11px;
    font-weight: 800;
    min-width: 22px;
    text-align: center;
    padding: 2px 4px;
    border-radius: 999px;
    background: #18181d;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.25);
  }
  .h.red {
    background: #c8102e;
  }
  .h.green {
    background: #12a061;
  }
  .h:first-child {
    box-shadow: 0 0 0 2px #ffd76a;
  }

  /* ---------- the layout, printed on the felt ---------- */
  .layout {
    display: grid;
    gap: 4px;
    overflow-x: auto;
    padding: 8px 4px;
  }
  .board {
    display: grid;
    grid-template-columns: 38px 1fr;
    gap: 0;
    min-width: 330px;
  }
  .nums {
    display: grid;
    grid-template-columns: repeat(13, minmax(24px, 1fr));
  }
  .spotbtn {
    position: relative;
    min-height: 40px;
    padding: 0;
    background: transparent;
    color: #fff;
    font-weight: 800;
    font-size: 13px;
    border: 1px solid rgba(255, 244, 210, 0.75);
    margin: 0 -1px -1px 0;
    display: grid;
    place-items: center;
    transition: background 150ms;
  }
  .spotbtn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.12);
  }
  .spotbtn:focus-visible {
    outline: 3px solid #ffe39a;
    outline-offset: -3px;
    z-index: 2;
  }
  .spotbtn:disabled {
    cursor: default;
    opacity: 1;
  }
  .n .lab {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    font-size: 12px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
  }
  .n.red .lab {
    background: #c8102e;
  }
  .n.black .lab {
    background: #18181d;
  }
  .zero {
    border-radius: 50% 0 0 50% / 30% 0 0 30%;
    background: rgba(18, 160, 97, 0.55);
  }
  .zero .lab {
    background: #12a061;
  }
  .n.col .lab {
    font-size: 11px;
    background: none;
    box-shadow: none;
  }
  .spotbtn.win {
    background: radial-gradient(circle, rgba(255, 230, 120, 0.7), rgba(255, 200, 50, 0.25));
    animation: winspot 0.9s ease-in-out 3;
    z-index: 1;
  }
  .n.spotbtn.win .lab {
    box-shadow:
      0 0 0 2px #fff3b0,
      0 0 14px 4px rgba(255, 215, 90, 0.95);
  }
  @keyframes winspot {
    50% {
      background: rgba(255, 240, 170, 0.35);
    }
  }
  .chipon {
    position: absolute;
    z-index: 1;
    right: -6px;
    top: -8px;
    filter: drop-shadow(0 2px 0 rgba(0, 0, 0, 0.5));
    animation: chipdrop 260ms cubic-bezier(0.3, 1.5, 0.5, 1);
  }
  .spotbtn.win .chipon {
    animation: chipwin 0.6s ease-in-out infinite alternate;
  }
  @keyframes chipdrop {
    from {
      transform: translateY(-10px) scale(1.3);
      opacity: 0;
    }
  }
  @keyframes chipwin {
    to {
      transform: translateY(-4px);
      filter: drop-shadow(0 0 6px #ffd76a);
    }
  }
  .outs {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    margin-left: 38px;
    min-width: 292px;
  }
  .outs.six {
    grid-template-columns: repeat(6, 1fr);
  }
  .o {
    font-family: Georgia, serif;
    font-size: 12px;
    letter-spacing: 0.04em;
  }
  .o.red .lab,
  .o.black .lab {
    width: 22px;
    height: 14px;
    transform: rotate(45deg) scale(0.9, 1.4);
    border-radius: 2px;
    background: #c8102e;
    box-shadow: 0 0 0 1px #fff;
  }
  .o.black .lab {
    background: #18181d;
  }

  /* ---------- controls ---------- */
  .rack {
    display: flex;
    gap: 4px;
    padding: 4px 8px 6px;
    border-radius: 12px;
    background: linear-gradient(180deg, #5a3616, #3a220c);
    box-shadow:
      inset 0 2px 5px rgba(0, 0, 0, 0.55),
      inset 0 0 0 1px rgba(231, 184, 74, 0.55);
  }
  .chipbtn {
    padding: 0;
    background: none;
    border: 0;
    border-radius: 50%;
    display: grid;
    transition: transform 160ms var(--spring);
    filter: drop-shadow(0 2px 0 rgba(0, 0, 0, 0.45));
  }
  .chipbtn:hover {
    transform: translateY(-3px) rotate(-8deg);
  }
  .chipbtn.on {
    transform: translateY(-5px);
    filter: drop-shadow(0 0 6px rgba(255, 215, 106, 0.95)) drop-shadow(0 3px 0 rgba(0, 0, 0, 0.45));
  }
  .chipbtn:focus-visible {
    outline: 3px solid var(--accent);
    outline-offset: 2px;
  }
  .muted {
    color: var(--text-muted);
    font-size: 13px;
  }
  .grow {
    flex: 1;
  }
  @media (max-width: 720px) {
    .roul {
      grid-template-columns: 1fr;
    }
    .wheelside {
      grid-template-columns: auto 1fr;
      align-items: center;
    }
    .wheel {
      width: min(200px, 48vw);
    }
    .readout {
      flex-direction: column;
      align-items: flex-start;
    }
  }
  @media (max-width: 520px) {
    .roul {
      padding: 12px 8px;
    }
    .layout {
      padding: 8px 0;
    }
    .board {
      grid-template-columns: 26px 1fr;
      min-width: 0;
    }
    .nums {
      grid-template-columns: repeat(13, minmax(20px, 1fr));
    }
    .n .lab {
      width: 20px;
      height: 20px;
      font-size: 10px;
    }
    .n.col .lab {
      font-size: 9px;
    }
    .spotbtn {
      min-height: 34px;
    }
    .outs {
      margin-left: 26px;
      min-width: 0;
    }
    .o {
      font-size: 10px;
    }
    .chipon {
      right: -4px;
      top: -6px;
      transform: scale(0.85);
    }
  }
</style>
