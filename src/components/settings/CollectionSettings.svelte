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
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: grid;
    place-items: center;
    font-size: 22px;
    background: var(--bg-elev-2);
    border: 1px solid var(--border);
    opacity: 0.5;
  }
  .coll.on {
    opacity: 1;
    border-color: var(--warn);
  }
</style>
