<script lang="ts">
  // Your chip balance as a little stack with a counter that ticks up and down. Flying chips land here.
  import { Tween } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { untrack } from 'svelte';
  import { economy } from '../../lib/economy.svelte';
  import Chip from './Chip.svelte';
  import { dur } from './fx';

  const shown = new Tween(economy.wallet.chips, { easing: cubicOut });
  let deltas = $state<{ id: number; n: number }[]>([]);
  let id = 0;
  let prev = economy.wallet.chips;

  $effect(() => {
    const v = economy.wallet.chips;
    untrack(() => {
      const d = v - prev;
      prev = v;
      if (!d) return;
      void shown.set(v, { duration: dur(Math.min(1400, 350 + Math.log10(Math.abs(d) + 1) * 260)) });
      const k = ++id;
      deltas = [...deltas.slice(-2), { id: k, n: d }];
      setTimeout(() => (deltas = deltas.filter((x) => x.id !== k)), 1400);
    });
  });
  const tier = $derived(economy.wallet.chips >= 5000 ? 1000 : economy.wallet.chips >= 1000 ? 500 : economy.wallet.chips >= 200 ? 100 : 25);
</script>

<div class="bal" data-chip-balance role="status" aria-label="Chip balance: {economy.wallet.chips.toLocaleString()} chips">
  <span class="pile" aria-hidden="true">
    <span class="c c1"><Chip value={tier} size={26} /></span>
    <span class="c c2"><Chip value={tier === 25 ? 5 : 25} size={26} /></span>
    <span class="c c3"><Chip value={tier === 1000 ? 500 : 100} size={26} /></span>
  </span>
  <span class="num" aria-hidden="true">{Math.round(shown.current).toLocaleString()}</span>
  <span class="lbl" aria-hidden="true">chips</span>
  {#each deltas as d (d.id)}
    <span class="delta" class:up={d.n > 0} aria-hidden="true">{d.n > 0 ? '+' : ''}{d.n.toLocaleString()}</span>
  {/each}
</div>

<style>
  .bal {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 4px 14px 4px 6px;
    border-radius: 999px;
    background: linear-gradient(180deg, #2a1d08, #120c03);
    border: 1px solid #b8892e;
    box-shadow:
      inset 0 1px 0 rgba(255, 230, 160, 0.25),
      0 2px 10px rgba(0, 0, 0, 0.35);
    color: #ffe39a;
  }
  .pile {
    position: relative;
    width: 40px;
    height: 34px;
  }
  .c {
    position: absolute;
    filter: drop-shadow(0 2px 0 rgba(0, 0, 0, 0.5));
  }
  .c1 {
    left: 0;
    bottom: 0;
  }
  .c2 {
    left: 12px;
    bottom: 2px;
  }
  .c3 {
    left: 6px;
    bottom: 8px;
  }
  .num {
    font-weight: 900;
    font-size: 20px;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.01em;
    text-shadow: 0 0 10px rgba(255, 200, 80, 0.45);
    min-width: 3ch;
  }
  .lbl {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    opacity: 0.75;
  }
  .delta {
    position: absolute;
    right: 10px;
    top: -4px;
    font-weight: 900;
    font-size: 13px;
    color: #ff9b9b;
    pointer-events: none;
    animation: rise 1.4s ease-out forwards;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
  }
  .delta.up {
    color: #7dffa8;
  }
  @keyframes rise {
    from {
      transform: translateY(4px);
      opacity: 0;
    }
    15% {
      opacity: 1;
    }
    to {
      transform: translateY(-22px);
      opacity: 0;
    }
  }
</style>
