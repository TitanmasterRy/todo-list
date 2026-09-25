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
    right: 16px;
    z-index: 120;
    display: grid;
    gap: 6px;
    justify-items: end;
    pointer-events: none;
  }
  .pop {
    background: var(--bg-elev);
    border: 1px solid color-mix(in srgb, #f5c542 60%, var(--border));
    color: var(--text);
    font-weight: 800;
    font-size: 14px;
    padding: 6px 12px;
    border-radius: 999px;
    box-shadow: var(--shadow);
  }
</style>
