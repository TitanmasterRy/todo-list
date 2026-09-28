<script lang="ts">
  // Bet picker: amount with a rack of chips, halve / double / max. Clamped to the chip balance.
  import { economy } from '../../lib/economy.svelte';
  import Chip from './Chip.svelte';
  import { sfx } from './sfx';

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
    sfx('chip');
  }
</script>

<div class="bet" role="group" aria-label="{label} amount">
  <span class="lbl">{label}</span>
  <input class="input num" type="number" {min} step="1" {disabled} {value} onchange={(e) => set(Number((e.target as HTMLInputElement).value))} aria-label="{label} in chips" />
  <div class="rack">
    {#each DENOMS.filter((d) => d <= Math.max(chips, min)) as d (d)}
      <button class="chipbtn" {disabled} onclick={() => set(d)} class:on={value === d} aria-pressed={value === d} aria-label="{label} {d}">
        <Chip value={d} size={38} />
      </button>
    {/each}
  </div>
  <span class="mods">
    <button class="btn sm ghost" {disabled} onclick={() => set(value / 2)} aria-label="Halve {label.toLowerCase()}">½</button>
    <button class="btn sm ghost" {disabled} onclick={() => set(value * 2)} aria-label="Double {label.toLowerCase()}">×2</button>
    <button class="btn sm ghost" {disabled} onclick={() => set(chips)}>Max</button>
  </span>
  {#if value > chips}<span class="warn">Not enough chips</span>{/if}
</div>

<style>
  .bet {
    display: flex;
    gap: 8px;
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
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }
  .rack {
    display: flex;
    gap: 4px;
    padding: 4px 8px 6px;
    border-radius: 12px;
    background: linear-gradient(180deg, #5a3616, #3a220c);
    box-shadow:
      inset 0 2px 5px rgba(0, 0, 0, 0.55),
      inset 0 0 0 1px rgba(231, 184, 74, 0.55);
  }
  .chipbtn {
    padding: 0;
    background: none;
    border: 0;
    border-radius: 50%;
    display: grid;
    transition: transform 160ms var(--spring);
    filter: drop-shadow(0 2px 0 rgba(0, 0, 0, 0.45));
  }
  .chipbtn:hover:not(:disabled) {
    transform: translateY(-3px) rotate(-8deg);
  }
  .chipbtn.on {
    transform: translateY(-5px);
    filter: drop-shadow(0 0 6px rgba(255, 215, 106, 0.95)) drop-shadow(0 3px 0 rgba(0, 0, 0, 0.45));
  }
  .chipbtn:focus-visible {
    outline: 3px solid var(--accent);
    outline-offset: 2px;
  }
  .chipbtn:disabled {
    opacity: 0.55;
  }
  .mods {
    display: inline-flex;
    gap: 4px;
  }
  .warn {
    color: var(--danger-text);
    font-size: 12px;
  }
</style>
