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
    <div class="track" aria-hidden="true">
      <div class="zone" style={mode === 'under' ? `left:0;width:${target}%` : `left:${target}%;width:${100 - target}%`}></div>
      {#if roll !== null}<div class="marker" class:win={result?.win} style="left:{roll}%">{roll.toFixed(1)}</div>{/if}
    </div>
    <input type="range" min="2" max="98" step="1" bind:value={target} aria-label="Target" />
    <div class="cz-row stats">
      <span>Roll {mode} <strong>{target}</strong></span>
      <span>Chance <strong>{(diceChance(target, mode) * 100).toFixed(0)}%</strong></span>
      <span>Pays <strong>×{mult}</strong></span>
    </div>
    <div class="cz-result" aria-live="polite" class:win={result?.win} class:lose={result && !result.win}>{result?.text ?? ''}</div>
  </div>
  <div class="cz-actions">
    <div class="cz-seg"><button class:on={mode === 'under'} onclick={() => (mode = 'under')}>Under</button><button class:on={mode === 'over'} onclick={() => (mode = 'over')}>Over</button></div>
    <BetControl bind:value={bet} />
    <button class="btn primary" onclick={play} disabled={bet > economy.wallet.chips}>Roll</button>
  </div>
  <p class="cz-edge">A roll from 0.00 to 99.99. Pick your odds; the payout adjusts. 3% house edge.</p>
</div>

<style>
  .track {
    position: relative;
    height: 26px;
    border-radius: 999px;
    background: rgba(239, 68, 68, 0.55);
    margin-top: 22px;
  }
  .zone {
    position: absolute;
    top: 0;
    bottom: 0;
    background: rgba(34, 197, 94, 0.85);
    border-radius: 999px;
  }
  .marker {
    position: absolute;
    top: -24px;
    transform: translateX(-50%);
    background: #fff;
    color: #111;
    font-weight: 800;
    font-size: 12px;
    border-radius: 6px;
    padding: 2px 6px;
    transition: left 300ms var(--ease);
  }
  .marker.win {
    background: #ffe066;
  }
  input[type='range'] {
    width: 100%;
  }
  .stats {
    justify-content: space-between;
  }
</style>
