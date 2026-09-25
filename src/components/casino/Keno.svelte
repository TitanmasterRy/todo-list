<script lang="ts">
  import { economy } from '../../lib/economy.svelte';
  import { drawKeno, KENO_NUMBERS, KENO_PAYS, kenoMultiplier } from '../../lib/casino/quick';
  import { playSound } from '../../lib/sounds';
  import BetControl from './BetControl.svelte';

  let bet = $state(10);
  let picks = $state<number[]>([]);
  let drawn = $state<number[]>([]);
  let drawing = $state(false);
  let result = $state<{ text: string; win: boolean } | null>(null);

  function toggle(n: number) {
    if (drawing) return;
    drawn = [];
    result = null;
    picks = picks.includes(n) ? picks.filter((p) => p !== n) : picks.length < 10 ? [...picks, n] : picks;
  }
  function quick() {
    const all = Array.from({ length: KENO_NUMBERS }, (_, i) => i + 1).sort(() => Math.random() - 0.5);
    picks = all.slice(0, Math.max(picks.length, 5));
    drawn = [];
  }
  async function play() {
    if (!picks.length || drawing || !economy.bet('keno', bet)) return;
    drawing = true;
    result = null;
    const d = drawKeno();
    drawn = [];
    for (const n of d) {
      drawn = [...drawn, n];
      await new Promise((r) => setTimeout(r, 90));
    }
    const { hits, multiplier } = kenoMultiplier(picks, d);
    const won = Math.floor(bet * multiplier);
    economy.payout('keno', won);
    result = { text: `${hits} of ${picks.length} hit${won ? ` · ×${multiplier} = ${won.toLocaleString()}` : ''}`, win: won > bet };
    if (won > bet) playSound('pop');
    drawing = false;
  }
  const table = $derived(KENO_PAYS[picks.length] ?? {});
</script>

<div class="cz-game">
  <div class="cz-table">
    <div class="cz-grid" style="grid-template-columns: repeat(10, 1fr)">
      {#each Array.from({ length: KENO_NUMBERS }, (_, i) => i + 1) as n (n)}
        <button class="cz-tile num" class:on={picks.includes(n) && !drawn.includes(n)} class:hit={picks.includes(n) && drawn.includes(n)} class:drawn={drawn.includes(n) && !picks.includes(n)} onclick={() => toggle(n)} aria-pressed={picks.includes(n)}>{n}</button>
      {/each}
    </div>
    <div class="cz-result" aria-live="polite" class:win={result?.win} class:lose={result && !result.win}>{result?.text ?? `${picks.length}/10 picked`}</div>
  </div>
  <div class="cz-actions">
    <button class="btn ghost sm" onclick={quick} disabled={drawing}>Quick pick</button>
    <button class="btn ghost sm" onclick={() => ((picks = []), (drawn = []))} disabled={drawing}>Clear</button>
    <BetControl bind:value={bet} disabled={drawing} />
    <button class="btn primary" onclick={play} disabled={!picks.length || drawing || bet > economy.wallet.chips}>Draw 10</button>
  </div>
  {#if picks.length}
    <div class="cz-paytable">{#each Object.entries(table) as [h, m] (h)}<span>{h} hits</span><span>×{m}</span>{/each}</div>
  {/if}
  <p class="cz-edge">Pick 1–10 numbers from 40; 10 are drawn. About 94% return at every pick count.</p>
</div>

<style>
  .num {
    font-size: 13px;
    font-weight: 700;
    aspect-ratio: auto;
    padding: 8px 0;
  }
  .drawn {
    outline: 2px solid rgba(255, 255, 255, 0.6);
  }
</style>
