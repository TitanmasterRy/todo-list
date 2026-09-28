<script lang="ts">
  // A stack of chips for an amount (largest at the bottom), with the total on a tag.
  import Chip from './Chip.svelte';
  import { breakdown } from './chips';

  interface Props {
    amount: number;
    size?: number;
    max?: number;
    tag?: boolean;
  }
  let { amount, size = 34, max = 7, tag = true }: Props = $props();
  const chips = $derived(breakdown(amount, max));
  const step = $derived(Math.max(3, Math.round(size * 0.12)));
</script>

{#if amount > 0}
  <span class="stack" style="width:{size}px;height:{size + (chips.length - 1) * step}px" aria-hidden="true">
    {#each chips as v, i (i)}
      <span class="layer" style="bottom:{i * step}px;--i:{i}"><Chip value={v} {size} /></span>
    {/each}
    {#if tag}<span class="amt">{amount.toLocaleString()}</span>{/if}
  </span>
{/if}

<style>
  .stack {
    position: relative;
    display: inline-block;
    flex: none;
  }
  .layer {
    position: absolute;
    left: 0;
    filter: drop-shadow(0 2px 0 rgba(0, 0, 0, 0.45)) drop-shadow(0 3px 3px rgba(0, 0, 0, 0.25));
    animation: drop 260ms cubic-bezier(0.3, 1.4, 0.5, 1) backwards;
    animation-delay: calc(var(--i) * 40ms);
  }
  .layer :global(.cz-chip) {
    transform: scaleY(0.92);
  }
  @keyframes drop {
    from {
      transform: translateY(-14px);
      opacity: 0;
    }
  }
  .amt {
    position: absolute;
    left: 50%;
    bottom: -16px;
    transform: translateX(-50%);
    background: rgba(8, 20, 12, 0.85);
    color: #ffe9a8;
    border: 1px solid rgba(255, 215, 106, 0.6);
    font-size: 11px;
    font-weight: 800;
    padding: 0 6px;
    border-radius: 999px;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
    z-index: 1;
  }
</style>
