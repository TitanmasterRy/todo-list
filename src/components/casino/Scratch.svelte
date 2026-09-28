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
  // the symbol that appears three times, so the winning cells can glow once the card is settled
  const winSym = $derived(card && paid && card.mult > 0 ? (card.cells.find((c) => card!.cells.filter((x) => x === c).length >= 3) ?? null) : null);
</script>

<div class="cz-game">
  <div class="cz-table">
    {#if card}
      <div class="foil" class:done={paid}>
        <span class="holo" aria-hidden="true"></span>
        <div class="cz-grid" style="grid-template-columns: repeat(3, 1fr)">
          {#each card.cells as c, i (i)}
            <button
              class="cz-tile cell"
              class:scratched={shown[i]}
              class:cz-pop={shown[i]}
              class:gold={shown[i] && c === winSym}
              onclick={() => scratch(i)}
              aria-label={shown[i] ? c : 'Scratch'}>{shown[i] ? c : '✨'}</button
            >
          {/each}
        </div>
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
  /* the card: brushed silver with a faint holographic rainbow sweeping across it */
  .foil {
    position: relative;
    max-width: 280px;
    margin: 0 auto;
    width: 100%;
    padding: 10px;
    border-radius: var(--radius);
    background: linear-gradient(160deg, #e9edf1 0%, #b9c2cb 35%, #eef1f4 55%, #a7b1bb 100%);
    border: 1px solid rgba(255, 255, 255, 0.85);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.9),
      0 10px 24px -8px rgba(0, 0, 0, 0.6);
    overflow: hidden;
    animation: cz-pop 320ms var(--spring) backwards;
  }
  .holo {
    position: absolute;
    inset: -40%;
    background: conic-gradient(from 0deg, #ff6b6b, #ffd93d, #6bcb77, #4d96ff, #c77dff, #ff6b6b);
    opacity: 0.18;
    mix-blend-mode: color;
    animation: spin 14s linear infinite;
    pointer-events: none;
  }
  .foil.done .holo {
    opacity: 0.3;
  }
  .foil .cz-grid {
    position: relative;
  }
  .cell {
    font-size: 32px;
    background: linear-gradient(135deg, #cfd6dc, #f3f5f7 50%, #b8c1c9);
    color: #5b6672;
    border-color: rgba(255, 255, 255, 0.9);
    text-shadow: 0 1px 0 #fff;
  }
  .cell.scratched {
    background: linear-gradient(180deg, #ffffff, #f2f2ee);
    color: #111;
    text-shadow: none;
    cursor: default;
  }
  .cell.scratched:hover {
    transform: none;
  }
  /* the three matching symbols light up gold */
  .cell.gold {
    background: var(--grad-gold);
    border-color: #fff3b0;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.7),
      0 0 18px rgba(255, 224, 102, 0.85);
    animation: bump 480ms var(--spring);
  }
</style>
