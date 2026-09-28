<script lang="ts">
  import { onDestroy } from 'svelte';
  import { economy } from '../../lib/economy.svelte';
  import { diceChance, diceMultiplier, diceWins, rollPercent } from '../../lib/casino/quick';
  import BetControl from './BetControl.svelte';
  import Die3D from './Die3D.svelte';
  import WinFx from './WinFx.svelte';
  import { reduced, wait } from './fx';
  import { sfx } from './sfx';

  let bet = $state(10);
  let target = $state(50);
  let mode = $state<'under' | 'over'>('under');
  let roll = $state<number | null>(null);
  let shown = $state<number | null>(null);
  let rolling = $state(false);
  let rolls = $state(0);
  let result = $state<{ text: string; win: boolean } | null>(null);
  let fx = $state<WinFx>();
  const mult = $derived(diceMultiplier(target, mode));
  let raf = 0;
  onDestroy(() => cancelAnimationFrame(raf));

  async function play() {
    if (rolling || !economy.bet('dice', bet)) return;
    const r = rollPercent();
    const stake = bet;
    rolling = true;
    result = null;
    rolls++;
    sfx('dice');
    if (!reduced()) {
      const t0 = performance.now();
      const scramble = (now: number) => {
        if (now - t0 < 620) {
          shown = Math.floor(Math.random() * 10000) / 100;
          raf = requestAnimationFrame(scramble);
        }
      };
      raf = requestAnimationFrame(scramble);
    }
    await wait(700);
    cancelAnimationFrame(raf);
    roll = r;
    shown = r;
    const win = diceWins(r, target, mode);
    const won = win ? Math.floor(stake * mult) : 0;
    economy.payout('dice', won);
    result = win ? { text: `${r.toFixed(2)} · win ${won.toLocaleString()}`, win: true } : { text: `${r.toFixed(2)} · no win`, win: false };
    fx?.show(won, stake);
    rolling = false;
  }
  const face = $derived(roll === null ? 5 : (Math.floor(roll * 7) % 6) + 1);
</script>

<div class="cz-game">
  <div class="cz-table night dice">
    <div class="top">
      <Die3D value={face} {rolls} size={58} color="red" from={120} />
      <div class="readout" class:win={!rolling && result?.win} class:lose={!rolling && result && !result.win} aria-hidden="true">
        {shown === null ? '––.––' : shown.toFixed(2)}
      </div>
    </div>
    <div class="trackwrap">
      <div class="track" aria-hidden="true">
        <div class="zone" style={mode === 'under' ? `left:0;width:${target}%` : `left:${target}%;width:${100 - target}%`}></div>
        {#each [0, 25, 50, 75, 100] as t (t)}<span class="tick" style="left:{t}%">{t}</span>{/each}
        {#if roll !== null && !rolling}
          <div class="marker" class:win={result?.win} style="left:{roll}%"><span>{roll.toFixed(2)}</span></div>
        {/if}
      </div>
      <input type="range" min="2" max="98" step="1" bind:value={target} aria-label="Target" disabled={rolling} oninput={() => sfx('tick', target / 12)} />
    </div>
    <div class="stats">
      <span>Roll {mode} <strong>{target}</strong></span>
      <span>Chance <strong>{(diceChance(target, mode) * 100).toFixed(0)}%</strong></span>
      <span>Pays <strong>×{mult}</strong></span>
    </div>
    <div class="cz-result center" aria-live="polite" class:win={result?.win} class:lose={result && !result.win}>
      {result?.text ?? (rolling ? 'Rolling…' : 'Set your odds and roll')}
    </div>
    <WinFx bind:this={fx} />
  </div>
  <div class="cz-deck">
    <div class="cz-seg" role="group" aria-label="Roll over or under">
      <button class:on={mode === 'under'} aria-pressed={mode === 'under'} onclick={() => (mode = 'under')}>Under</button><button
        class:on={mode === 'over'}
        aria-pressed={mode === 'over'}
        onclick={() => (mode = 'over')}>Over</button
      >
    </div>
    <BetControl bind:value={bet} disabled={rolling} />
    <div class="grow"></div>
    <button class="btn cz-go" onclick={play} disabled={rolling || bet > economy.wallet.chips}>Roll</button>
  </div>
  <p class="cz-edge">A roll from 0.00 to 99.99. Pick your odds; the payout adjusts. 3% house edge.</p>
</div>

<style>
  .dice {
    gap: 18px;
  }
  .top {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 22px;
    min-height: 90px;
  }
  .readout {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: clamp(42px, 10vw, 68px);
    font-weight: 900;
    letter-spacing: 0.02em;
    min-width: 5.2ch;
    text-align: center;
    color: #fff;
    text-shadow: 0 0 18px rgba(140, 170, 255, 0.5);
    transition:
      color 200ms,
      text-shadow 200ms;
    font-variant-numeric: tabular-nums;
  }
  .readout.win {
    color: #7dffa8;
    text-shadow: 0 0 24px rgba(60, 255, 140, 0.7);
  }
  .readout.lose {
    color: #ff8f9d;
    text-shadow: 0 0 18px rgba(255, 60, 90, 0.5);
  }
  .trackwrap {
    position: relative;
    padding: 30px 6px 18px;
  }
  .track {
    position: relative;
    height: 18px;
    border-radius: 999px;
    background: linear-gradient(180deg, #ff5a6e, #b3122f);
    box-shadow:
      inset 0 2px 4px rgba(0, 0, 0, 0.4),
      0 0 0 3px rgba(255, 255, 255, 0.08);
  }
  .zone {
    position: absolute;
    top: 0;
    bottom: 0;
    background: linear-gradient(180deg, #5cff9d, #18a957);
    border-radius: 999px;
    box-shadow: 0 0 16px rgba(60, 255, 140, 0.45);
    transition:
      left 200ms var(--ease),
      width 200ms var(--ease);
  }
  .tick {
    position: absolute;
    top: 24px;
    transform: translateX(-50%);
    font-size: 10px;
    opacity: 0.6;
  }
  .marker {
    position: absolute;
    bottom: 26px;
    transform: translateX(-50%);
    transition: left 500ms cubic-bezier(0.3, 1.4, 0.5, 1);
    animation: drop 500ms cubic-bezier(0.3, 1.5, 0.5, 1);
  }
  .marker span {
    display: block;
    background: #fff;
    color: #111;
    font-weight: 900;
    font-size: 13px;
    border-radius: 8px;
    padding: 3px 8px;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.4);
  }
  .marker::after {
    content: '';
    position: absolute;
    left: 50%;
    bottom: -7px;
    margin-left: -7px;
    border: 7px solid transparent;
    border-top-color: #fff;
    border-bottom: 0;
  }
  .marker.win span {
    background: linear-gradient(180deg, #fff3b0, #ffd24a);
  }
  .marker.win::after {
    border-top-color: #ffd24a;
  }
  @keyframes drop {
    from {
      transform: translate(-50%, -24px);
      opacity: 0;
    }
  }
  input[type='range'] {
    position: absolute;
    left: 0;
    right: 0;
    top: 26px;
    width: 100%;
    height: 26px;
    margin: 0;
    background: transparent;
    -webkit-appearance: none;
    appearance: none;
  }
  input[type='range']::-webkit-slider-runnable-track {
    background: transparent;
    height: 26px;
  }
  input[type='range']::-moz-range-track {
    background: transparent;
  }
  input[type='range']::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 30px;
    height: 30px;
    margin-top: -2px;
    border-radius: 8px;
    background: linear-gradient(180deg, #fffbe6, #e7b84a);
    border: 2px solid #8a5c0c;
    box-shadow: 0 3px 8px rgba(0, 0, 0, 0.5);
    cursor: grab;
  }
  input[type='range']::-moz-range-thumb {
    width: 26px;
    height: 26px;
    border-radius: 8px;
    background: linear-gradient(180deg, #fffbe6, #e7b84a);
    border: 2px solid #8a5c0c;
  }
  input[type='range']:focus-visible {
    outline: 3px solid #ffe39a;
    outline-offset: 4px;
    border-radius: 999px;
  }
  .stats {
    display: flex;
    gap: 8px;
    justify-content: center;
    flex-wrap: wrap;
  }
  .stats span {
    padding: 6px 14px;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.35);
    box-shadow: inset 0 0 0 1px rgba(255, 214, 120, 0.35);
    font-size: 13px;
  }
  .stats strong {
    color: #ffe39a;
    font-size: 15px;
  }
  .grow {
    flex: 1;
  }
</style>
