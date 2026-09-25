<script lang="ts">
  // Settings → Sounds.
  import { store } from '../../lib/store.svelte';
  import type { SoundPack } from '../../lib/types';
  import { previewPack, playSound } from '../../lib/sounds';
  import { set } from './settings';
  import { t } from '../../lib/i18n/index.svelte';
  const s = $derived(store.settings);
</script>

<section class="card">
  <h2>{t('settings.sounds')}</h2>
  <div class="row">
    <label for="snd">{t('settings.sounds')}</label>
    <input
      id="snd"
      type="checkbox"
      class="switch"
      checked={s.soundsEnabled}
      onchange={(e) => {
        set('soundsEnabled', (e.target as HTMLInputElement).checked);
        if ((e.target as HTMLInputElement).checked) playSound('pop');
      }}
    />
  </div>
  <div class="row">
    <span id="pack-l">{t('settings.soundPack')}</span>
    <div class="packs" role="radiogroup" aria-labelledby="pack-l">
      {#each ['soft', 'click', 'arcade'] as p}
        <button
          class="btn sm"
          class:primary={s.soundPack === p}
          role="radio"
          aria-checked={s.soundPack === p}
          onclick={() => {
            set('soundPack', p as SoundPack);
            previewPack(p as SoundPack);
          }}>{p}</button
        >
      {/each}
    </div>
  </div>
</section>

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
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 0;
    border-top: 1px solid var(--border);
    font-size: 14px;
  }
  .row label {
    color: var(--text);
  }
  .row > span:first-child {
    color: var(--text);
  }
  .switch {
    width: 40px;
    height: 22px;
    appearance: none;
    background: var(--border-strong);
    border-radius: 999px;
    position: relative;
    cursor: pointer;
    transition: background var(--dur);
    flex-shrink: 0;
  }
  .switch::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #fff;
    transition: transform var(--dur) var(--spring);
  }
  .switch:checked {
    background: var(--accent);
  }
  .switch:checked::after {
    transform: translateX(18px);
  }
  .packs {
    display: flex;
    gap: 4px;
  }
</style>
