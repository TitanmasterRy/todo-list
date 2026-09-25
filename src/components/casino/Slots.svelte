<script lang="ts">
  import { economy } from '../../lib/economy.svelte';
  import { store } from '../../lib/store.svelte';
  import { SLOT_PAY3, SLOT_PAY_TWO_CHERRIES, SLOT_SYMBOLS, SLOT_WEIGHTS, slotsRtp, spinSlots } from '../../lib/casino/slots';
  import { playSound } from '../../lib/sounds';
  import BetControl from './BetControl.svelte';

  let bet = $state(10);
  let reels = $state<[number, number, number]>([0, 1, 2]);
  let spinning = $state(false);
  let result = $state<{ text: string; win: boolean } | null>(null);
  const symbols = $derived(SLOT_SYMBOLS[store.settings.themePack] ?? SLOT_SYMBOLS.classic);

  async function spin() {
    if (spinning || !economy.bet('slots', bet)) return;
    spinning = true;
    result = null;
    const r = spinSlots();
    const reduced = store.settings.reducedMotion;
    if (!reduced) {
      // spin the reels, stopping one at a time
      for (let step = 0; step < 14; step++) {
        reels = [step < 6 ? rnd() : r.reels[0], step < 10 ? rnd() : r.reels[1], rnd()];
        await new Promise((res) => setTimeout(res, 60));
      }
    }
    reels = r.reels;
    const won = Math.floor(bet * r.multiplier);
    economy.payout('slots', won);
    result = won > 0 ? { text: `${r.line}! +${won.toLocaleString()} chips`, win: true } : { text: 'No win', win: false };
    if (won > 0) playSound(r.multiplier >= 50 ? 'levelup' : 'pop');
    spinning = false;
  }
  function rnd() {
    return Math.floor(Math.random() * SLOT_WEIGHTS.length);
  }
</script>

<div class="cz-game">
  <div class="cz-table slots">
    <div class="reels" aria-live="polite" aria-label="Reels: {reels.map((i) => symbols[i]).join(' ')}">
      {#each reels as i, k (k)}<div class="reel" class:spin={spinning}>{symbols[i]}</div>{/each}
    </div>
    <div class="cz-result" class:win={result?.win} class:lose={result && !result.win}>{result?.text ?? ''}</div>
  </div>
  <div class="cz-actions">
    <BetControl bind:value={bet} disabled={spinning} />
    <button class="btn primary" onclick={spin} disabled={spinning || bet > economy.wallet.chips}>{spinning ? 'Spinning…' : 'Spin'}</button>
  </div>
  <div class="cz-paytable">
    {#each SLOT_PAY3 as m, i (i)}<span>{symbols[i]}{symbols[i]}{symbols[i]}</span><span>×{m}</span>{/each}
    <span>{symbols[0]}{symbols[0]} any</span><span>×{SLOT_PAY_TWO_CHERRIES}</span>
  </div>
  <p class="cz-edge">Returns {(slotsRtp() * 100).toFixed(1)}% on average. Symbols follow your theme pack.</p>
</div>

<style>
  .reels {
    display: flex;
    gap: 10px;
    justify-content: center;
  }
  .reel {
    width: 86px;
    height: 100px;
    border-radius: 12px;
    background: #fff;
    color: #111;
    font-size: 52px;
    display: grid;
    place-items: center;
    box-shadow: inset 0 -8px 16px rgba(0, 0, 0, 0.15);
  }
  .reel.spin {
    filter: blur(1px);
  }
  .slots .cz-result {
    text-align: center;
  }
</style>
