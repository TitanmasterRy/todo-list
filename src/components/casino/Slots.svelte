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
  <div class="cz-table slots" class:jackpot={result?.win}>
    <div class="marquee" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div>
    <div class="reels" aria-live="polite" aria-label="Reels: {reels.map((i) => symbols[i]).join(' ')}">
      {#each reels as i, k (k)}<div class="reel" class:spin={spinning} class:lit={result?.win}><span class="sym">{symbols[i]}</span></div>{/each}
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
  .slots {
    padding-top: 26px;
  }
  /* a row of marquee bulbs along the top of the cabinet; they chase after a win */
  .marquee {
    position: absolute;
    top: 8px;
    left: 16px;
    right: 16px;
    display: flex;
    justify-content: space-between;
  }
  .marquee span {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: rgba(255, 224, 102, 0.35);
    box-shadow: inset 0 0 2px rgba(0, 0, 0, 0.4);
  }
  .jackpot .marquee span {
    animation: bulb 600ms ease-in-out infinite;
  }
  .jackpot .marquee span:nth-child(even) {
    animation-delay: 300ms;
  }
  @keyframes bulb {
    0%,
    100% {
      background: rgba(255, 224, 102, 0.35);
      box-shadow: none;
    }
    50% {
      background: #ffe066;
      box-shadow: 0 0 10px #ffe066;
    }
  }
  .reels {
    display: flex;
    gap: 10px;
    justify-content: center;
    padding: 10px;
    border-radius: 16px;
    background: linear-gradient(180deg, #1a1a1f, #2a2a33);
    box-shadow:
      inset 0 2px 8px rgba(0, 0, 0, 0.6),
      0 0 0 3px #f5c542,
      0 0 0 5px #4a2a12;
    width: fit-content;
    margin: 0 auto;
  }
  .reel {
    position: relative;
    width: 86px;
    height: 104px;
    border-radius: 12px;
    background: linear-gradient(180deg, #d9d9d9 0%, #ffffff 30%, #ffffff 70%, #cfcfcf 100%);
    color: #111;
    font-size: 52px;
    display: grid;
    place-items: center;
    overflow: hidden;
    box-shadow:
      inset 0 10px 14px -8px rgba(0, 0, 0, 0.45),
      inset 0 -10px 14px -8px rgba(0, 0, 0, 0.45);
    transition: box-shadow var(--dur-slow);
  }
  .reel::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    top: 50%;
    height: 2px;
    margin-top: -1px;
    background: rgba(214, 48, 49, 0.35);
    pointer-events: none;
  }
  .reel.spin .sym {
    filter: blur(1.5px);
    animation: reel-roll 120ms linear infinite;
  }
  @keyframes reel-roll {
    from {
      transform: translateY(-14px);
    }
    to {
      transform: translateY(14px);
    }
  }
  .reel.lit {
    box-shadow:
      inset 0 10px 14px -8px rgba(0, 0, 0, 0.45),
      inset 0 -10px 14px -8px rgba(0, 0, 0, 0.45),
      0 0 24px #ffe066;
  }
  .reel.lit .sym {
    animation: bump 600ms var(--spring);
  }
  .sym {
    display: inline-block;
    filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.2));
  }
  .slots .cz-result {
    text-align: center;
    font-size: 20px;
  }
</style>
