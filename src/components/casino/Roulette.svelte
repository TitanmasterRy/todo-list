<script lang="ts">
  import { economy } from '../../lib/economy.svelte';
  import { betKey, betLabel, color, settleRoulette, spinRoulette, type RouletteBet } from '../../lib/casino/roulette';
  import { playSound } from '../../lib/sounds';

  let chip = $state(10);
  let bets = $state<{ bet: RouletteBet; amount: number }[]>([]);
  let last = $state<number | null>(null);
  let history = $state<number[]>([]);
  let result = $state<{ text: string; win: boolean } | null>(null);
  let spinning = $state(false);
  const total = $derived(bets.reduce((a, b) => a + b.amount, 0));

  function place(bet: RouletteBet) {
    if (spinning || total + chip > economy.wallet.chips) return;
    const k = betKey(bet);
    const i = bets.findIndex((b) => betKey(b.bet) === k);
    if (i >= 0) bets = bets.map((b, j) => (j === i ? { ...b, amount: b.amount + chip } : b));
    else bets = [...bets, { bet, amount: chip }];
  }
  function on(bet: RouletteBet): number {
    return bets.find((b) => betKey(b.bet) === betKey(bet))?.amount ?? 0;
  }
  async function spin() {
    if (!bets.length || spinning || !economy.bet('roulette', total)) return;
    spinning = true;
    result = null;
    const n = spinRoulette();
    await new Promise((r) => setTimeout(r, 700));
    last = n;
    history = [n, ...history].slice(0, 12);
    const back = settleRoulette(bets, n);
    economy.payout('roulette', back);
    if (bets.some((b) => b.bet.kind === 'straight' && b.bet.n === n)) economy.achieve('straight-up');
    result = back > 0 ? { text: `${n} ${color(n)} · returned ${back.toLocaleString()}`, win: back > total } : { text: `${n} ${color(n)} · no win`, win: false };
    if (back > total) playSound('pop');
    spinning = false;
  }
  const rows = [3, 2, 1].map((r) => Array.from({ length: 12 }, (_, c) => c * 3 + r));
  const outside: RouletteBet[] = [{ kind: 'low' }, { kind: 'even' }, { kind: 'red' }, { kind: 'black' }, { kind: 'odd' }, { kind: 'high' }];
  const landed = $derived(!spinning && last !== null);
</script>

<div class="cz-game">
  <div class="cz-table">
    <div class="cz-row top">
      <div class="ballwrap" class:landed>
        <span class="ring" aria-hidden="true"></span>
        <div class="ball {last === null ? '' : color(last)}" class:spin={spinning} class:land={landed} aria-live="polite">{spinning ? '…' : (last ?? '?')}</div>
      </div>
      <div class="hist">
        {#each history as h, i (i)}<span class="h {color(h)}" style="animation-delay: {i * 25}ms">{h}</span>{/each}
      </div>
    </div>
    <div class="board" role="group" aria-label="Roulette table">
      <button class="n green zero" class:hitn={landed && last === 0} onclick={() => place({ kind: 'straight', n: 0 })}
        >0{#if on({ kind: 'straight', n: 0 })}<i>{on({ kind: 'straight', n: 0 })}</i>{/if}</button
      >
      <div class="nums">
        {#each rows as row, r (r)}
          {#each row as n (n)}
            <button class="n {color(n)}" class:hitn={landed && last === n} onclick={() => place({ kind: 'straight', n })}
              >{n}{#if on({ kind: 'straight', n })}<i>{on({ kind: 'straight', n })}</i>{/if}</button
            >
          {/each}
          <button class="n col" onclick={() => place({ kind: 'column', c: (3 - r) as 1 | 2 | 3 })}
            >2:1{#if on({ kind: 'column', c: (3 - r) as 1 | 2 | 3 })}<i>{on({ kind: 'column', c: (3 - r) as 1 | 2 | 3 })}</i>{/if}</button
          >
        {/each}
      </div>
    </div>
    <div class="outs">
      {#each [1, 2, 3] as d (d)}
        <button class="o" onclick={() => place({ kind: 'dozen', d: d as 1 | 2 | 3 })}
          >{betLabel({ kind: 'dozen', d: d as 1 | 2 | 3 })}{#if on({ kind: 'dozen', d: d as 1 | 2 | 3 })}<i>{on({ kind: 'dozen', d: d as 1 | 2 | 3 })}</i>{/if}</button
        >
      {/each}
    </div>
    <div class="outs six">
      {#each outside as b (b.kind)}
        <button class="o {b.kind}" onclick={() => place(b)}
          >{betLabel(b)}{#if on(b)}<i>{on(b)}</i>{/if}</button
        >
      {/each}
    </div>
    <div class="cz-result" class:win={result?.win} class:lose={result && !result.win}>{result?.text ?? ''}</div>
  </div>
  <div class="cz-actions">
    <span class="muted">Chip</span>
    <div class="cz-seg">
      {#each [5, 10, 25, 100, 500] as c (c)}<button class:on={chip === c} onclick={() => (chip = c)}>{c}</button>{/each}
    </div>
    <span class="muted">On the table: <strong class="tab">{total.toLocaleString()}</strong></span>
    <button class="btn ghost sm" onclick={() => (bets = [])} disabled={!bets.length || spinning}>Clear</button>
    <button class="btn primary" onclick={spin} disabled={!bets.length || spinning || total > economy.wallet.chips}>Spin</button>
  </div>
  <p class="cz-edge">
    European wheel (single zero): numbers pay 35:1, dozens and columns 2:1, even-money bets 1:1. House edge 2.7%. Tap a spot to place a chip; bets stay on for the next spin.
  </p>
</div>

<style>
  .top {
    align-items: center;
  }
  /* the wheel pocket: a dark rim ring around the ball */
  .ballwrap {
    position: relative;
    width: 72px;
    height: 72px;
    display: grid;
    place-items: center;
    flex: none;
  }
  .ring {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background:
      radial-gradient(circle at 50% 50%, transparent 58%, rgba(0, 0, 0, 0.45) 60%, rgba(0, 0, 0, 0.45) 72%, #6b3d1c 74%, #4a2a12 100%),
      repeating-conic-gradient(rgba(255, 255, 255, 0.12) 0 6deg, transparent 6deg 12deg);
    box-shadow:
      inset 0 0 0 1px rgba(245, 197, 66, 0.5),
      0 6px 14px -6px rgba(0, 0, 0, 0.7);
    transition: box-shadow var(--dur-slow) var(--ease);
  }
  .landed .ring {
    box-shadow:
      inset 0 0 0 1px rgba(245, 197, 66, 0.9),
      0 0 18px rgba(255, 224, 102, 0.55),
      0 6px 14px -6px rgba(0, 0, 0, 0.7);
  }
  .ball {
    position: relative;
    width: 52px;
    height: 52px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-weight: 800;
    font-size: 22px;
    font-variant-numeric: tabular-nums;
    background: radial-gradient(circle at 35% 30%, #fff, #d8d8d8 70%, #b5b5b5);
    color: #111;
    box-shadow:
      inset 0 -4px 8px rgba(0, 0, 0, 0.25),
      inset 0 2px 3px rgba(255, 255, 255, 0.8),
      0 4px 10px rgba(0, 0, 0, 0.45);
    transition:
      background var(--dur-slow),
      box-shadow var(--dur-slow);
  }
  .ball.red {
    background: radial-gradient(circle at 35% 30%, #ff7b6b, #c0392b 60%, #8e1f14);
    color: #fff;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  }
  .ball.black {
    background: radial-gradient(circle at 35% 30%, #5a5a5a, #1e1e1e 60%, #050505);
    color: #fff;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  }
  .ball.green {
    background: radial-gradient(circle at 35% 30%, #5ef0c8, #00a383 60%, #00664f);
    color: #fff;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  }
  .ball.spin {
    animation: rl-spin 0.32s linear infinite;
    filter: blur(0.4px);
  }
  .ball.land {
    animation: rl-land 900ms var(--spring) backwards;
  }
  @keyframes rl-spin {
    to {
      transform: rotate(360deg);
    }
  }
  /* decelerate out of the spin and settle with a glow */
  @keyframes rl-land {
    0% {
      transform: rotate(-540deg) scale(0.8);
    }
    60% {
      transform: rotate(-20deg) scale(1.15);
      box-shadow:
        inset 0 -4px 8px rgba(0, 0, 0, 0.25),
        0 0 28px rgba(255, 224, 102, 0.95),
        0 4px 10px rgba(0, 0, 0, 0.45);
    }
    100% {
      transform: rotate(0) scale(1);
    }
  }
  .hist {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }
  .h {
    font-size: 12px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    min-width: 24px;
    text-align: center;
    padding: 3px 7px;
    border-radius: 999px;
    background: linear-gradient(180deg, #3a3a3a, #1e1e1e);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.25),
      0 2px 4px rgba(0, 0, 0, 0.35);
    text-shadow: 0 1px 1px rgba(0, 0, 0, 0.5);
    animation: cz-pop 320ms var(--spring) backwards;
  }
  .h.red {
    background: linear-gradient(180deg, #e74c3c, #c0392b);
  }
  .h.green {
    background: linear-gradient(180deg, #2ecc9a, #00a383);
  }
  .hist .h:first-child {
    outline: 2px solid rgba(255, 224, 102, 0.9);
    outline-offset: 1px;
  }
  .board {
    display: grid;
    grid-template-columns: 40px 1fr;
    gap: 3px;
    overflow-x: auto;
    padding-top: 8px;
  }
  .nums {
    display: grid;
    grid-template-columns: repeat(13, minmax(28px, 1fr));
    gap: 3px;
  }
  .n,
  .o {
    position: relative;
    padding: 8px 0;
    border-radius: 5px;
    color: #fff;
    font-weight: 700;
    font-size: 13px;
    font-variant-numeric: tabular-nums;
    border: 1px solid rgba(255, 255, 255, 0.35);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.55);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.3),
      0 2px 0 rgba(0, 0, 0, 0.3);
    transition:
      transform var(--dur) var(--spring),
      box-shadow var(--dur),
      filter var(--dur);
  }
  .n:hover,
  .o:hover {
    transform: translateY(-2px);
    filter: brightness(1.12);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.35),
      0 4px 0 rgba(0, 0, 0, 0.3),
      0 6px 14px -4px rgba(0, 0, 0, 0.5);
    z-index: 1;
  }
  .n:active,
  .o:active {
    transform: translateY(1px);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.3);
  }
  .n.red,
  .o.red {
    background: linear-gradient(180deg, #e74c3c, #c0392b);
  }
  .n.black,
  .o.black {
    background: linear-gradient(180deg, #3a3a3a, #1e1e1e);
  }
  .n.green,
  .zero {
    background: linear-gradient(180deg, #1fc79b, #00a383);
  }
  .n.col,
  .o {
    background: linear-gradient(180deg, rgba(0, 0, 0, 0.22), rgba(0, 0, 0, 0.36));
  }
  /* the winning number pulses gold for a moment */
  .n.hitn {
    z-index: 2;
    animation: rl-hit 1.1s ease-in-out 3;
  }
  @keyframes rl-hit {
    0%,
    100% {
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.3),
        0 0 0 2px #ffe066,
        0 0 10px rgba(255, 224, 102, 0.5);
      transform: scale(1);
    }
    50% {
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.3),
        0 0 0 3px #fff3b0,
        0 0 26px rgba(255, 224, 102, 1);
      transform: scale(1.12);
    }
  }
  .outs {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 3px;
    margin-left: 43px;
  }
  .outs.six {
    grid-template-columns: repeat(6, 1fr);
  }
  /* a placed chip: gold, with an edge stripe and a drop shadow */
  i {
    position: absolute;
    top: -9px;
    right: -7px;
    min-width: 22px;
    height: 22px;
    display: grid;
    place-items: center;
    background: radial-gradient(circle at 50% 45%, #ffe08a 0 52%, #e0a020 54% 100%);
    color: #3a2e00;
    font-style: normal;
    font-weight: 800;
    font-size: 10px;
    font-variant-numeric: tabular-nums;
    border-radius: 999px;
    padding: 0 4px;
    border: 2px dashed rgba(255, 255, 255, 0.85);
    box-shadow:
      inset 0 0 0 2px #f5c542,
      0 2px 0 #9a6a00,
      0 4px 8px rgba(0, 0, 0, 0.45);
    text-shadow: none;
    z-index: 3;
    animation: cz-pop 260ms var(--spring);
  }
  .muted {
    color: var(--text-muted);
    font-size: 13px;
  }
  .tab {
    font-variant-numeric: tabular-nums;
  }
</style>
