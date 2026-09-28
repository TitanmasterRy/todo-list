<script lang="ts">
  import { fly } from 'svelte/transition';
  import { store, VIEWS } from '../lib/store.svelte';
  import { t } from '../lib/i18n/index.svelte';
  const tabs = VIEWS.filter((v) => ['today', 'upcoming', 'courses', 'inbox', 'stats'].includes(v.id));
  const more = $derived(VIEWS.filter((v) => ['focus', 'tools', 'schoology', 'play', 'settings'].includes(v.id) && (v.id !== 'play' || store.settings.economyEnabled)));
  let open = $state(false);
  const moreActive = $derived(more.some((v) => v.id === store.view));
</script>

<nav class="tabbar" aria-label={t('nav.main')}>
  {#each tabs as v (v.id)}
    <button
      class:active={store.view === v.id}
      onclick={() => {
        open = false;
        store.go(v.id);
      }}
      aria-current={store.view === v.id ? 'page' : undefined}
      aria-label={v.label}
    >
      <span class="ico" aria-hidden="true">{v.icon}</span>
      <span class="lbl">{v.label}</span>
    </button>
  {/each}
  <button class:active={moreActive} onclick={() => (open = !open)} aria-label={t('nav.more')} aria-expanded={open} aria-haspopup="menu">
    <span class="ico" aria-hidden="true">{moreActive ? VIEWS.find((v) => v.id === store.view)?.icon : '⋯'}</span>
    <span class="lbl">{moreActive ? VIEWS.find((v) => v.id === store.view)?.label : t('nav.more')}</span>
  </button>
</nav>
{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
  <div class="more-backdrop" onclick={() => (open = false)}></div>
  <div class="more" role="menu" transition:fly={{ y: 20, duration: 180 }}>
    {#each more as v (v.id)}
      <button
        role="menuitem"
        class:active={store.view === v.id}
        onclick={() => {
          open = false;
          store.go(v.id);
        }}
      >
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
    padding: 4px 6px env(safe-area-inset-bottom);
    background: var(--glass);
    backdrop-filter: blur(16px) saturate(1.4);
    -webkit-backdrop-filter: blur(16px) saturate(1.4);
    border-top: 1px solid color-mix(in srgb, var(--accent) 18%, var(--border));
    box-shadow: 0 -8px 30px -12px rgba(0, 0, 0, 0.35);
    z-index: 20;
  }
  .tabbar button {
    position: relative;
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    color: var(--text-faint);
    font-size: 10px;
    font-weight: 700;
    border-radius: 14px;
    transition:
      color var(--dur),
      background var(--dur);
  }
  .tabbar button.active {
    color: var(--accent-text);
    background: linear-gradient(180deg, color-mix(in srgb, var(--accent) 18%, transparent), color-mix(in srgb, var(--accent) 6%, transparent));
  }
  .tabbar button.active::before {
    content: '';
    position: absolute;
    top: 0;
    width: 22px;
    height: 3px;
    border-radius: 0 0 3px 3px;
    background: var(--grad-accent);
    box-shadow: 0 0 10px var(--accent);
  }
  .tabbar .ico {
    font-size: 21px;
    transition: transform var(--dur-slow) var(--spring);
  }
  .tabbar button.active .ico {
    transform: translateY(-2px) scale(1.15);
    filter: drop-shadow(0 4px 8px color-mix(in srgb, var(--accent) 50%, transparent));
  }
  .tabbar button:active .ico {
    transform: scale(0.9);
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
    inset-inline-end: 8px;
    bottom: calc(var(--tabbar-h) + 8px + env(safe-area-inset-bottom));
    background: var(--glass);
    backdrop-filter: blur(16px) saturate(1.4);
    -webkit-backdrop-filter: blur(16px) saturate(1.4);
    border: 1px solid color-mix(in srgb, var(--accent) 25%, var(--border-strong));
    border-radius: 16px;
    box-shadow: var(--shadow-lg);
    padding: 6px;
    flex-direction: column;
    min-width: 180px;
    z-index: 22;
  }
  .more button {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 10px;
    font-size: 15px;
    font-weight: 600;
    color: var(--text);
    text-align: start;
  }
  .more button:hover {
    background: var(--bg-hover);
  }
  .more button.active {
    background: linear-gradient(90deg, color-mix(in srgb, var(--accent) 22%, transparent), transparent);
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
