<script lang="ts">
  // Bet picker: amount with chip buttons, halve / double / max. Clamped to the chip balance.
  import { economy } from '../../lib/economy.svelte';

  interface Props {
    value: number;
    min?: number;
    disabled?: boolean;
    label?: string;
  }
  let { value = $bindable(), min = 10, disabled = false, label = 'Bet' }: Props = $props();
  const chips = $derived(economy.wallet.chips);
  const DENOMS = [10, 25, 100, 500, 1000];

  function set(n: number) {
    value = Math.max(min, Math.min(Math.floor(n) || min, Math.max(min, chips)));
  }
</script>

<div class="bet" aria-label="{label} amount">
  <span class="lbl">{label}</span>
  <input class="input num" type="number" {min} step="1" {disabled} {value} onchange={(e) => set(Number((e.target as HTMLInputElement).value))} aria-label="{label} in chips" />
  <button class="btn sm ghost" {disabled} onclick={() => set(value / 2)}>½</button>
  <button class="btn sm ghost" {disabled} onclick={() => set(value * 2)}>×2</button>
  {#each DENOMS.filter((d) => d <= Math.max(chips, min)) as d (d)}
    <button class="chipbtn" {disabled} onclick={() => set(d)} class:on={value === d}>{d >= 1000 ? `${d / 1000}k` : d}</button>
  {/each}
  <button class="btn sm ghost" {disabled} onclick={() => set(chips)}>Max</button>
  {#if value > chips}<span class="warn">Not enough chips</span>{/if}
</div>

<style>
  .bet {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    align-items: center;
  }
  .lbl {
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
  }
  .num {
    width: 96px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  /* casino chips: a solid center, a dashed edge stripe and a soft drop */
  .chipbtn {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 3px dashed rgba(255, 255, 255, 0.75);
    background: radial-gradient(circle at 50% 50%, var(--c) 0 55%, color-mix(in srgb, var(--c) 70%, #000) 56% 100%);
    --c: var(--accent);
    color: #fff;
    font-weight: 800;
    font-size: 12px;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
    box-shadow:
      inset 0 0 0 4px var(--c),
      0 3px 0 color-mix(in srgb, var(--c) 50%, #000),
      0 6px 10px rgba(0, 0, 0, 0.3);
    transition:
      transform var(--dur) var(--spring),
      box-shadow var(--dur);
  }
  .chipbtn:nth-of-type(2n) {
    --c: #e74c3c;
  }
  .chipbtn:nth-of-type(3n) {
    --c: #2d3436;
  }
  .chipbtn:nth-of-type(4n) {
    --c: #0984e3;
  }
  .chipbtn:nth-of-type(5n) {
    --c: #00b894;
  }
  .chipbtn.on,
  .chipbtn:hover:not(:disabled) {
    transform: translateY(-4px) rotate(-8deg);
    box-shadow:
      inset 0 0 0 4px var(--c),
      0 7px 0 color-mix(in srgb, var(--c) 50%, #000),
      0 12px 18px rgba(0, 0, 0, 0.35);
  }
  .chipbtn.on {
    outline: 2px solid #ffe066;
    outline-offset: 2px;
  }
  .warn {
    color: var(--danger-text);
    font-size: 12px;
    font-weight: 700;
  }
</style>
