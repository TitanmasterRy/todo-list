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
        <button
          class="cz-tile num"
          class:on={picks.includes(n) && !drawn.includes(n)}
          class:hit={picks.includes(n) && drawn.includes(n)}
          class:drawn={drawn.includes(n) && !picks.includes(n)}
          style={drawn.includes(n) ? `animation-delay: ${drawn.indexOf(n) * 30}ms` : undefined}
          onclick={() => toggle(n)}
          aria-pressed={picks.includes(n)}>{n}</button
        >
      {/each}
    </div>
    <div class="tray" aria-label="Drawn numbers">
      {#each drawn as n, i (n)}<span class="ball" class:hit={picks.includes(n)} style="animation-delay: {i * 30}ms">{n}</span>{/each}
      {#each Array.from({ length: 10 - drawn.length }, (_, i) => i) as i (i)}<span class="ball empty" aria-hidden="true"></span>{/each}
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
    <div class="cz-paytable">
      {#each Object.entries(table) as [h, m] (h)}<span>{h} hits</span><span>×{m}</span>{/each}
    </div>
  {/if}
  <p class="cz-edge">Pick 1–10 numbers from 40; 10 are drawn. About 94% return at every pick count.</p>
</div>

<style>
  .num {
    font-size: 13px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    aspect-ratio: auto;
    padding: 8px 0;
  }
  /* a drawn number that you did not pick: a white ring and a pop */
  .drawn {
    border-color: rgba(255, 255, 255, 0.8);
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.32), rgba(255, 255, 255, 0.16));
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.4),
      0 0 0 2px rgba(255, 255, 255, 0.55),
      0 3px 0 rgba(0, 0, 0, 0.25);
    animation: cz-pop 320ms var(--spring) backwards;
  }
  .cz-tile.hit {
    animation-fill-mode: backwards;
  }
  /* the rack of drawn balls */
  .tray {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    justify-content: center;
    padding: 8px 10px;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.28);
    box-shadow:
      inset 0 2px 6px rgba(0, 0, 0, 0.45),
      inset 0 -1px 0 rgba(255, 255, 255, 0.08);
  }
  .ball {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-size: 12px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    color: #1b1b1f;
    background: radial-gradient(circle at 35% 30%, #ffffff, #d8dde3 55%, #9aa4ae);
    box-shadow:
      inset 0 -3px 5px rgba(0, 0, 0, 0.18),
      0 3px 6px rgba(0, 0, 0, 0.45);
    animation: cz-pop 320ms var(--spring) backwards;
  }
  .ball.hit {
    color: #fff;
    background: radial-gradient(circle at 35% 30%, #86efac, #22c55e 55%, #15803d);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
    box-shadow:
      inset 0 -3px 5px rgba(0, 0, 0, 0.2),
      0 0 12px rgba(34, 197, 94, 0.7),
      0 3px 6px rgba(0, 0, 0, 0.45);
  }
  .ball.empty {
    background: rgba(255, 255, 255, 0.06);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12);
    animation: none;
  }
</style>
