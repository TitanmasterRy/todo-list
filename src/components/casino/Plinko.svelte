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
    lastBucket = bucket;
    lastWin = { mult, amount: won };
    if (mult >= 2) playSound('pop');
  }
  const pegs = Array.from({ length: PLINKO_ROWS }, (_, r) => Array.from({ length: r + 3 }, (_, i) => ({ x: W / 2 + (i - (r + 2) / 2) * gap, y: 20 + r * rowH })));
</script>

<div class="cz-game">
  <div class="cz-table board">
    <svg viewBox="0 0 {W} {H + 30}" role="img" aria-label="Plinko board">
      {#each pegs as row, r (r)}{#each row as p, i (i)}<circle cx={p.x} cy={p.y} r="3" fill="rgba(255,255,255,0.7)" />{/each}{/each}
      {#each balls as b (b.id)}<circle cx={b.x} cy={b.y} r="7" fill="#ffe066" style="transition: cx 70ms linear, cy 70ms linear" />{/each}
      {#each PLINKO_TABLE[risk] as m, i (i)}
        <g transform="translate({W / 2 + (i - PLINKO_ROWS / 2) * gap - gap / 2 + 1}, {H})">
          <rect width={gap - 2} height="24" rx="4" fill={lastBucket === i ? '#ffe066' : m >= 3 ? '#e17055' : m >= 1 ? '#fdcb6e' : 'rgba(255,255,255,0.25)'} />
          <text x={(gap - 2) / 2} y="16" text-anchor="middle" font-size="9" font-weight="700" fill="#222">{m}×</text>
        </g>
      {/each}
    </svg>
    <div class="cz-result" aria-live="polite" class:win={lastWin && lastWin.mult >= 1} class:lose={lastWin && lastWin.mult < 1}>{lastWin ? `×${lastWin.mult} · ${lastWin.amount.toLocaleString()} chips` : ''}</div>
  </div>
  <div class="cz-actions">
    <div class="cz-seg">{#each ['low', 'medium', 'high'] as const as r (r)}<button class:on={risk === r} onclick={() => (risk = r)}>{r}</button>{/each}</div>
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
  }
  .board .cz-result {
    text-align: center;
  }
</style>
