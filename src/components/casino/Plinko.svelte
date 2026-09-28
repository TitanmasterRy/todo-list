<script lang="ts">
  import { economy } from '../../lib/economy.svelte';
  import { store } from '../../lib/store.svelte';
  import { dropPlinko, PLINKO_ROWS, PLINKO_TABLE, type PlinkoRisk } from '../../lib/casino/quick';
  import { playSound } from '../../lib/sounds';
  import BetControl from './BetControl.svelte';

  let bet = $state(10);
  let risk = $state<PlinkoRisk>('medium');
  let balls = $state<{ id: number; x: number; y: number; bucket?: number }[]>([]);
  let lastBucket = $state<number | null>(null);
  let lastWin = $state<{ mult: number; amount: number } | null>(null);
  let nextId = 1;
  const W = 360;
  const H = 300;
  const gap = W / (PLINKO_ROWS + 2);
  const rowH = (H - 40) / PLINKO_ROWS;

  async function drop() {
    if (!economy.bet('plinko', bet)) return;
    const table = PLINKO_TABLE[risk];
    const { path, bucket } = dropPlinko();
    const id = nextId++;
    const amount = bet;
    let x = W / 2;
    balls = [...balls, { id, x, y: 8 }];
    const fast = store.settings.reducedMotion;
    for (let r = 0; r < PLINKO_ROWS; r++) {
      x += (path[r] ? 0.5 : -0.5) * gap;
      if (!fast) {
        balls = balls.map((b) => (b.id === id ? { ...b, x, y: 20 + (r + 1) * rowH } : b));
        await new Promise((res) => setTimeout(res, 70));
      }
    }
    balls = balls.filter((b) => b.id !== id);
    const mult = table[bucket];
    const won = Math.floor(amount * mult);
    economy.payout('plinko', won);
    if (mult >= 10) economy.achieve('plinko-10');
    lastBucket = bucket;
    lastWin = { mult, amount: won };
    if (mult >= 2) playSound('pop');
  }
  const pegs = Array.from({ length: PLINKO_ROWS }, (_, r) => Array.from({ length: r + 3 }, (_, i) => ({ x: W / 2 + (i - (r + 2) / 2) * gap, y: 20 + r * rowH })));
</script>

<div class="cz-game">
  <div class="cz-table board">
    <svg viewBox="0 0 {W} {H + 30}" role="img" aria-label="Plinko board">
      <defs>
        <filter id="pk-glow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="1.6" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <radialGradient id="pk-ball" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stop-color="#fff6c8" />
          <stop offset="45%" stop-color="#ffe066" />
          <stop offset="100%" stop-color="#d99a10" />
        </radialGradient>
        <linearGradient id="pk-hi" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#ff8f7a" />
          <stop offset="100%" stop-color="#d94b32" />
        </linearGradient>
        <linearGradient id="pk-mid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#ffe08a" />
          <stop offset="100%" stop-color="#e0a020" />
        </linearGradient>
        <linearGradient id="pk-lo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="rgba(255,255,255,0.35)" />
          <stop offset="100%" stop-color="rgba(255,255,255,0.15)" />
        </linearGradient>
      </defs>
      {#each pegs as row, r (r)}{#each row as p, i (i)}<circle class="peg" cx={p.x} cy={p.y} r="3" />{/each}{/each}
      {#each balls as b (b.id)}
        <circle class="trail" cx={b.x} cy={b.y} r="10" aria-hidden="true" />
        <circle class="ball" cx={b.x} cy={b.y} r="7" />
      {/each}
      {#each PLINKO_TABLE[risk] as m, i (i)}
        <g transform="translate({W / 2 + (i - PLINKO_ROWS / 2) * gap - gap / 2 + 1}, {H})">
          <rect class="bk" class:hi={m >= 3} class:mid={m >= 1 && m < 3} class:lo={m < 1} class:lit={lastBucket === i} width={gap - 2} height="24" rx="5" />
          <text class="bt" class:dark={m >= 1} x={(gap - 2) / 2} y="16" text-anchor="middle" font-size="9" font-weight="700">{m}×</text>
        </g>
      {/each}
    </svg>
    <div class="cz-result" aria-live="polite" class:win={lastWin && lastWin.mult >= 1} class:lose={lastWin && lastWin.mult < 1}>
      {lastWin ? `×${lastWin.mult} · ${lastWin.amount.toLocaleString()} chips` : ''}
    </div>
  </div>
  <div class="cz-actions">
    <div class="cz-seg">
      {#each ['low', 'medium', 'high'] as const as r (r)}<button class:on={risk === r} onclick={() => (risk = r)}>{r}</button>{/each}
    </div>
    <BetControl bind:value={bet} />
    <button class="btn primary" onclick={drop} disabled={bet > economy.wallet.chips}>Drop ball</button>
  </div>
  <p class="cz-edge">12 rows; each peg sends the ball left or right. Higher risk means bigger edges and smaller middles. About 99% return on every risk level.</p>
</div>

<style>
  .board svg {
    width: 100%;
    max-width: 480px;
    margin: 0 auto;
    display: block;
    overflow: visible;
  }
  .peg {
    fill: rgba(255, 255, 255, 0.85);
    filter: url(#pk-glow);
  }
  /* the ball is glossy gold; the trail is a bigger, fainter copy that lags a beat behind */
  .ball {
    fill: url(#pk-ball);
    filter: drop-shadow(0 0 4px rgba(255, 224, 102, 0.9)) drop-shadow(0 2px 2px rgba(0, 0, 0, 0.4));
    transition:
      cx 70ms linear,
      cy 70ms linear;
  }
  .trail {
    fill: rgba(255, 224, 102, 0.28);
    transition:
      cx 150ms linear,
      cy 150ms linear;
  }
  .bk {
    stroke: rgba(255, 255, 255, 0.35);
    stroke-width: 0.6;
    transform-box: fill-box;
    transform-origin: center;
    transition: filter var(--dur);
  }
  .bk.hi {
    fill: url(#pk-hi);
  }
  .bk.mid {
    fill: url(#pk-mid);
  }
  .bk.lo {
    fill: url(#pk-lo);
  }
  .bk.lit {
    animation: pk-flash 700ms var(--spring);
    filter: drop-shadow(0 0 8px rgba(255, 224, 102, 1));
  }
  @keyframes pk-flash {
    0% {
      transform: scaleY(0.6);
      fill: #fff;
    }
    40% {
      transform: scaleY(1.25);
      fill: #ffe066;
    }
    100% {
      transform: scaleY(1);
    }
  }
  .bt {
    fill: #fff;
    font-variant-numeric: tabular-nums;
    paint-order: stroke;
    stroke: rgba(0, 0, 0, 0.35);
    stroke-width: 1.5;
    pointer-events: none;
  }
  .bt.dark {
    fill: #2a1d00;
    stroke: rgba(255, 255, 255, 0.35);
  }
  .board .cz-result {
    text-align: center;
  }
</style>
