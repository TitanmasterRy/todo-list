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
    active = false;
    result = { text: `Cashed out ×${mult} · ${won.toLocaleString()} chips`, win: won > bet };
    playSound('pop');
  }
  const revealed = $derived(!active && (boom !== null || result !== null));
</script>

<div class="cz-game">
  <div class="cz-table">
    <div class="cz-grid" style="grid-template-columns: repeat(5, 1fr); max-width: 340px; margin: 0 auto; width: 100%">
      {#each Array.from({ length: MINES_TILES }, (_, i) => i) as i (i)}
        <button class="cz-tile" class:hit={open.has(i)} class:bad={boom === i} disabled={!active || open.has(i)} onclick={() => pick(i)} aria-label="Tile {i + 1}">
          {open.has(i) ? '💎' : revealed && mines.has(i) ? '💣' : ''}
        </button>
      {/each}
    </div>
    {#if active}<div class="cz-label">Now ×{mult} · next safe tile ×{nextMult}</div>{/if}
    <div class="cz-result" aria-live="polite" class:win={result?.win} class:lose={result && !result.win}>{result?.text ?? ''}</div>
  </div>
  <div class="cz-actions">
    {#if active}
      <button class="btn primary" onclick={cashOut} disabled={!open.size}>Cash out {Math.floor(bet * mult).toLocaleString()}</button>
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
</style>
