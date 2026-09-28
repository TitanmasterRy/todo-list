<script lang="ts">
  import { Tween } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { economy } from '../../lib/economy.svelte';
  import { drawRank, hiloChance, hiloMultiplier } from '../../lib/casino/quick';
  import { rankLabel, SUITS } from '../../lib/casino/cards';
  import BetControl from './BetControl.svelte';
  import PlayingCard from './PlayingCard.svelte';
  import WinFx from './WinFx.svelte';
  import { dur, shake } from './fx';
  import { sfx } from './sfx';

  let bet = $state(10);
  let active = $state(false);
  let rank = $state(8);
  let suit = $state(0);
  let mult = $state(1);
  let streak = $state(0);
  let flip = $state(0);
  let trail = $state<{ rank: number; suit: number; ok: boolean | null }[]>([]);
  let result = $state<{ text: string; win: boolean } | null>(null);
  let fx = $state<WinFx>();
  let stage = $state<HTMLElement>();
  const shownMult = new Tween(1, { easing: cubicOut });

  function start() {
    if (!economy.bet('hi-lo', bet)) return;
    active = true;
    mult = 1;
    streak = 0;
    void shownMult.set(1, { duration: 0 });
    rank = drawRank();
    suit = Math.floor(Math.random() * 4);
    flip++;
    trail = [{ rank, suit, ok: null }];
    result = null;
    fx?.clear();
  }
  function guess(dir: 'higher' | 'lower') {
    const m = hiloMultiplier(rank, dir);
    const next = drawRank();
    const ok = dir === 'higher' ? next > rank : next < rank;
    rank = next;
    suit = Math.floor(Math.random() * 4);
    flip++;
    trail = [...trail, { rank: next, suit, ok }];
    if (ok) {
      mult = Math.round(mult * m * 100) / 100;
      streak++;
      void shownMult.set(mult, { duration: dur(500) });
      sfx('gem', streak);
    } else {
      active = false;
      streak = 0;
      result = { text: `${rankLabel(next)}: wrong call. Lost ${bet}.`, win: false };
      setTimeout(() => {
        shake(stage, 5);
        sfx('lose');
      }, 380);
    }
  }
  function cashOut() {
    const won = Math.floor(bet * mult);
    economy.payout('hi-lo', won);
    if (mult >= 5) economy.achieve('hilo-5');
    active = false;
    result = { text: `Cashed out ×${mult} · ${won.toLocaleString()} chips`, win: won > bet };
    fx?.show(won, bet);
  }
  // the meter fills toward ×10
  const heat = $derived(Math.min(1, Math.log10(Math.max(1, mult))));
</script>

<div class="cz-game">
  <div class="cz-table hilo">
    <div class="stage" bind:this={stage}>
      <div class="hint up" aria-hidden="true">▲<small>{active ? `${Math.round(hiloChance(rank, 'higher') * 100)}%` : ''}</small></div>
      <div class="cardslot" style="--from-x: 260px; --from-y: -20px; --cw: clamp(84px, 24vw, 112px)">
        {#key flip}
          <PlayingCard card={{ rank, suit: SUITS[suit] }} win={!!result?.win} />
        {/key}
      </div>
      <div class="hint down" aria-hidden="true">▼<small>{active ? `${Math.round(hiloChance(rank, 'lower') * 100)}%` : ''}</small></div>
      <div class="meter" aria-hidden="true">
        <span class="mv" class:hot={streak >= 3}>×{shownMult.current.toFixed(2)}</span>
        <span class="tube"><span class="liquid" style="height:{(heat * 100).toFixed(1)}%"></span></span>
        <span class="flames"
          >{#each Array.from({ length: Math.min(streak, 6) }, (_, i) => i) as i (i)}<span class="flame" style="--i:{i}"></span>{/each}</span
        >
        <span class="st">{streak} streak</span>
      </div>
    </div>
    <div class="trail" role="group" aria-label="Cards so far">
      {#each trail.slice(-12) as t, i (i)}
        <span class="mini" class:ok={t.ok === true} class:bad={t.ok === false} class:red={t.suit === 1 || t.suit === 2}>{rankLabel(t.rank)}{SUITS[t.suit]}</span>
      {/each}
    </div>
    {#if active}<div class="cash">Cash out now for <strong>{Math.floor(bet * mult).toLocaleString()}</strong></div>{/if}
    <div class="cz-result center" aria-live="polite" class:win={result?.win} class:lose={result && !result.win}>
      {result?.text ?? (active ? 'Higher or lower?' : 'Start a run')}
    </div>
    <WinFx bind:this={fx} />
  </div>
  <div class="cz-deck">
    {#if active}
      <button class="btn cz-alt hi" onclick={() => guess('higher')} disabled={rank === 14}
        >Higher ×{hiloMultiplier(rank, 'higher')} <span class="p">{Math.round(hiloChance(rank, 'higher') * 100)}%</span></button
      >
      <button class="btn cz-alt lo" onclick={() => guess('lower')} disabled={rank === 2}
        >Lower ×{hiloMultiplier(rank, 'lower')} <span class="p">{Math.round(hiloChance(rank, 'lower') * 100)}%</span></button
      >
      <div class="grow"></div>
      <button class="btn cz-go" onclick={cashOut} disabled={mult <= 1}>Cash out</button>
    {:else}
      <BetControl bind:value={bet} />
      <div class="grow"></div>
      <button class="btn cz-go" onclick={start} disabled={bet > economy.wallet.chips}>Start</button>
    {/if}
  </div>
  <p class="cz-edge">
    Guess whether the next card is strictly higher or lower (aces high, ties lose). Each correct call multiplies your winnings; cash out any time. 3% house edge per call.
  </p>
</div>

<style>
  .hilo {
    justify-items: center;
  }
  .stage {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    grid-template-rows: auto auto auto;
    align-items: center;
    justify-items: center;
    gap: 6px 18px;
    width: min(460px, 100%);
  }
  .cardslot {
    grid-column: 2;
    grid-row: 1 / 4;
    min-height: calc(var(--cw) * 1.4);
    display: grid;
    place-items: center;
  }
  .hint {
    grid-column: 1;
    display: grid;
    justify-items: center;
    font-size: 26px;
    line-height: 1;
    opacity: 0.85;
  }
  .hint small {
    font-size: 12px;
    font-weight: 800;
  }
  .hint.up {
    grid-row: 1;
    color: #5cff9d;
    text-shadow: 0 0 10px rgba(60, 255, 140, 0.6);
  }
  .hint.down {
    grid-row: 3;
    color: #ff7a8a;
    text-shadow: 0 0 10px rgba(255, 60, 90, 0.6);
  }
  .meter {
    grid-column: 3;
    grid-row: 1 / 4;
    display: grid;
    justify-items: center;
    gap: 4px;
    position: relative;
  }
  .mv {
    font-size: 22px;
    font-weight: 900;
    color: #ffe39a;
    font-variant-numeric: tabular-nums;
    text-shadow: 0 0 12px rgba(255, 200, 60, 0.6);
  }
  .mv.hot {
    color: #ffb03a;
    animation: pulse 0.8s ease-in-out infinite alternate;
  }
  @keyframes pulse {
    to {
      transform: scale(1.1);
    }
  }
  .tube {
    position: relative;
    width: 18px;
    height: 90px;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.4);
    box-shadow: inset 0 0 0 2px rgba(255, 214, 120, 0.5);
    overflow: hidden;
  }
  .liquid {
    position: absolute;
    left: 3px;
    right: 3px;
    bottom: 3px;
    max-height: calc(100% - 6px);
    border-radius: 999px;
    background: linear-gradient(0deg, #ffd24a, #ff7a2a, #ff3d6e);
    box-shadow: 0 0 10px rgba(255, 140, 40, 0.8);
    transition: height 500ms var(--spring);
  }
  .flames {
    display: flex;
    gap: 1px;
    min-height: 14px;
  }
  .flame {
    width: 9px;
    height: 13px;
    border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
    background: radial-gradient(circle at 50% 70%, #fff3b0, #ffb03a 45%, #ff3d3d);
    animation: flick 0.4s ease-in-out infinite alternate;
    animation-delay: calc(var(--i) * 70ms);
  }
  @keyframes flick {
    to {
      transform: scaleY(1.25) translateY(-1px);
    }
  }
  .st {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    opacity: 0.8;
  }
  .trail {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
    justify-content: center;
    min-height: 26px;
  }
  .mini {
    font-weight: 900;
    font-size: 12px;
    padding: 3px 6px;
    border-radius: 5px;
    background: #fffdf6;
    color: #17171d;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.35);
    animation: slide 300ms ease-out;
  }
  .mini.red {
    color: #cf1530;
  }
  .mini.ok {
    box-shadow:
      0 0 0 2px #5cff9d,
      0 2px 4px rgba(0, 0, 0, 0.35);
  }
  .mini.bad {
    box-shadow:
      0 0 0 2px #ff5a6e,
      0 2px 4px rgba(0, 0, 0, 0.35);
  }
  @keyframes slide {
    from {
      transform: translateX(20px);
      opacity: 0;
    }
  }
  .cash {
    font-size: 15px;
  }
  .cash strong {
    color: #ffe39a;
    font-size: 18px;
  }
  .hi {
    background: linear-gradient(180deg, #5cff9d, #18a957);
    color: #04210f;
    border: 1px solid #0d7a3c;
  }
  .lo {
    background: linear-gradient(180deg, #ff8a9a, #d6123a);
    color: #fff;
    border: 1px solid #8a0a22;
  }
  .hi:focus-visible,
  .lo:focus-visible {
    outline: 3px solid var(--accent);
    outline-offset: 2px;
  }
  .p {
    opacity: 0.8;
    font-size: 12px;
  }
  .grow {
    flex: 1;
  }
</style>
