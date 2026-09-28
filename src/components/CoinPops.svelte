<script lang="ts">
  // Floating "+5 🪙" notes when the economy pays out. Small and out of the way of the XP toasts.
  import { fly } from 'svelte/transition';
  import { economy } from '../lib/economy.svelte';
  import { store } from '../lib/store.svelte';
</script>

{#if store.settings.economyEnabled}
  <div class="pops" aria-live="polite">
    {#each economy.pops as p (p.id)}
      <div class="pop" in:fly={{ y: 12, duration: store.settings.reducedMotion ? 0 : 220 }} out:fly={{ y: -16, duration: store.settings.reducedMotion ? 0 : 400 }}>{p.text}</div>
    {/each}
  </div>
{/if}

<style>
  .pops {
    position: fixed;
    top: 14px;
    inset-inline-end: 16px;
    z-index: 120;
    display: grid;
    gap: 6px;
    justify-items: end;
    pointer-events: none;
  }
  .pop {
    background: var(--grad-gold);
    border: 1px solid rgba(255, 255, 255, 0.5);
    color: #3a2a00;
    font-weight: 900;
    font-size: 15px;
    padding: 6px 14px;
    border-radius: 999px;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.7),
      0 8px 24px -6px rgba(245, 197, 66, 0.8);
    font-variant-numeric: tabular-nums;
    animation: bump 500ms var(--spring);
  }
</style>
