<script lang="ts">
  import { fly } from 'svelte/transition';
  import { store, VIEWS } from '../lib/store.svelte';
  const tabs = VIEWS.filter((v) => ['today', 'upcoming', 'courses', 'inbox', 'stats'].includes(v.id));
  const more = $derived(VIEWS.filter((v) => ['focus', 'tools', 'schoology', 'play', 'settings'].includes(v.id) && (v.id !== 'play' || store.settings.economyEnabled)));
  let open = $state(false);
  const moreActive = $derived(more.some((v) => v.id === store.view));
</script>

<nav class="tabbar" aria-label="Main">
  {#each tabs as v (v.id)}
    <button class:active={store.view === v.id} onclick={() => { open = false; store.go(v.id); }} aria-current={store.view === v.id ? 'page' : undefined} aria-label={v.label}>
      <span class="ico" aria-hidden="true">{v.icon}</span>
      <span class="lbl">{v.label}</span>
    </button>
  {/each}
  <button class:active={moreActive} onclick={() => (open = !open)} aria-label="More" aria-expanded={open} aria-haspopup="menu">
    <span class="ico" aria-hidden="true">{moreActive ? VIEWS.find((v) => v.id === store.view)?.icon : '⋯'}</span>
    <span class="lbl">{moreActive ? VIEWS.find((v) => v.id === store.view)?.label : 'More'}</span>
  </button>
</nav>
{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
  <div class="more-backdrop" onclick={() => (open = false)}></div>
  <div class="more" role="menu" transition:fly={{ y: 20, duration: 180 }}>
    {#each more as v (v.id)}
      <button role="menuitem" class:active={store.view === v.id} onclick={() => { open = false; store.go(v.id); }}>
        <span class="ico" aria-hidden="true">{v.icon}</span>{v.label}
      </button>
    {/each}
  </div>
{/if}

<style>
  .tabbar {
    display: none;
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    height: calc(var(--tabbar-h) + env(safe-area-inset-bottom));
    padding-bottom: env(safe-area-inset-bottom);
    background: var(--bg-elev);
    border-top: 1px solid var(--border);
    z-index: 20;
  }
  .tabbar button {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    color: var(--text-faint);
    font-size: 10px;
    font-weight: 600;
  }
  .tabbar button.active {
    color: var(--accent);
  }
  .tabbar .ico {
    font-size: 20px;
  }
  .more-backdrop {
    display: none;
    position: fixed;
    inset: 0;
    z-index: 21;
  }
  .more {
    display: none;
    position: fixed;
    right: 8px;
    bottom: calc(var(--tabbar-h) + 8px + env(safe-area-inset-bottom));
    background: var(--bg-elev-2);
    border: 1px solid var(--border-strong);
    border-radius: 12px;
    box-shadow: var(--shadow);
    padding: 6px;
    flex-direction: column;
    min-width: 170px;
    z-index: 22;
  }
  .more button {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 8px;
    font-size: 15px;
    color: var(--text);
    text-align: left;
  }
  .more button.active {
    background: color-mix(in srgb, var(--accent) 16%, transparent);
  }
  @media (max-width: 720px) {
    .tabbar,
    .more,
    .more-backdrop {
      display: flex;
    }
    .more-backdrop {
      display: block;
    }
  }
</style>
