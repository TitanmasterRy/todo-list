<script lang="ts">
  import { economy } from '../../lib/economy.svelte';
  import { MINES_TILES, minesMultiplier, placeMines } from '../../lib/casino/quick';
  import { playSound } from '../../lib/sounds';
  import BetControl from './BetControl.svelte';

  let bet = $state(10);
  let count = $state(3);
  let mines = $state<Set<number>>(new Set());
  let open = $state<Set<number>>(new Set());
  let active = $state(false);
  let boom = $state<number | null>(null);
  let result = $state<{ text: string; win: boolean } | null>(null);
  const mult = $derived(minesMultiplier(count, open.size));
  const nextMult = $derived(minesMultiplier(count, open.size + 1));

  function start() {
    if (!economy.bet('mines', bet)) return;
    mines = placeMines(count);
    open = new Set();
    boom = null;
    active = true;
    result = null;
  }
  function pick(i: number) {
    if (!active || open.has(i)) return;
    if (mines.has(i)) {
      boom = i;
      active = false;
      result = { text: `💥 Mine! Lost ${bet}.`, win: false };
      return;
    }
    open = new Set([...open, i]);
    playSound('tick');
    if (open.size === MINES_TILES - count) cashOut();
  }
  function cashOut() {
    const won = Math.floor(bet * mult);
    economy.payout('mines', won);
    if (open.size >= 10) economy.achieve('mines-10');
    active = false;
    result = { text: `Cashed out ×${mult} · ${won.toLocaleString()} chips`, win: won > bet };
    playSound('pop');
  }
  const revealed = $derived(!active && (boom !== null || result !== null));
</script>

<div class="cz-game">
  <div class="cz-table">
    <div class="cz-grid field" class:boom={boom !== null} style="grid-template-columns: repeat(5, 1fr); max-width: 340px; margin: 0 auto; width: 100%">
      {#each Array.from({ length: MINES_TILES }, (_, i) => i) as i (i)}
        <button
          class="cz-tile"
          class:hit={open.has(i)}
          class:gem={open.has(i)}
          class:bad={boom === i}
          class:mine={revealed && mines.has(i) && boom !== i}
          disabled={!active || open.has(i)}
          onclick={() => pick(i)}
          aria-label="Tile {i + 1}"
        >
          {open.has(i) ? '💎' : revealed && mines.has(i) ? '💣' : ''}
        </button>
      {/each}
    </div>
    {#if active}
      <div class="stats">
        <span class="pill now" class:hot={mult >= 3}>Now <strong>×{mult}</strong></span>
        <span class="pill">Next safe tile <strong>×{nextMult}</strong></span>
      </div>
    {/if}
    <div class="cz-result" aria-live="polite" class:win={result?.win} class:lose={result && !result.win}>{result?.text ?? ''}</div>
  </div>
  <div class="cz-actions">
    {#if active}
      <button class="btn primary cash" class:hot={mult >= 3} onclick={cashOut} disabled={!open.size}>Cash out {Math.floor(bet * mult).toLocaleString()}</button>
    {:else}
      <label class="mc"
        >Mines <select class="select" bind:value={count}
          >{#each [1, 3, 5, 8, 12, 20, 24] as n (n)}<option value={n}>{n}</option>{/each}</select
        ></label
      >
      <BetControl bind:value={bet} />
      <button class="btn primary" onclick={start} disabled={bet > economy.wallet.chips}>Start</button>
    {/if}
  </div>
  <p class="cz-edge">Find gems, avoid mines, cash out whenever you like. More mines, faster multipliers. 3% house edge.</p>
</div>

<style>
  .mc {
    display: flex;
    gap: 6px;
    align-items: center;
    font-size: 13px;
    color: var(--text-muted);
  }
  .field.boom {
    animation: shake 450ms var(--ease);
  }
  .cz-tile {
    position: relative;
    overflow: visible;
  }
  /* a revealed gem throws off a sparkle */
  .gem::after {
    content: '✦';
    position: absolute;
    top: -4px;
    right: -2px;
    font-size: 14px;
    color: #fff;
    text-shadow: 0 0 8px #fff;
    pointer-events: none;
    animation: mn-sparkle 900ms var(--ease) both;
  }
  @keyframes mn-sparkle {
    0% {
      opacity: 0;
      transform: scale(0.2) rotate(0deg);
    }
    40% {
      opacity: 1;
      transform: scale(1.3) rotate(90deg);
    }
    100% {
      opacity: 0;
      transform: scale(0.6) rotate(180deg) translateY(-8px);
    }
  }
  .mine {
    background: linear-gradient(180deg, rgba(0, 0, 0, 0.35), rgba(0, 0, 0, 0.5));
    animation: cz-pop 320ms var(--spring) both;
  }
  .stats {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
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
    transition:
      box-shadow var(--dur-slow),
      color var(--dur-slow);
  }
  .pill strong {
    font-size: 14px;
    letter-spacing: 0;
  }
  .pill.hot {
    color: #ffe066;
    border-color: rgba(255, 224, 102, 0.6);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.15),
      0 0 16px rgba(255, 224, 102, 0.5);
  }
  .cash {
    font-variant-numeric: tabular-nums;
    transition:
      background var(--dur) var(--ease),
      transform var(--dur) var(--spring),
      box-shadow var(--dur-slow);
  }
  /* a fat multiplier makes the cash-out button glow gold */
  .cash.hot:not(:disabled) {
    background: var(--grad-gold);
    color: #3a2e00;
    animation: mn-gold 1.4s ease-in-out infinite;
  }
  @keyframes mn-gold {
    0%,
    100% {
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.5),
        0 0 10px rgba(255, 224, 102, 0.5);
    }
    50% {
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.5),
        0 0 28px rgba(255, 224, 102, 0.95);
    }
  }
</style>
