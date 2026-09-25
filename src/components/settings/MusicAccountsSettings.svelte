<script lang="ts">
  // Settings → Music & accounts: Spotify and Google client IDs.
  import { store } from '../../lib/store.svelte';
  import { set } from './settings';
  const s = $derived(store.settings);
</script>

<section class="card">
  <h2>Music &amp; accounts</h2>
  <div class="row">
    <label for="spid">Spotify Client ID</label>
    <input
      id="spid"
      class="input"
      value={s.spotifyClientId}
      placeholder="from developer.spotify.com/dashboard"
      onchange={(e) => set('spotifyClientId', (e.target as HTMLInputElement).value.trim())}
    />
  </div>
  <p class="help">
    Create a free app at developer.spotify.com/dashboard, add <code>{typeof location !== 'undefined' ? location.origin + location.pathname : ''}</code> as a Redirect URI, paste the Client
    ID, then connect from Focus → Music. Playback control (devices, play/pause) needs Spotify Premium; the embedded player works for everyone.
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
  <p class="help">Enables Gmail scanning, Google Classroom import, Google Calendar push and Drive sync (sign in on any device to sync). Setup is in Tools → Google.</p>
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
