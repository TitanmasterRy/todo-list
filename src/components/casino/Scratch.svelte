<script lang="ts">
  import { economy } from '../../lib/economy.svelte';
  import { makeScratchCard, scratchPrizeFor, SCRATCH_SYMBOLS } from '../../lib/casino/quick';
  import { playSound } from '../../lib/sounds';

  const PRICES = [10, 50, 100, 500];
  let price = $state(10);
  let card = $state<{ cells: string[]; mult: number } | null>(null);
  let shown = $state<boolean[]>([]);
  let paid = $state(false);
  let result = $state<{ text: string; win: boolean } | null>(null);

  function buy() {
    if (!economy.bet('scratch', price)) return;
    card = makeScratchCard();
    shown = Array(9).fill(false);
    paid = false;
    result = null;
  }
  function scratch(i: number) {
    if (!card || shown[i]) return;
    shown = shown.map((s, j) => s || j === i);
    playSound('tick');
    if (shown.every(Boolean)) settle();
  }
  function revealAll() {
    shown = Array(9).fill(true);
    settle();
  }
  function settle() {
    if (!card || paid) return;
    paid = true;
    const won = price * card.mult;
    economy.payout('scratch', won);
    result = won ? { text: `Match three! ×${card.mult} · ${won.toLocaleString()} chips`, win: true } : { text: 'No match this time', win: false };
    if (won) playSound('pop');
  }
</script>

<div class="cz-game">
  <div class="cz-table">
    {#if card}
      <div class="cz-grid" style="grid-template-columns: repeat(3, 1fr); max-width: 280px; margin: 0 auto; width: 100%">
        {#each card.cells as c, i (i)}
          <button class="cz-tile cell" class:scratched={shown[i]} onclick={() => scratch(i)} aria-label={shown[i] ? c : 'Scratch'}>{shown[i] ? c : '✨'}</button>
        {/each}
      </div>
    {:else}
      <p>Buy a card, then tap each square to scratch it. Three of a symbol wins its prize.</p>
    {/if}
    <div class="cz-result" aria-live="polite" class:win={result?.win} class:lose={result && !result.win}>{result?.text ?? ''}</div>
  </div>
  <div class="cz-actions">
    <div class="cz-seg">
      {#each PRICES as p (p)}<button class:on={price === p} onclick={() => (price = p)} disabled={!!card && !paid}>{p}</button>{/each}
    </div>
    {#if card && !paid}
      <button class="btn" onclick={revealAll}>Reveal all</button>
    {:else}
      <button class="btn primary" onclick={buy} disabled={price > economy.wallet.chips}>Buy card ({price})</button>
    {/if}
  </div>
  <div class="cz-paytable">
    {#each SCRATCH_SYMBOLS.slice(0, 6) as s (s)}<span>{s}{s}{s}</span><span>×{scratchPrizeFor(s)}</span>{/each}
  </div>
  <p class="cz-edge">About 90% return.</p>
</div>

<style>
  .cell {
    font-size: 32px;
    background: linear-gradient(135deg, #b2bec3, #dfe6e9);
    color: #636e72;
  }
  .cell.scratched {
    background: #fff;
    color: #111;
  }
</style>
