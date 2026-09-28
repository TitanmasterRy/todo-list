<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { economy } from '../../lib/economy.svelte';
  import { dropPlinko, PLINKO_ROWS, PLINKO_TABLE, type PlinkoRisk } from '../../lib/casino/quick';
  import BetControl from './BetControl.svelte';
  import WinFx from './WinFx.svelte';
  import { reduced, wait } from './fx';
  import { sfx } from './sfx';

  let bet = $state(10);
  let risk = $state<PlinkoRisk>('medium');
  let lastWin = $state<{ mult: number; amount: number } | null>(null);
  let recent = $state<{ id: number; mult: number }[]>([]);
  let glow = $state<{ bucket: number; id: number } | null>(null);
  let fx = $state<WinFx>();
  let canvas = $state<HTMLCanvasElement>();
  let nextId = 1;

  // board geometry (logical units; the canvas scales to its width)
  const W = 360;
  const H = 300;
  const gap = W / (PLINKO_ROWS + 2);
  const rowH = (H - 40) / PLINKO_ROWS;
  const PEG_R = 3.2;
  const BALL_R = 6.5;
  const pegs = Array.from({ length: PLINKO_ROWS }, (_, r) => Array.from({ length: r + 3 }, (_, i) => ({ x: W / 2 + (i - (r + 2) / 2) * gap, y: 20 + r * rowH, hit: 0 })));

  interface Ball {
    id: number;
    xs: number[]; // x at each peg contact
    t0: number;
    seg: number;
    trail: { x: number; y: number }[];
    lastSeg: number;
    hue: number;
  }
  let balls: Ball[] = [];
  let raf = 0;
  let scale = 1;
  let dpr = 1;
  let ro: ResizeObserver | undefined;

  function resize() {
    if (!canvas) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth || W;
    scale = w / W;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(H * scale * dpr);
    draw(performance.now());
  }
  onMount(() => {
    resize();
    ro = new ResizeObserver(resize);
    if (canvas) ro.observe(canvas);
  });
  onDestroy(() => {
    cancelAnimationFrame(raf);
    ro?.disconnect();
  });

  const FIRST = 170;
  function pos(b: Ball, now: number): { x: number; y: number; seg: number; done: boolean } {
    const t = now - b.t0;
    const contactY = (r: number) => 20 + r * rowH - PEG_R - BALL_R + 1;
    if (t < FIRST) {
      const k = t / FIRST;
      return { x: W / 2, y: -8 + (contactY(0) + 8) * k * k, seg: -1, done: false };
    }
    const s = (t - FIRST) / b.seg;
    const k = Math.floor(s);
    const f = s - k;
    if (k >= PLINKO_ROWS) return { x: b.xs[PLINKO_ROWS], y: H + 4, seg: PLINKO_ROWS, done: true };
    const x0 = b.xs[k];
    const x1 = b.xs[k + 1];
    const y0 = contactY(k);
    const y1 = k + 1 >= PLINKO_ROWS ? H + 4 : contactY(k + 1);
    const ex = 1 - (1 - f) ** 2;
    return { x: x0 + (x1 - x0) * ex, y: y0 + (y1 - y0) * f * f - rowH * 0.42 * Math.sin(Math.PI * f) * (1 - f * 0.4), seg: k, done: false };
  }

  function draw(now: number) {
    const c = canvas?.getContext('2d');
    if (!c || !canvas) return;
    c.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    c.clearRect(0, 0, W, H);
    let busy = false;
    for (const row of pegs)
      for (const p of row) {
        const lit = Math.max(0, 1 - (now - p.hit) / 380);
        if (lit > 0) {
          busy = true;
          c.beginPath();
          c.fillStyle = `rgba(255, 220, 110, ${0.45 * lit})`;
          c.arc(p.x, p.y, PEG_R + 7 * lit, 0, Math.PI * 2);
          c.fill();
        }
        c.beginPath();
        c.fillStyle = lit > 0 ? `rgb(255, ${235 - 20 * lit}, ${190 - 120 * lit})` : 'rgba(255,255,255,0.85)';
        c.arc(p.x, p.y, PEG_R, 0, Math.PI * 2);
        c.fill();
      }
    for (const b of balls) {
      const p = pos(b, now);
      if (p.seg !== b.lastSeg && p.seg >= 0 && p.seg < PLINKO_ROWS) {
        b.lastSeg = p.seg;
        const row = pegs[p.seg];
        const peg = row.reduce((best, q) => (Math.abs(q.x - b.xs[p.seg]) < Math.abs(best.x - b.xs[p.seg]) ? q : best), row[0]);
        peg.hit = now;
        sfx('peg', p.seg);
      }
      b.trail.push({ x: p.x, y: p.y });
      if (b.trail.length > 10) b.trail.shift();
      b.trail.forEach((q, i) => {
        const a = (i + 1) / b.trail.length;
        c.beginPath();
        c.fillStyle = `hsla(${b.hue}, 100%, 65%, ${0.28 * a})`;
        c.arc(q.x, q.y, BALL_R * (0.4 + 0.5 * a), 0, Math.PI * 2);
        c.fill();
      });
      const g = c.createRadialGradient(p.x - 2, p.y - 2.5, 1, p.x, p.y, BALL_R);
      g.addColorStop(0, '#fffbe0');
      g.addColorStop(0.45, `hsl(${b.hue}, 100%, 60%)`);
      g.addColorStop(1, `hsl(${b.hue - 10}, 90%, 35%)`);
      c.beginPath();
      c.shadowColor = `hsla(${b.hue}, 100%, 60%, 0.8)`;
      c.shadowBlur = 10;
      c.fillStyle = g;
      c.arc(p.x, p.y, BALL_R, 0, Math.PI * 2);
      c.fill();
      c.shadowBlur = 0;
      busy = true;
    }
    if (busy) raf = requestAnimationFrame(draw);
    else raf = 0;
  }

  async function drop() {
    if (!economy.bet('plinko', bet)) return;
    const table = PLINKO_TABLE[risk];
    const { path, bucket } = dropPlinko();
    const amount = bet;
    const xs = [W / 2];
    for (let r = 0; r < PLINKO_ROWS; r++) xs.push(xs[r] + (path[r] ? 0.5 : -0.5) * gap);
    const seg = 105;
    const total = FIRST + seg * PLINKO_ROWS;
    const id = nextId++;
    sfx('click');
    if (!reduced()) {
      balls.push({ id, xs, t0: performance.now(), seg, trail: [], lastSeg: -1, hue: 38 + ((id * 23) % 30) });
      if (!raf) raf = requestAnimationFrame(draw);
    }
    await wait(total);
    balls = balls.filter((b) => b.id !== id);
    const mult = table[bucket];
    const won = Math.floor(amount * mult);
    economy.payout('plinko', won);
    if (mult >= 10) economy.achieve('plinko-10');
    lastWin = { mult, amount: won };
    glow = { bucket, id };
    recent = [{ id, mult }, ...recent].slice(0, 6);
    sfx(mult >= 2 ? 'win' : mult >= 1 ? 'pop' : 'lose', bucket);
    if (won > amount * 3) fx?.show(won, amount);
  }
  const heat = (m: number) => (m >= 10 ? 'hot' : m >= 3 ? 'warm' : m >= 1.5 ? 'mid' : m >= 1 ? 'low' : 'cold');
</script>

<div class="cz-game">
  <div class="cz-table night board">
    <div class="wrap">
      <canvas bind:this={canvas} role="img" aria-label="Plinko board"></canvas>
      <div class="buckets" style="padding-inline:{(gap / 2 / W) * 100}%">
        {#each PLINKO_TABLE[risk] as m, i (i)}
          {#key glow?.bucket === i ? glow.id : 0}
            <span class="bk {heat(m)}" class:hit={glow?.bucket === i}>{m}×</span>
          {/key}
        {/each}
      </div>
    </div>
    <div class="recent" aria-hidden="true">
      {#each recent as r (r.id)}<span class="rc {heat(r.mult)}">{r.mult}×</span>{/each}
    </div>
    <div class="cz-result center" aria-live="polite" class:win={lastWin && lastWin.mult >= 1} class:lose={lastWin && lastWin.mult < 1}>
      {lastWin ? `×${lastWin.mult} · ${lastWin.amount.toLocaleString()} chips` : 'Drop a ball: every peg is a coin flip'}
    </div>
    <WinFx bind:this={fx} />
  </div>
  <div class="cz-deck">
    <div class="cz-seg" role="group" aria-label="Risk">
      {#each ['low', 'medium', 'high'] as const as r (r)}<button class:on={risk === r} aria-pressed={risk === r} onclick={() => (risk = r)}>{r}</button>{/each}
    </div>
    <BetControl bind:value={bet} />
    <div class="grow"></div>
    <button class="btn cz-go" onclick={drop} disabled={bet > economy.wallet.chips}>Drop ball</button>
  </div>
  <p class="cz-edge">12 rows; each peg sends the ball left or right. Higher risk means bigger edges and smaller middles. About 99% return on every risk level.</p>
</div>

<style>
  .board {
    grid-template-columns: 1fr auto;
    align-items: start;
  }
  .wrap {
    width: 100%;
    max-width: 520px;
    margin: 0 auto;
  }
  canvas {
    width: 100%;
    aspect-ratio: 360 / 300;
    display: block;
  }
  .buckets {
    display: grid;
    grid-template-columns: repeat(13, 1fr);
    gap: 2px;
    margin-top: 2px;
  }
  .bk {
    display: grid;
    place-items: center;
    height: 26px;
    border-radius: 5px;
    font-size: clamp(8px, 1.9vw, 11px);
    font-weight: 900;
    color: #1d1200;
    box-shadow:
      inset 0 -3px 0 rgba(0, 0, 0, 0.25),
      0 2px 4px rgba(0, 0, 0, 0.35);
    letter-spacing: -0.02em;
  }
  .hot {
    background: linear-gradient(180deg, #ff6b7f, #d6123a);
    color: #fff;
  }
  .warm {
    background: linear-gradient(180deg, #ffb35c, #f07a1a);
  }
  .mid {
    background: linear-gradient(180deg, #ffe07a, #f2b622);
  }
  .low {
    background: linear-gradient(180deg, #d8f58a, #9fd43a);
  }
  .cold {
    background: linear-gradient(180deg, #8fa3c8, #5a6f98);
    color: #fff;
  }
  .bk.hit {
    animation: land 700ms cubic-bezier(0.3, 1.5, 0.5, 1);
    box-shadow:
      0 0 0 2px #fff6c8,
      0 0 18px 4px rgba(255, 215, 90, 0.9);
  }
  @keyframes land {
    30% {
      transform: translateY(6px) scale(1.08);
    }
  }
  .recent {
    display: grid;
    gap: 4px;
    align-content: start;
    min-width: 48px;
  }
  .rc {
    font-size: 11px;
    font-weight: 900;
    padding: 4px 6px;
    border-radius: 6px;
    text-align: center;
    color: #1d1200;
    animation: slidein 300ms ease-out;
  }
  .rc.hot,
  .rc.cold {
    color: #fff;
  }
  @keyframes slidein {
    from {
      transform: translateY(-10px);
      opacity: 0;
    }
  }
  .board .cz-result {
    grid-column: 1 / -1;
  }
  .grow {
    flex: 1;
  }
  @media (max-width: 520px) {
    .board {
      grid-template-columns: 1fr;
    }
    .recent {
      display: flex;
      justify-content: center;
    }
    .bk {
      height: 22px;
      border-radius: 3px;
    }
  }
</style>
