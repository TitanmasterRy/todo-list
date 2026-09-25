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
    result = back > 0 ? { text: `${n} ${color(n)} · returned ${back.toLocaleString()}`, win: back > total } : { text: `${n} ${color(n)} · no win`, win: false };
    if (back > total) playSound('pop');
    spinning = false;
  }
  const rows = [3, 2, 1].map((r) => Array.from({ length: 12 }, (_, c) => c * 3 + r));
  const outside: RouletteBet[] = [{ kind: 'low' }, { kind: 'even' }, { kind: 'red' }, { kind: 'black' }, { kind: 'odd' }, { kind: 'high' }];
</script>

<div class="cz-game">
  <div class="cz-table">
    <div class="cz-row">
      <div class="ball {last === null ? '' : color(last)}" class:spin={spinning} aria-live="polite">{spinning ? '…' : (last ?? '?')}</div>
      <div class="hist">
        {#each history as h, i (i)}<span class="h {color(h)}">{h}</span>{/each}
      </div>
    </div>
    <div class="board" role="group" aria-label="Roulette table">
      <button class="n green zero" onclick={() => place({ kind: 'straight', n: 0 })}
        >0{#if on({ kind: 'straight', n: 0 })}<i>{on({ kind: 'straight', n: 0 })}</i>{/if}</button
      >
      <div class="nums">
        {#each rows as row, r (r)}
          {#each row as n (n)}
            <button class="n {color(n)}" onclick={() => place({ kind: 'straight', n })}
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
    <span class="muted">On the table: <strong>{total.toLocaleString()}</strong></span>
    <button class="btn ghost sm" onclick={() => (bets = [])} disabled={!bets.length || spinning}>Clear</button>
    <button class="btn primary" onclick={spin} disabled={!bets.length || spinning || total > economy.wallet.chips}>Spin</button>
  </div>
  <p class="cz-edge">
    European wheel (single zero): numbers pay 35:1, dozens and columns 2:1, even-money bets 1:1. House edge 2.7%. Tap a spot to place a chip; bets stay on for the next spin.
  </p>
</div>

<style>
  .ball {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-weight: 800;
    font-size: 22px;
    background: #fff;
    color: #111;
  }
  .ball.red {
    background: #d63031;
    color: #fff;
  }
  .ball.black {
    background: #111;
    color: #fff;
  }
  .ball.green {
    background: #00b894;
    color: #fff;
  }
  .ball.spin {
    animation: spin 0.35s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  .hist {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }
  .h {
    font-size: 12px;
    padding: 2px 6px;
    border-radius: 6px;
    background: #111;
  }
  .h.red {
    background: #d63031;
  }
  .h.green {
    background: #00b894;
  }
  .board {
    display: grid;
    grid-template-columns: 40px 1fr;
    gap: 3px;
    overflow-x: auto;
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
    border-radius: 4px;
    color: #fff;
    font-weight: 700;
    font-size: 13px;
    border: 1px solid rgba(255, 255, 255, 0.35);
  }
  .n.red {
    background: #c0392b;
  }
  .n.black {
    background: #1e1e1e;
  }
  .n.green,
  .zero {
    background: #00a383;
  }
  .n.col,
  .o {
    background: rgba(0, 0, 0, 0.2);
  }
  .o.red {
    background: #c0392b;
  }
  .o.black {
    background: #1e1e1e;
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
  i {
    position: absolute;
    top: -8px;
    right: -6px;
    background: #ffe066;
    color: #3a2e00;
    font-style: normal;
    font-size: 10px;
    border-radius: 999px;
    padding: 1px 5px;
    z-index: 1;
  }
  .muted {
    color: var(--text-muted);
    font-size: 13px;
  }
</style>
