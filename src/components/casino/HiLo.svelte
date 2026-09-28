<script lang="ts">
  import { economy } from '../../lib/economy.svelte';
  import { drawRank, hiloChance, hiloMultiplier } from '../../lib/casino/quick';
  import { rankLabel, SUITS } from '../../lib/casino/cards';
  import { playSound } from '../../lib/sounds';
  import BetControl from './BetControl.svelte';
  import PlayingCard from './PlayingCard.svelte';

  let bet = $state(10);
  let active = $state(false);
  let rank = $state(8);
  let suit = $state(0);
  let mult = $state(1);
  let trail = $state<number[]>([]);
  let result = $state<{ text: string; win: boolean } | null>(null);

  function start() {
    if (!economy.bet('hi-lo', bet)) return;
    active = true;
    mult = 1;
    rank = drawRank();
    suit = Math.floor(Math.random() * 4);
    trail = [rank];
    result = null;
  }
  function guess(dir: 'higher' | 'lower') {
    const m = hiloMultiplier(rank, dir);
    const next = drawRank();
    const ok = dir === 'higher' ? next > rank : next < rank;
    rank = next;
    suit = Math.floor(Math.random() * 4);
    trail = [...trail, next];
    if (ok) {
      mult = Math.round(mult * m * 100) / 100;
      playSound('tick');
    } else {
      active = false;
      result = { text: `${rankLabel(next)}: wrong call. Lost ${bet}.`, win: false };
    }
  }
  function cashOut() {
    const won = Math.floor(bet * mult);
    economy.payout('hi-lo', won);
    if (mult >= 5) economy.achieve('hilo-5');
    active = false;
    result = { text: `Cashed out ×${mult} · ${won.toLocaleString()} chips`, win: won > bet };
    playSound('pop');
  }
</script>

<div class="cz-game">
  <div class="cz-table">
    <div class="cz-row">
      <div class="spot" class:live={active}>
        <span class="halo" aria-hidden="true"></span>
        {#key trail.length}<PlayingCard card={{ rank, suit: SUITS[suit] }} />{/key}
      </div>
      <div class="trail">
        {#each trail.slice(-10) as r, i (i)}<span style="animation-delay: {i * 20}ms">{rankLabel(r)}</span>{/each}
      </div>
    </div>
    {#if active}<div class="mult" class:hot={mult >= 3}>
        {#key mult}<span class="bump">×{mult}</span>{/key} · cash out now for {#key mult}<span class="bump">{Math.floor(bet * mult).toLocaleString()}</span>{/key}
      </div>{/if}
    <div class="cz-result" aria-live="polite" class:win={result?.win} class:lose={result && !result.win}>{result?.text ?? ''}</div>
  </div>
  <div class="cz-actions">
    {#if active}
      <button class="btn primary arrow up" onclick={() => guess('higher')} disabled={rank === 14}
        ><span class="glyph" aria-hidden="true">▲</span>Higher ×{hiloMultiplier(rank, 'higher')} <span class="p">{Math.round(hiloChance(rank, 'higher') * 100)}%</span></button
      >
      <button class="btn primary arrow down" onclick={() => guess('lower')} disabled={rank === 2}
        ><span class="glyph" aria-hidden="true">▼</span>Lower ×{hiloMultiplier(rank, 'lower')} <span class="p">{Math.round(hiloChance(rank, 'lower') * 100)}%</span></button
      >
      <button class="btn cash" class:hot={mult >= 3} onclick={cashOut} disabled={mult <= 1}>Cash out</button>
    {:else}
      <BetControl bind:value={bet} />
      <button class="btn primary" onclick={start} disabled={bet > economy.wallet.chips}>Start</button>
    {/if}
  </div>
  <p class="cz-edge">
    Guess whether the next card is strictly higher or lower (aces high, ties lose). Each correct call multiplies your winnings; cash out any time. 3% house edge per call.
  </p>
</div>

<style>
  /* the current card sits on a glowing spot */
  .spot {
    position: relative;
    display: grid;
    place-items: center;
    padding: 10px;
  }
  .halo {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255, 224, 102, 0.55), rgba(255, 224, 102, 0) 70%);
    opacity: 0.5;
    transition: opacity var(--dur-slow) var(--ease);
  }
  .spot.live .halo {
    opacity: 1;
    animation: float 2.4s ease-in-out infinite;
  }
  .trail {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .trail span {
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.15);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12);
    border-radius: 6px;
    padding: 2px 7px;
    animation: cz-pop 260ms var(--spring) backwards;
  }
  .trail span:last-child {
    background: var(--grad-gold);
    color: #3a2e00;
    border-color: #fff3b0;
    box-shadow: 0 0 10px rgba(255, 224, 102, 0.6);
  }
  /* the multiplier readout: a glossy pill that bumps on every correct call */
  .mult {
    justify-self: start;
    font-size: 16px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    color: #ffe066;
    padding: 6px 14px;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 224, 102, 0.45);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.15),
      0 0 12px rgba(255, 224, 102, 0.3);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
    transition: box-shadow var(--dur-slow);
  }
  .mult.hot {
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.15),
      0 0 24px rgba(255, 224, 102, 0.7);
  }
  .p {
    opacity: 0.8;
    font-size: 12px;
  }
  /* chunky arrow buttons: green up, red down, with a lift on hover */
  .arrow {
    font-size: 15px;
    padding: 12px 18px;
    border-radius: var(--radius);
    color: #fff;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.35),
      0 4px 0 rgba(0, 0, 0, 0.3),
      var(--shadow-sm);
    transition:
      transform var(--dur) var(--spring),
      box-shadow var(--dur),
      filter var(--dur);
  }
  .arrow.up {
    background: linear-gradient(180deg, #4ade80, #16a34a);
  }
  .arrow.down {
    background: linear-gradient(180deg, #f87171, #dc2626);
  }
  .arrow:not(:disabled):hover {
    transform: translateY(-3px);
    filter: brightness(1.08);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.35),
      0 7px 0 rgba(0, 0, 0, 0.3),
      var(--shadow);
  }
  .arrow:not(:disabled):active {
    transform: translateY(2px);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.35);
  }
  .glyph {
    font-size: 18px;
    margin-inline-end: 6px;
    filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.4));
  }
  .cash:not(:disabled) {
    transition:
      transform var(--dur) var(--spring),
      box-shadow var(--dur-slow);
  }
  .cash.hot:not(:disabled) {
    background: var(--grad-gold);
    color: #3a2e00;
    border-color: #fff3b0;
    animation: hl-gold 1.4s ease-in-out infinite;
  }
  @keyframes hl-gold {
    0%,
    100% {
      box-shadow: 0 0 8px rgba(255, 224, 102, 0.45);
    }
    50% {
      box-shadow: 0 0 24px rgba(255, 224, 102, 0.95);
    }
  }
</style>
