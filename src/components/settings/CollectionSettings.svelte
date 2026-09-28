<script lang="ts">
  // Settings → Collection: mystery rewards from closing the daily ring (shown once you own one).
  import { store } from '../../lib/store.svelte';
  import { COLLECTIBLES } from '../../lib/gamification';
  import { t } from '../../lib/i18n/index.svelte';
  const s = $derived(store.settings);
</script>

{#if s.collection.length}
  <section class="card">
    <h2>{t('settings.collection')} <span class="muted">{s.collection.length}/{COLLECTIBLES.length}</span></h2>
    <p class="help">Mystery rewards from closing your daily ring.</p>
    <div class="collection">
      {#each COLLECTIBLES as c (c.id)}
        <span class="coll" class:on={s.collection.includes(c.id)} title={s.collection.includes(c.id) ? c.name : '???'}>{s.collection.includes(c.id) ? c.emoji : '❔'}</span>
      {/each}
    </div>
  </section>
{/if}

<style>
  section {
    margin-bottom: 12px;
  }
  h2 {
    font-size: 15px;
    margin: 0 0 10px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .help {
    font-size: 13px;
    color: var(--text-muted);
    margin: 6px 0;
  }
  .muted {
    color: var(--text-muted);
    font-weight: 400;
    font-size: 13px;
  }
  .collection {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .coll {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    display: grid;
    place-items: center;
    font-size: 22px;
    background: var(--bg-elev-2);
    border: 1px solid var(--border);
    opacity: 0.5;
    transition:
      transform var(--dur-slow) var(--spring),
      box-shadow var(--dur);
  }
  .coll.on {
    opacity: 1;
    border-color: color-mix(in srgb, var(--gold) 60%, var(--border));
    background: linear-gradient(180deg, color-mix(in srgb, var(--gold) 16%, var(--bg-elev-2)), var(--bg-elev-2));
    box-shadow:
      inset 0 1px 0 var(--sheen),
      0 0 16px -6px color-mix(in srgb, var(--gold) 70%, transparent);
  }
  .coll.on:hover {
    transform: translateY(-3px) scale(1.1) rotate(-6deg);
    box-shadow:
      inset 0 1px 0 var(--sheen),
      0 8px 20px -8px color-mix(in srgb, var(--gold) 90%, transparent);
  }
  .muted {
    font-variant-numeric: tabular-nums;
  }
</style>
