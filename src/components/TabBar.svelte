<script lang="ts">
  import { store, VIEWS } from '../lib/store.svelte';
  const tabs = VIEWS.filter((v) => ['today', 'upcoming', 'courses', 'inbox', 'stats'].includes(v.id));
</script>

<nav class="tabbar" aria-label="Main">
  {#each tabs as v (v.id)}
    <button class:active={store.view === v.id} onclick={() => store.go(v.id)} aria-current={store.view === v.id ? 'page' : undefined} aria-label={v.label}>
      <span class="ico" aria-hidden="true">{v.icon}</span>
      <span class="lbl">{v.label}</span>
    </button>
  {/each}
  <button class:active={store.view === 'focus' || store.view === 'settings'} onclick={() => store.go(store.view === 'focus' ? 'settings' : 'focus')} aria-label="Focus and settings">
    <span class="ico" aria-hidden="true">{store.view === 'focus' ? '⚙️' : '🎯'}</span>
    <span class="lbl">{store.view === 'focus' ? 'Settings' : 'Focus'}</span>
  </button>
</nav>

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
  button {
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
  button.active {
    color: var(--accent);
  }
  .ico {
    font-size: 20px;
  }
  @media (max-width: 720px) {
    .tabbar {
      display: flex;
    }
  }
</style>
