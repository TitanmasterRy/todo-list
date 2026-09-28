<script lang="ts">
  // Settings → Music & accounts: Spotify and Google client IDs.
  import { store } from '../../lib/store.svelte';
  import { set } from './settings';
  import { t } from '../../lib/i18n/index.svelte';
  const s = $derived(store.settings);
</script>

<section class="card">
  <h2>{t('settings.music')}</h2>
  <div class="row">
    <label for="spid">Spotify Client ID</label>
    <input
      id="spid"
      class="input"
      value={s.spotifyClientId}
      placeholder={t('music.spotifyPh')}
      onchange={(e) => set('spotifyClientId', (e.target as HTMLInputElement).value.trim())}
    />
  </div>
  <p class="help">
    {t('music.help1')} <code>{typeof location !== 'undefined' ? location.origin + location.pathname : ''}</code>
    {t('music.help2')}
  </p>
  <div class="row">
    <label for="gcid">Google Client ID</label>
    <input
      id="gcid"
      class="input"
      value={s.googleClientId}
      placeholder="….apps.googleusercontent.com"
      onchange={(e) => set('googleClientId', (e.target as HTMLInputElement).value.trim())}
    />
  </div>
  <p class="help">{t('music.google')}</p>
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
  .help {
    font-size: 13px;
    color: var(--text-muted);
    margin: 6px 0;
  }
  .help code {
    font-family: var(--mono);
    font-size: 12px;
  }
  .row .input:not(.num) {
    max-width: 320px;
  }
</style>
