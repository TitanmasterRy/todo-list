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
      <PlayingCard card={{ rank, suit: SUITS[suit] }} />
      <div class="trail">
        {#each trail.slice(-10) as r, i (i)}<span>{rankLabel(r)}</span>{/each}
      </div>
    </div>
    {#if active}<div class="mult">×{mult} · cash out now for {Math.floor(bet * mult).toLocaleString()}</div>{/if}
    <div class="cz-result" aria-live="polite" class:win={result?.win} class:lose={result && !result.win}>{result?.text ?? ''}</div>
  </div>
  <div class="cz-actions">
    {#if active}
      <button class="btn primary" onclick={() => guess('higher')} disabled={rank === 14}
        >Higher ×{hiloMultiplier(rank, 'higher')} <span class="p">{Math.round(hiloChance(rank, 'higher') * 100)}%</span></button
      >
      <button class="btn primary" onclick={() => guess('lower')} disabled={rank === 2}
        >Lower ×{hiloMultiplier(rank, 'lower')} <span class="p">{Math.round(hiloChance(rank, 'lower') * 100)}%</span></button
      >
      <button class="btn" onclick={cashOut} disabled={mult <= 1}>Cash out</button>
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
  .trail {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
    font-weight: 700;
    opacity: 0.85;
  }
  .trail span {
    background: rgba(0, 0, 0, 0.25);
    border-radius: 6px;
    padding: 2px 6px;
  }
  .mult {
    font-size: 18px;
    font-weight: 800;
    color: #ffe066;
  }
  .p {
    opacity: 0.7;
    font-size: 12px;
  }
</style>
