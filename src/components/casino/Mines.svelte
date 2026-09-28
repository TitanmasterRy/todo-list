<script lang="ts">
  import { economy } from '../../lib/economy.svelte';
  import { MINES_TILES, minesMultiplier, placeMines } from '../../lib/casino/quick';
  import BetControl from './BetControl.svelte';
  import WinFx from './WinFx.svelte';
  import { shake } from './fx';
  import { sfx } from './sfx';

  let bet = $state(10);
  let count = $state(3);
  let mines = $state<Set<number>>(new Set());
  let open = $state<Set<number>>(new Set());
  let active = $state(false);
  let boom = $state<number | null>(null);
  let result = $state<{ text: string; win: boolean } | null>(null);
  let fx = $state<WinFx>();
  let grid = $state<HTMLElement>();
  let order = $state<number[]>([]);
  const mult = $derived(minesMultiplier(count, open.size));
  const nextMult = $derived(minesMultiplier(count, open.size + 1));

  function start() {
    if (!economy.bet('mines', bet)) return;
    mines = placeMines(count);
    open = new Set();
    order = [];
    boom = null;
    active = true;
    result = null;
    fx?.clear();
    sfx('chips');
  }
  function pick(i: number) {
    if (!active || open.has(i)) return;
    if (mines.has(i)) {
      boom = i;
      active = false;
      result = { text: `💥 Mine! Lost ${bet}.`, win: false };
      sfx('boom');
      shake(grid, 9);
      return;
    }
    open = new Set([...open, i]);
    order = [...order, i];
    sfx('gem', open.size);
    if (open.size === MINES_TILES - count) cashOut();
  }
  function cashOut() {
    const won = Math.floor(bet * mult);
    economy.payout('mines', won);
    if (open.size >= 10) economy.achieve('mines-10');
    active = false;
    result = { text: `Cashed out ×${mult} · ${won.toLocaleString()} chips`, win: won > bet };
    fx?.show(won, bet);
  }
  const revealed = $derived(!active && (boom !== null || result !== null));
  const safeLeft = $derived(MINES_TILES - count - open.size);
</script>

{#snippet gem()}
  <svg viewBox="0 0 64 64" class="ico" aria-hidden="true">
    <path d="M12 24 L22 10 H42 L52 24 L32 56 Z" fill="#35e0b8" />
    <path d="M12 24 H52 L32 56 Z" fill="#1fb994" />
    <path d="M22 10 L27 24 L32 10 L37 24 L42 10 Z" fill="#8ff5dc" />
    <path d="M27 24 L32 56 L37 24 Z" fill="#6cf0d0" />
    <path d="M12 24 L22 10 H42 L52 24 L32 56 Z M12 24 H52" fill="none" stroke="#e8fff9" stroke-width="1.4" stroke-linejoin="round" />
    <circle cx="24" cy="16" r="2" fill="#fff" />
  </svg>
{/snippet}
{#snippet bomb()}
  <svg viewBox="0 0 64 64" class="ico" aria-hidden="true">
    <circle cx="30" cy="38" r="17" fill="#23232c" />
    <circle cx="24" cy="32" r="5" fill="#fff" opacity=".18" />
    <rect x="34" y="16" width="10" height="9" rx="2" fill="#4a4a58" transform="rotate(35 39 20)" />
    <path d="M43 16 Q48 8 54 10" stroke="#c9a36a" stroke-width="2.4" fill="none" stroke-linecap="round" />
    <circle cx="55" cy="9" r="3.5" fill="#ffb03a" />
    <circle cx="55" cy="9" r="1.6" fill="#fff6c8" />
  </svg>
{/snippet}

<div class="cz-game">
  <div class="cz-table night mines">
    <div class="meter" aria-hidden="true">
      <span class="now">×{mult}</span>
      <span class="bar"><span class="fill" style="width:{((open.size / Math.max(1, MINES_TILES - count)) * 100).toFixed(1)}%"></span></span>
      <span class="next">next ×{nextMult}</span>
    </div>
    <div class="grid" bind:this={grid}>
      {#each Array.from({ length: MINES_TILES }, (_, i) => i) as i (i)}
        {@const isOpen = open.has(i)}
        {@const showMine = revealed && mines.has(i)}
        <button
          class="tile"
          class:open={isOpen}
          class:mine={showMine}
          class:boom={boom === i}
          class:live={active && !isOpen}
          disabled={!active || isOpen}
          onclick={() => pick(i)}
          aria-label="Tile {i + 1}{isOpen ? ', gem' : showMine ? ', mine' : ''}"
          style="--k:{isOpen ? 0 : Math.abs((i % 5) - 2) + Math.abs(Math.floor(i / 5) - 2)}"
        >
          <span class="face" aria-hidden="true">
            {#if isOpen}
              {@render gem()}<span class="spark"></span>
            {:else if showMine}
              {@render bomb()}
              {#if boom === i}<span class="blast"></span><span class="ring"></span>{/if}
            {/if}
          </span>
        </button>
      {/each}
    </div>
    {#if active}<div class="cz-label center">Now ×{mult} · next safe tile ×{nextMult} · {safeLeft} gems left</div>{/if}
    <div class="cz-result center" aria-live="polite" class:win={result?.win} class:lose={result && !result.win}>
      {result?.text ?? (active ? 'Pick a tile' : 'Choose your mines and start')}
    </div>
    <WinFx bind:this={fx} />
  </div>
  <div class="cz-deck">
    {#if active}
      <div class="grow"></div>
      <button class="btn cz-go" onclick={cashOut} disabled={!open.size}>Cash out {Math.floor(bet * mult).toLocaleString()}</button>
    {:else}
      <label class="mc"
        >Mines <select class="select" bind:value={count}
          >{#each [1, 3, 5, 8, 12, 20, 24] as n (n)}<option value={n}>{n}</option>{/each}</select
        ></label
      >
      <BetControl bind:value={bet} />
      <div class="grow"></div>
      <button class="btn cz-go" onclick={start} disabled={bet > economy.wallet.chips}>Start</button>
    {/if}
  </div>
  <p class="cz-edge">Find gems, avoid mines, cash out whenever you like. More mines, faster multipliers. 3% house edge.</p>
</div>

<style>
  .mines {
    justify-items: center;
  }
  .meter {
    display: flex;
    align-items: center;
    gap: 10px;
    width: min(380px, 100%);
    font-weight: 900;
  }
  .now {
    font-size: 22px;
    color: #7dffc8;
    min-width: 64px;
    text-shadow: 0 0 12px rgba(60, 255, 180, 0.5);
    font-variant-numeric: tabular-nums;
  }
  .next {
    font-size: 12px;
    opacity: 0.8;
    white-space: nowrap;
  }
  .bar {
    flex: 1;
    height: 10px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.12);
    overflow: hidden;
  }
  .fill {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #1fb994, #8ff5dc);
    box-shadow: 0 0 12px rgba(60, 255, 180, 0.7);
    transition: width 300ms var(--spring);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 8px;
    width: min(380px, 100%);
  }
  .tile {
    position: relative;
    aspect-ratio: 1;
    border-radius: 12px;
    padding: 0;
    border: 0;
    background: linear-gradient(160deg, #3a4a78 0%, #26325a 55%, #1b2444 100%);
    box-shadow:
      inset 0 2px 0 rgba(255, 255, 255, 0.18),
      inset 0 -4px 0 rgba(0, 0, 0, 0.35),
      0 4px 8px rgba(0, 0, 0, 0.35);
    transition:
      transform 160ms var(--spring),
      background 200ms,
      box-shadow 200ms;
    animation: rise 380ms cubic-bezier(0.3, 1.4, 0.5, 1) backwards;
    animation-delay: calc(var(--k) * 40ms);
  }
  @keyframes rise {
    from {
      transform: scale(0.6);
      opacity: 0;
    }
  }
  .tile.live:hover {
    transform: translateY(-3px);
    background: linear-gradient(160deg, #4a5d96, #2f3c6c 55%, #222d52);
    box-shadow:
      inset 0 2px 0 rgba(255, 255, 255, 0.25),
      inset 0 -4px 0 rgba(0, 0, 0, 0.35),
      0 0 16px rgba(120, 160, 255, 0.45);
  }
  .tile:focus-visible {
    outline: 3px solid #ffe39a;
    outline-offset: 2px;
  }
  .tile:disabled {
    cursor: default;
    opacity: 1;
  }
  .tile.open {
    background: radial-gradient(circle at 50% 40%, #135e52, #0b3a36);
    box-shadow:
      inset 0 0 0 2px rgba(120, 255, 210, 0.55),
      0 0 14px rgba(60, 255, 180, 0.35);
    animation: flip 420ms cubic-bezier(0.3, 1.4, 0.5, 1);
  }
  @keyframes flip {
    from {
      transform: rotateY(90deg) scale(0.8);
    }
  }
  .tile.mine,
  .tile.mine:disabled {
    background: radial-gradient(circle at 50% 40%, #3a2230, #1c1018);
    opacity: 0.75;
  }
  .tile.boom,
  .tile.boom:disabled {
    opacity: 1;
    background: radial-gradient(circle at 50% 45%, #ff9a3c, #d6123a 55%, #5a0616);
    box-shadow:
      0 0 0 2px #ffcf6a,
      0 0 30px 8px rgba(255, 90, 40, 0.8);
    animation: boom 500ms cubic-bezier(0.3, 1.6, 0.5, 1);
    z-index: 2;
  }
  @keyframes boom {
    30% {
      transform: scale(1.3);
    }
  }
  .face {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
  }
  .ico {
    width: 68%;
    height: 68%;
    filter: drop-shadow(0 3px 3px rgba(0, 0, 0, 0.4));
  }
  .open .ico {
    animation: gem 1.6s ease-in-out infinite alternate;
  }
  @keyframes gem {
    to {
      transform: translateY(-2px) scale(1.05);
      filter: drop-shadow(0 0 8px rgba(120, 255, 220, 0.9));
    }
  }
  .spark {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
      radial-gradient(circle at 30% 30%, #fff 0 2px, transparent 3px), radial-gradient(circle at 72% 26%, #fff 0 1.5px, transparent 2.5px),
      radial-gradient(circle at 66% 74%, #fff 0 2px, transparent 3px), radial-gradient(circle at 24% 70%, #fff 0 1.5px, transparent 2.5px);
    animation: spark 700ms ease-out forwards;
  }
  @keyframes spark {
    from {
      transform: scale(0.4);
      opacity: 1;
    }
    to {
      transform: scale(1.5);
      opacity: 0;
    }
  }
  .blast {
    position: absolute;
    inset: -40%;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255, 245, 200, 0.95), rgba(255, 150, 40, 0.8) 30%, rgba(214, 18, 58, 0.4) 55%, transparent 70%);
    animation: blast 700ms ease-out forwards;
    pointer-events: none;
  }
  @keyframes blast {
    from {
      transform: scale(0.2);
      opacity: 1;
    }
    to {
      transform: scale(1.6);
      opacity: 0;
    }
  }
  .ring {
    position: absolute;
    inset: -10%;
    border-radius: 50%;
    border: 3px solid rgba(255, 220, 150, 0.9);
    animation: ring 800ms ease-out forwards;
    pointer-events: none;
  }
  @keyframes ring {
    from {
      transform: scale(0.3);
      opacity: 1;
    }
    to {
      transform: scale(3);
      opacity: 0;
    }
  }
  .center {
    justify-content: center;
    text-align: center;
  }
  .mc {
    display: flex;
    gap: 6px;
    align-items: center;
    font-size: 13px;
    color: var(--text-muted);
  }
  .grow {
    flex: 1;
  }
</style>
