<script lang="ts">
  import { economy } from '../../lib/economy.svelte';
  import { drawKeno, KENO_DRAWN, KENO_NUMBERS, KENO_PAYS, kenoMultiplier } from '../../lib/casino/quick';
  import BetControl from './BetControl.svelte';
  import WinFx from './WinFx.svelte';
  import { wait } from './fx';
  import { sfx } from './sfx';

  let bet = $state(10);
  let picks = $state<number[]>([]);
  let drawn = $state<number[]>([]);
  let drawing = $state(false);
  let result = $state<{ text: string; win: boolean } | null>(null);
  let fx = $state<WinFx>();

  function toggle(n: number) {
    if (drawing) return;
    drawn = [];
    result = null;
    picks = picks.includes(n) ? picks.filter((p) => p !== n) : picks.length < 10 ? [...picks, n] : picks;
    sfx('click');
  }
  function quick() {
    const all = Array.from({ length: KENO_NUMBERS }, (_, i) => i + 1).sort(() => Math.random() - 0.5);
    picks = all.slice(0, Math.max(picks.length, 5));
    drawn = [];
    result = null;
    sfx('chips');
  }
  async function play() {
    if (!picks.length || drawing || !economy.bet('keno', bet)) return;
    drawing = true;
    result = null;
    fx?.clear();
    const d = drawKeno();
    drawn = [];
    for (const n of d) {
      await wait(280);
      drawn = [...drawn, n];
      sfx(picks.includes(n) ? 'gem' : 'pop', drawn.length);
    }
    await wait(250);
    const { hits, multiplier } = kenoMultiplier(picks, d);
    const won = Math.floor(bet * multiplier);
    economy.payout('keno', won);
    result = { text: `${hits} of ${picks.length} hit${won ? ` · ×${multiplier} = ${won.toLocaleString()}` : ''}`, win: won > bet };
    fx?.show(won, bet);
    drawing = false;
  }
  const table = $derived(KENO_PAYS[picks.length] ?? {});
  const hitsNow = $derived(picks.filter((p) => drawn.includes(p)).length);
  const BALL = ['#ff5a6e', '#ffb03a', '#ffd24a', '#3ddc84', '#4aa3ff', '#b07cff'];
</script>

<div class="cz-game">
  <div class="cz-table blue keno">
    <div class="machine" aria-hidden="true">
      <div class="globe" class:churn={drawing}>
        {#each Array.from({ length: 12 }, (_, i) => i) as i (i)}
          <span class="gb" style="--c:{BALL[i % BALL.length]};--x:{(i * 37) % 70}%;--y:{(i * 53) % 60}%;--d:{(i % 5) * 90}ms"></span>
        {/each}
        <span class="glare"></span>
      </div>
      <div class="chute"></div>
      <div class="tray">
        {#each Array.from({ length: KENO_DRAWN }, (_, i) => i) as i (i)}
          {@const n = drawn[i]}
          <span class="slot">
            {#if n}
              <span class="ball" class:hit={picks.includes(n)} style="--c:{BALL[n % BALL.length]}">{n}</span>
            {/if}
          </span>
        {/each}
      </div>
    </div>
    <div class="board">
      {#each Array.from({ length: KENO_NUMBERS }, (_, i) => i + 1) as n (n)}
        {@const picked = picks.includes(n)}
        {@const isDrawn = drawn.includes(n)}
        <button
          class="num"
          class:on={picked && !isDrawn}
          class:hit={picked && isDrawn}
          class:drawn={isDrawn && !picked}
          onclick={() => toggle(n)}
          aria-pressed={picked}
          disabled={drawing}>{n}</button
        >
      {/each}
    </div>
    <div class="cz-result center" aria-live="polite" class:win={result?.win} class:lose={result && !result.win}>
      {result?.text ?? (drawing ? `${hitsNow} hit${hitsNow === 1 ? '' : 's'} so far…` : `${picks.length}/10 picked`)}
    </div>
    <WinFx bind:this={fx} />
  </div>
  <div class="cz-deck">
    <button class="btn ghost sm" onclick={quick} disabled={drawing}>Quick pick</button>
    <button class="btn ghost sm" onclick={() => ((picks = []), (drawn = []))} disabled={drawing}>Clear</button>
    <BetControl bind:value={bet} disabled={drawing} />
    <div class="grow"></div>
    <button class="btn cz-go" onclick={play} disabled={!picks.length || drawing || bet > economy.wallet.chips}>Draw 10</button>
  </div>
  {#if picks.length}
    <div class="cz-paytable">
      {#each Object.entries(table) as [h, m] (h)}<span class:hit={Number(h) === hitsNow && drawn.length > 0}>{h} hits</span><span
          class:hit={Number(h) === hitsNow && drawn.length > 0}>×{m}</span
        >{/each}
    </div>
  {/if}
  <p class="cz-edge">Pick 1–10 numbers from 40; 10 are drawn. About 94% return at every pick count.</p>
</div>

<style>
  .keno {
    grid-template-columns: auto 1fr;
    align-items: start;
    gap: 16px;
  }
  .machine {
    display: grid;
    justify-items: center;
    gap: 0;
  }
  .globe {
    position: relative;
    width: 120px;
    height: 120px;
    border-radius: 50%;
    background: radial-gradient(circle at 50% 60%, rgba(160, 220, 255, 0.18), rgba(20, 40, 80, 0.4));
    box-shadow:
      inset 0 0 0 3px rgba(200, 235, 255, 0.55),
      inset 0 -10px 20px rgba(0, 0, 0, 0.4),
      0 0 0 4px #e7b84a,
      0 8px 18px rgba(0, 0, 0, 0.45);
    overflow: hidden;
  }
  .gb {
    position: absolute;
    left: calc(10% + var(--x));
    top: calc(28% + var(--y) * 0.8);
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: radial-gradient(circle at 35% 30%, #fff, var(--c) 55%, color-mix(in srgb, var(--c) 60%, #000));
  }
  .churn .gb {
    animation: churn 0.5s ease-in-out infinite alternate;
    animation-delay: var(--d);
  }
  @keyframes churn {
    0% {
      transform: translate(0, 0);
    }
    50% {
      transform: translate(14px, -34px);
    }
    100% {
      transform: translate(-12px, -10px);
    }
  }
  .glare {
    position: absolute;
    left: 18%;
    top: 10%;
    width: 36%;
    height: 22%;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.35);
    transform: rotate(-25deg);
  }
  .chute {
    width: 22px;
    height: 16px;
    background: linear-gradient(90deg, #9a6b12, #ffe39a, #9a6b12);
  }
  .tray {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 4px;
    padding: 6px;
    border-radius: 12px;
    background: rgba(0, 0, 0, 0.35);
    box-shadow: inset 0 0 0 1px rgba(255, 214, 120, 0.4);
  }
  .slot {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.06);
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.5);
    display: grid;
    place-items: center;
  }
  .ball {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    font-size: 13px;
    font-weight: 900;
    color: #1b1300;
    background: radial-gradient(circle at 50% 50%, #fff 0 42%, transparent 44%), radial-gradient(circle at 35% 30%, #fff, var(--c) 45%, color-mix(in srgb, var(--c) 55%, #000));
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
    animation: pop 420ms cubic-bezier(0.3, 1.6, 0.5, 1);
  }
  .ball.hit {
    box-shadow:
      0 0 0 2px #ffe39a,
      0 0 14px 3px rgba(255, 215, 90, 0.9);
  }
  @keyframes pop {
    from {
      transform: translateY(-60px) scale(0.5);
      opacity: 0;
    }
  }
  .board {
    display: grid;
    grid-template-columns: repeat(10, 1fr);
    gap: 5px;
  }
  .num {
    position: relative;
    aspect-ratio: 1;
    min-height: 30px;
    border-radius: 10px;
    padding: 0;
    font-weight: 900;
    font-size: 14px;
    color: #eaf2ff;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0.06));
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.2),
      inset 0 -2px 0 rgba(0, 0, 0, 0.25);
    transition:
      transform 150ms var(--spring),
      background 200ms,
      box-shadow 200ms;
  }
  .num:hover:not(:disabled) {
    transform: translateY(-2px);
    background: rgba(255, 255, 255, 0.24);
  }
  .num:focus-visible {
    outline: 3px solid #ffe39a;
    outline-offset: 2px;
  }
  .num.on {
    color: #2a1a00;
    background: linear-gradient(180deg, #fff1b8, #e7b84a);
    box-shadow:
      0 0 0 2px #fff6d0,
      0 3px 8px rgba(0, 0, 0, 0.35);
  }
  .num.drawn {
    color: #fff;
    background: linear-gradient(180deg, #4aa3ff, #1f5fbf);
    box-shadow: 0 0 12px rgba(80, 160, 255, 0.8);
    animation: lit 400ms ease-out;
  }
  .num.hit {
    color: #1b1300;
    background: radial-gradient(circle at 50% 40%, #fffbe0, #ffd24a 55%, #e39a0f);
    box-shadow:
      0 0 0 2px #fff,
      0 0 20px 4px rgba(255, 210, 60, 0.95);
    animation: hitpop 600ms cubic-bezier(0.3, 1.6, 0.5, 1);
    z-index: 1;
  }
  @keyframes lit {
    from {
      filter: brightness(2);
    }
  }
  @keyframes hitpop {
    30% {
      transform: scale(1.3) rotate(-6deg);
    }
  }
  .num:disabled {
    cursor: default;
    opacity: 1;
  }
  .keno .cz-result {
    grid-column: 1 / -1;
  }
  .grow {
    flex: 1;
  }
  @media (max-width: 620px) {
    .keno {
      grid-template-columns: 1fr;
    }
    .machine {
      grid-template-columns: auto 1fr;
      align-items: center;
      gap: 10px;
    }
    .chute {
      display: none;
    }
    .globe {
      width: 84px;
      height: 84px;
    }
    .gb {
      width: 13px;
      height: 13px;
    }
    .tray {
      grid-template-columns: repeat(5, 1fr);
    }
    .slot,
    .ball {
      width: 30px;
      height: 30px;
    }
    .board {
      gap: 3px;
    }
    .num {
      font-size: 12px;
      border-radius: 7px;
      min-height: 0;
    }
  }
</style>
