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
    font-size: 13px;
    color: var(--text-muted);
  }
  .num {
    width: 96px;
  }
  .chipbtn {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    border: 3px dashed rgba(255, 255, 255, 0.7);
    background: var(--accent);
    color: var(--accent-contrast, #fff);
    font-weight: 700;
    font-size: 12px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
    transition: transform var(--dur) var(--spring);
  }
  .chipbtn:nth-of-type(2n) {
    background: #e74c3c;
  }
  .chipbtn:nth-of-type(3n) {
    background: #2d3436;
  }
  .chipbtn.on,
  .chipbtn:hover:not(:disabled) {
    transform: translateY(-3px);
  }
  .warn {
    color: var(--danger-text);
    font-size: 12px;
  }
</style>
