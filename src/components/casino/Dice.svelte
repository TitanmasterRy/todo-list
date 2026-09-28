<script lang="ts">
  import { economy } from '../../lib/economy.svelte';
  import { diceChance, diceMultiplier, diceWins, rollPercent } from '../../lib/casino/quick';
  import { playSound } from '../../lib/sounds';
  import BetControl from './BetControl.svelte';

  let bet = $state(10);
  let target = $state(50);
  let mode = $state<'under' | 'over'>('under');
  let roll = $state<number | null>(null);
  let result = $state<{ text: string; win: boolean } | null>(null);
  const mult = $derived(diceMultiplier(target, mode));

  function play() {
    if (!economy.bet('dice', bet)) return;
    const r = rollPercent();
    roll = r;
    const win = diceWins(r, target, mode);
    const won = win ? Math.floor(bet * mult) : 0;
    economy.payout('dice', won);
    result = win ? { text: `${r.toFixed(2)} · win ${won.toLocaleString()}`, win: true } : { text: `${r.toFixed(2)} · no win`, win: false };
    if (win) playSound('pop');
  }
</script>

<div class="cz-game">
  <div class="cz-table">
    {#key roll}
      <div class="readout" class:win={result?.win} class:lose={result && !result.win} class:idle={roll === null} aria-hidden="true">
        {roll === null ? '00.00' : roll.toFixed(2)}
      </div>
    {/key}
    <div class="track" aria-hidden="true">
      <div class="zone" style={mode === 'under' ? `left:0;width:${target}%` : `left:${target}%;width:${100 - target}%`}></div>
      <div class="tick" style="left:{target}%"></div>
      {#key roll}
        {#if roll !== null}<div class="marker" class:win={result?.win} style="left:{roll}%">{roll.toFixed(1)}</div>{/if}
      {/key}
    </div>
    <input type="range" min="2" max="98" step="1" bind:value={target} aria-label="Target" />
    <div class="cz-row stats">
      <span class="pill">Roll {mode} <strong>{target}</strong></span>
      <span class="pill">Chance <strong>{(diceChance(target, mode) * 100).toFixed(0)}%</strong></span>
      <span class="pill gold">Pays <strong>×{mult}</strong></span>
    </div>
    <div class="cz-result" aria-live="polite" class:win={result?.win} class:lose={result && !result.win}>{result?.text ?? ''}</div>
  </div>
  <div class="cz-actions">
    <div class="cz-seg">
      <button class:on={mode === 'under'} onclick={() => (mode = 'under')}>Under</button><button class:on={mode === 'over'} onclick={() => (mode = 'over')}>Over</button>
    </div>
    <BetControl bind:value={bet} />
    <button class="btn primary" onclick={play} disabled={bet > economy.wallet.chips}>Roll</button>
  </div>
  <p class="cz-edge">A roll from 0.00 to 99.99. Pick your odds; the payout adjusts. 3% house edge.</p>
</div>

<style>
  /* the big number: bumps on every roll, gold on a win */
  .readout {
    justify-self: center;
    font-size: clamp(40px, 10vw, 60px);
    font-weight: 900;
    line-height: 1;
    letter-spacing: -0.03em;
    font-variant-numeric: tabular-nums;
    padding: 6px 22px;
    border-radius: var(--radius);
    background: rgba(0, 0, 0, 0.28);
    border: 1px solid rgba(255, 255, 255, 0.15);
    box-shadow:
      inset 0 2px 8px rgba(0, 0, 0, 0.45),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
    animation: bump 480ms var(--spring);
  }
  .readout.idle {
    opacity: 0.45;
    animation: none;
  }
  .readout.win {
    color: #ffe066;
    text-shadow:
      0 0 18px rgba(255, 224, 102, 0.9),
      0 2px 4px rgba(0, 0, 0, 0.5);
    border-color: rgba(255, 224, 102, 0.5);
  }
  .readout.lose {
    color: #ffb3b3;
  }
  .track {
    position: relative;
    height: 28px;
    border-radius: 999px;
    background: linear-gradient(180deg, #ff6b6b, #c0392b);
    box-shadow:
      inset 0 2px 6px rgba(0, 0, 0, 0.45),
      inset 0 -1px 0 rgba(255, 255, 255, 0.15);
    margin-top: 26px;
  }
  .zone {
    position: absolute;
    top: 0;
    bottom: 0;
    background: linear-gradient(180deg, #4ade80, #16a34a);
    border-radius: 999px;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.4),
      0 0 14px rgba(34, 197, 94, 0.55);
    transition:
      left var(--dur) var(--ease),
      width var(--dur) var(--ease);
  }
  .tick {
    position: absolute;
    top: -4px;
    bottom: -4px;
    width: 3px;
    margin-left: -1.5px;
    border-radius: 2px;
    background: #fff;
    box-shadow: 0 0 6px rgba(255, 255, 255, 0.8);
    transition: left var(--dur) var(--ease);
  }
  .marker {
    position: absolute;
    top: -26px;
    transform: translateX(-50%);
    background: linear-gradient(180deg, #fff, #e6e6e6);
    color: #111;
    font-weight: 800;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    border-radius: 6px;
    padding: 2px 6px;
    box-shadow: 0 3px 8px rgba(0, 0, 0, 0.4);
    animation: dc-drop 420ms var(--spring) both;
  }
  .marker::after {
    content: '';
    position: absolute;
    left: 50%;
    bottom: -5px;
    width: 8px;
    height: 8px;
    margin-left: -4px;
    background: inherit;
    transform: rotate(45deg);
  }
  .marker.win {
    background: var(--grad-gold);
    box-shadow:
      0 0 14px rgba(255, 224, 102, 0.9),
      0 3px 8px rgba(0, 0, 0, 0.4);
  }
  @keyframes dc-drop {
    from {
      transform: translate(-50%, -14px) scale(0.6);
      opacity: 0;
    }
    to {
      transform: translate(-50%, 0) scale(1);
      opacity: 1;
    }
  }
  input[type='range'] {
    width: 100%;
    accent-color: #ffe066;
    cursor: pointer;
  }
  .stats {
    justify-content: center;
  }
  .pill {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 700;
    padding: 5px 12px;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.2);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.15);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
    font-variant-numeric: tabular-nums;
  }
  .pill strong {
    font-size: 14px;
    letter-spacing: 0;
  }
  .pill.gold {
    color: #ffe066;
    border-color: rgba(255, 224, 102, 0.55);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.15),
      0 0 14px rgba(255, 224, 102, 0.4);
  }
</style>
