<script lang="ts">
  import { tick } from 'svelte';
  import { economy } from '../../lib/economy.svelte';
  import { store } from '../../lib/store.svelte';
  import { SLOT_PAY3, SLOT_PAY_TWO_CHERRIES, SLOT_SYMBOLS, SLOT_WEIGHTS, slotsRtp, spinSlots } from '../../lib/casino/slots';
  import BetControl from './BetControl.svelte';
  import SlotSymbol from './SlotSymbol.svelte';
  import WinFx from './WinFx.svelte';
  import { reduced, wait } from './fx';
  import { sfx } from './sfx';

  const N = SLOT_WEIGHTS.length;
  let bet = $state(10);
  let reels = $state<[number, number, number]>([5, 5, 5]);
  // what each reel strip shows: [above, payline, below] at rest, a long run of symbols while spinning
  let strips = $state<number[][]>([
    [3, 5, 1],
    [2, 5, 0],
    [4, 5, 2],
  ]);
  let stripEls = $state<HTMLElement[]>([]);
  let spinning = $state(false);
  let stopped = $state([true, true, true]);
  let blur = $state([false, false, false]);
  let tease = $state(false);
  let pulled = $state(false);
  let result = $state<{ text: string; win: boolean } | null>(null);
  let winCells = $state<boolean[]>([false, false, false]);
  let fx = $state<WinFx>();
  const theme = $derived(SLOT_SYMBOLS[store.settings.themePack] ? store.settings.themePack : 'classic');
  const symbols = $derived(SLOT_SYMBOLS[theme]);

  const rnd = () => Math.floor(Math.random() * N);

  async function spinReel(i: number, final: number, ms: number): Promise<void> {
    const cur = strips[i];
    const target = [rnd(), final, rnd()];
    if (reduced()) {
      strips[i] = target;
      return;
    }
    const filler = Array.from({ length: Math.max(8, Math.round(ms / 55)) }, rnd);
    const strip = [...cur, ...filler, ...target];
    strips[i] = strip;
    await tick();
    const el = stripEls[i];
    const pct = ((strip.length - 3) / strip.length) * 100;
    blur[i] = true;
    const anim = el?.animate(
      [
        { transform: 'translateY(0)', easing: 'cubic-bezier(.25,.1,.35,1)' },
        { transform: `translateY(calc(-${pct}% - 16px))`, offset: 0.9, easing: 'cubic-bezier(.3,1.5,.6,1)' },
        { transform: `translateY(-${pct}%)` },
      ],
      { duration: ms, fill: 'forwards' },
    );
    setTimeout(() => (blur[i] = false), ms * 0.72);
    await wait(ms);
    strips[i] = target;
    await tick();
    anim?.cancel();
  }

  async function spin() {
    if (spinning || !economy.bet('slots', bet)) return;
    spinning = true;
    result = null;
    winCells = [false, false, false];
    fx?.clear();
    stopped = [false, false, false];
    pulled = true;
    setTimeout(() => (pulled = false), 380);
    sfx('spin');
    const r = spinSlots();
    // near miss: the first two reels match, so the last one keeps you waiting (the result is already decided)
    const teaseIt = r.reels[0] === r.reels[1] && r.reels[0] >= 1;
    const times = [950, 1330, teaseIt ? 2500 : 1710];
    await Promise.all(
      [0, 1, 2].map(async (i) => {
        if (i === 2 && teaseIt) setTimeout(() => (tease = !reduced()), times[1]);
        await spinReel(i, r.reels[i], times[i]);
        stopped[i] = true;
        sfx('reel', i);
        if (i === 2) tease = false;
      }),
    );
    reels = r.reels;
    const won = Math.floor(bet * r.multiplier);
    economy.payout('slots', won);
    if (won > 0) {
      winCells = r.line === 'Two cherries' ? r.reels.map((x) => x === 0) : [true, true, true];
      result = { text: `${r.line}! +${won.toLocaleString()} chips`, win: true };
    } else result = { text: teaseIt ? 'So close! No win' : 'No win', win: false };
    fx?.show(won, bet);
    spinning = false;
  }
  function onKey(e: KeyboardEvent) {
    // Space spins when nothing in particular has focus
    if (e.key === ' ' && e.target === document.body && !e.repeat) {
      e.preventDefault();
      void spin();
    }
  }
  const lineOn = $derived(winCells.some(Boolean));
</script>

<svelte:window onkeydown={onKey} />

<div class="cz-game">
  <div class="cabinet" class:won={lineOn}>
    <div class="topper" aria-hidden="true">
      <span class="lights"></span>
      <span class="brand">Lucky Reels</span>
      <span class="jack">Top prize <b>{(bet * SLOT_PAY3[N - 1]).toLocaleString()}</b></span>
    </div>
    <div class="glass">
      <div class="reels" aria-label="Reels: {reels.map((i) => symbols[i]).join(' ')}" role="img">
        {#each strips as strip, k (k)}
          <div class="reel" class:tease={tease && k === 2} class:stopped={stopped[k]}>
            <div class="strip" class:blur={blur[k]} bind:this={stripEls[k]} style="--n:{strip.length}">
              {#each strip as s, j (j)}
                <div class="cell" class:hit={winCells[k] && j === 1 && strip.length === 3}>
                  <SlotSymbol {theme} index={s} />
                </div>
              {/each}
            </div>
          </div>
        {/each}
        <svg class="payline" class:on={lineOn} viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">
          <line x1="1" y1="5" x2="99" y2="5" pathLength="100" />
        </svg>
        <span class="arrow l" aria-hidden="true"></span>
        <span class="arrow r" aria-hidden="true"></span>
      </div>
    </div>
    <div class="cz-result center" aria-live="polite" class:win={result?.win} class:lose={result && !result.win}>
      {result?.text ?? (spinning ? 'Good luck!' : 'Line up three to win')}
    </div>
    <button class="lever" class:pulled tabindex="-1" aria-hidden="true" onclick={spin} disabled={spinning || bet > economy.wallet.chips}>
      <span class="rod"></span><span class="knob"></span>
    </button>
    <WinFx bind:this={fx} />
  </div>
  <div class="cz-deck">
    <BetControl bind:value={bet} disabled={spinning} />
    <div class="grow"></div>
    <button class="btn cz-go spinbtn" onclick={spin} disabled={spinning || bet > economy.wallet.chips}>{spinning ? 'Spinning…' : 'Spin'}</button>
  </div>
  <div class="cz-paytable pays">
    {#each SLOT_PAY3 as m, i (i)}
      <span class="combo" aria-label="Three {symbols[i]}"
        >{#each [0, 1, 2] as k (k)}<span class="mini"><SlotSymbol {theme} index={i} /></span>{/each}</span
      ><span>×{m}</span>
    {/each}
    <span class="combo" aria-label="Two {symbols[0]}"
      >{#each [0, 1] as k (k)}<span class="mini"><SlotSymbol {theme} index={0} /></span>{/each}<span class="any">any</span></span
    ><span>×{SLOT_PAY_TWO_CHERRIES}</span>
  </div>
  <p class="cz-edge">Returns {(slotsRtp() * 100).toFixed(1)}% on average. Symbols follow your theme pack. Press Space to spin.</p>
</div>

<style>
  .cabinet {
    --cell: clamp(64px, 19vw, 104px);
    position: relative;
    display: grid;
    gap: 12px;
    justify-items: center;
    padding: 16px 16px 18px;
    border-radius: 26px 26px 18px 18px;
    color: #fff4d6;
    background: radial-gradient(ellipse at 50% -10%, rgba(255, 120, 140, 0.35), transparent 60%), linear-gradient(180deg, #8e1426 0%, #5a0a18 55%, #2c040b 100%);
    box-shadow:
      inset 0 0 0 3px #e7b84a,
      inset 0 0 0 7px #3a0610,
      inset 0 0 0 8px rgba(231, 184, 74, 0.6),
      0 18px 36px -14px rgba(0, 0, 0, 0.6);
    margin-right: 26px;
  }
  .topper {
    position: relative;
    display: grid;
    justify-items: center;
    padding: 8px 26px 10px;
    border-radius: 16px;
    background: linear-gradient(180deg, #2a0710, #12030a);
    box-shadow:
      inset 0 0 0 2px #e7b84a,
      0 4px 12px rgba(0, 0, 0, 0.4);
  }
  .lights {
    position: absolute;
    inset: 3px;
    border-radius: 13px;
    padding: 2px;
    background: radial-gradient(circle, #fff6c8 0 1.8px, #ffb03a 2.3px, transparent 3px) 0 0 / 12px 12px;
    -webkit-mask:
      linear-gradient(#000 0 0) content-box exclude,
      linear-gradient(#000 0 0);
    mask:
      linear-gradient(#000 0 0) content-box exclude,
      linear-gradient(#000 0 0);
    animation: chase 0.8s steps(2) infinite;
  }
  .cabinet.won .lights {
    animation-duration: 0.25s;
  }
  @keyframes chase {
    to {
      background-position: 12px 0;
    }
  }
  .brand {
    font-family: Georgia, 'Times New Roman', serif;
    font-weight: 900;
    font-size: clamp(20px, 4vw, 28px);
    text-transform: uppercase;
    letter-spacing: 0.12em;
    background: linear-gradient(180deg, #fffbe6, #ffd24a 50%, #e39a0f 52%, #fff1b0);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    filter: drop-shadow(0 2px 0 #5a0a18);
  }
  .jack {
    font-size: 11px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: #ffcf6a;
  }
  .jack b {
    font-family: ui-monospace, Menlo, monospace;
    font-size: 14px;
    color: #ff5a4a;
    text-shadow: 0 0 8px rgba(255, 80, 60, 0.8);
    letter-spacing: 0.05em;
  }
  .glass {
    padding: 10px;
    border-radius: 16px;
    background: linear-gradient(180deg, #2a1a06, #0e0802);
    box-shadow:
      inset 0 0 0 2px #e7b84a,
      inset 0 6px 14px rgba(0, 0, 0, 0.6);
  }
  .reels {
    position: relative;
    display: flex;
    gap: 8px;
  }
  .reel {
    position: relative;
    width: calc(var(--cell) * 1.1);
    height: calc(var(--cell) * 3);
    overflow: hidden;
    border-radius: 10px;
    background: linear-gradient(90deg, #d9d2c3 0%, #fffdf6 18%, #ffffff 50%, #fffdf6 82%, #d9d2c3 100%);
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.25);
    transition: box-shadow 200ms;
  }
  .reel::after {
    /* the cylinder: shaded top and bottom, a glass highlight */
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
      linear-gradient(180deg, rgba(0, 0, 0, 0.55) 0%, rgba(0, 0, 0, 0.12) 22%, transparent 36%, transparent 64%, rgba(0, 0, 0, 0.12) 78%, rgba(0, 0, 0, 0.55) 100%),
      linear-gradient(100deg, transparent 20%, rgba(255, 255, 255, 0.35) 28%, transparent 40%);
  }
  .reel.tease {
    box-shadow:
      inset 0 0 0 3px #ffd24a,
      0 0 22px 6px rgba(255, 190, 40, 0.8);
    animation: throb 0.3s ease-in-out infinite alternate;
  }
  @keyframes throb {
    to {
      box-shadow:
        inset 0 0 0 3px #fff3b0,
        0 0 34px 10px rgba(255, 190, 40, 1);
    }
  }
  .strip {
    will-change: transform;
  }
  .strip.blur {
    filter: blur(1.6px);
  }
  .cell {
    height: var(--cell);
    display: grid;
    place-items: center;
    position: relative;
  }
  .cell.hit {
    animation: symwin 0.7s ease-in-out infinite alternate;
  }
  .cell.hit::before {
    content: '';
    position: absolute;
    inset: 6%;
    border-radius: 14px;
    background: radial-gradient(circle, rgba(255, 220, 90, 0.7), transparent 70%);
  }
  @keyframes symwin {
    from {
      transform: scale(1);
      filter: drop-shadow(0 0 0 rgba(255, 200, 40, 0));
    }
    to {
      transform: scale(1.12);
      filter: drop-shadow(0 0 10px rgba(255, 200, 40, 0.95));
    }
  }
  .payline {
    position: absolute;
    left: -6px;
    right: -6px;
    top: calc(50% - 6px);
    width: calc(100% + 12px);
    height: 12px;
    pointer-events: none;
    overflow: visible;
  }
  .payline line {
    stroke: rgba(255, 60, 60, 0.35);
    stroke-width: 2;
    vector-effect: non-scaling-stroke;
    stroke-dasharray: 100;
    stroke-dashoffset: 0;
  }
  .payline.on line {
    stroke: #ffe14a;
    stroke-width: 5;
    filter: drop-shadow(0 0 6px #ffb800);
    animation: draw 520ms ease-out both;
  }
  @keyframes draw {
    from {
      stroke-dashoffset: 100;
    }
  }
  .arrow {
    position: absolute;
    top: calc(50% - 8px);
    border: 8px solid transparent;
  }
  .arrow.l {
    left: -18px;
    border-left-color: #ffd24a;
  }
  .arrow.r {
    right: -18px;
    border-right-color: #ffd24a;
  }
  .lever {
    position: absolute;
    right: -30px;
    top: 34%;
    width: 30px;
    height: 150px;
    padding: 0;
    background: none;
    border: 0;
    cursor: pointer;
  }
  .lever:disabled {
    cursor: default;
  }
  .rod {
    position: absolute;
    left: 12px;
    bottom: 10px;
    width: 7px;
    height: 120px;
    border-radius: 4px;
    background: linear-gradient(90deg, #8d939e, #f2f4f8, #8d939e);
    transform-origin: 50% 100%;
    transition: transform 380ms cubic-bezier(0.3, 1.4, 0.5, 1);
  }
  .knob {
    position: absolute;
    left: 2px;
    top: 0;
    width: 27px;
    height: 27px;
    border-radius: 50%;
    background: radial-gradient(circle at 35% 30%, #ff8a9a, #e0142f 45%, #7a0010);
    box-shadow: 0 3px 6px rgba(0, 0, 0, 0.5);
    transition: transform 380ms cubic-bezier(0.3, 1.4, 0.5, 1);
  }
  .lever::after {
    content: '';
    position: absolute;
    left: 4px;
    bottom: 0;
    width: 22px;
    height: 20px;
    border-radius: 6px;
    background: linear-gradient(180deg, #e7b84a, #9a6b12);
  }
  .lever.pulled .rod {
    transform: scaleY(0.25);
  }
  .lever.pulled .knob {
    transform: translateY(92px);
  }
  .cz-result {
    font-size: 18px;
  }
  .cz-deck .grow {
    flex: 1;
  }
  .spinbtn {
    min-width: 150px;
    min-height: 56px;
    font-size: 20px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    animation: glow 1.8s ease-in-out infinite;
  }
  .spinbtn:disabled {
    animation: none;
  }
  @keyframes glow {
    50% {
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.7),
        0 3px 0 #8a5c0c,
        0 0 30px 6px rgba(255, 196, 40, 0.75);
    }
  }
  .pays {
    grid-template-columns: repeat(auto-fill, minmax(96px, 1fr) 48px);
    align-items: center;
  }
  .combo {
    display: inline-flex;
    align-items: center;
    gap: 1px;
  }
  .mini {
    --cell: 30px;
    width: 26px;
    height: 26px;
    display: grid;
    place-items: center;
  }
  .mini :global(.sym),
  .mini :global(.symimg) {
    width: 100%;
    height: 100%;
  }
  .any {
    font-size: 11px;
    margin-left: 4px;
  }
  @media (max-width: 520px) {
    .cabinet {
      --cell: clamp(58px, 21vw, 90px);
      margin-right: 18px;
      padding: 12px 10px 14px;
    }
    .lever {
      right: -24px;
      transform: scale(0.8);
      transform-origin: left top;
    }
    .spinbtn {
      width: 100%;
    }
  }
  :global(:root.reduced-motion) .lights,
  :global(:root.reduced-motion) .spinbtn {
    animation: none;
  }
</style>
