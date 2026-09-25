<script lang="ts">
  // Settings → GitHub Gist sync.
  import { store } from '../../lib/store.svelte';
  import { toasts } from '../../lib/toast.svelte';
  import { sync, syncNow, checkToken, disconnect } from '../../lib/gist.svelte';
  import { hasSecret, isLocked, requestUnlock, setSecrets } from '../../lib/secrets.svelte';
  import { t } from '../../lib/i18n/index.svelte';
  const s = $derived(store.settings);
  let token = $state('');
  let tokenLogin = $state('');
  let tokenBusy = $state(false);

  async function connectGist() {
    if (!token.trim()) return;
    tokenBusy = true;
    try {
      tokenLogin = await checkToken(token.trim());
      setSecrets({ gistToken: token.trim() });
      token = '';
      await syncNow({ pull: true, interactive: true });
      toasts.push({ message: `Gist sync on for ${tokenLogin}`, kind: 'success', emoji: '☁️' });
    } catch (err) {
      toasts.push({ message: 'Could not connect', detail: err instanceof Error ? err.message : String(err), kind: 'warn' });
    } finally {
      tokenBusy = false;
    }
  }
</script>

<section class="card">
  <h2>{t('settings.gist')} <span class="chip optional">{t('settings.optional')}</span></h2>
  <p class="help">
    Keep your data in a <strong>private GitHub Gist</strong> so it follows you across devices. Create a
    <a href="https://github.com/settings/tokens/new?scopes=gist&description=Homework%20To-Do" target="_blank" rel="noopener noreferrer">personal access token</a>
    with only the <code>gist</code> scope. The token is stored only in this browser (encrypted if you lock your keys) and sent only to api.github.com. Turn on end-to-end encryption in
    Privacy &amp; security so GitHub only ever stores an encrypted copy.
  </p>
  {#if hasSecret('gistToken')}
    <div class="row">
      <span>Status</span>
      <span class="status {sync.status}">
        {isLocked('gistToken')
          ? 'Locked: enter your passphrase to sync'
          : sync.status === 'syncing'
            ? 'Syncing…'
            : sync.status === 'error'
              ? `Error: ${sync.lastError}`
              : sync.status === 'ok'
                ? 'Up to date'
                : sync.pending
                  ? 'Changes pending'
                  : 'Connected'}
        {#if s.lastSyncAt}<span class="muted"> · last {new Date(s.lastSyncAt).toLocaleString()}</span>{/if}
      </span>
    </div>
    <div class="row">
      <span>Gist</span>
      {#if s.gistId}<a href="https://gist.github.com/{s.gistId}" target="_blank" rel="noopener noreferrer" class="mono">{s.gistId.slice(0, 10)}…</a>{:else}<span class="muted"
          >created on first sync</span
        >{/if}
    </div>
    <div class="btns">
      {#if isLocked('gistToken')}<button class="btn" onclick={() => void requestUnlock()}>Unlock</button>{/if}
      <button class="btn" onclick={() => void syncNow({ pull: true, interactive: true })} disabled={sync.status === 'syncing'}>Sync now</button>
      <button class="btn danger" onclick={disconnect}>Disconnect</button>
    </div>
  {:else}
    <form
      class="btns"
      onsubmit={(e) => {
        e.preventDefault();
        void connectGist();
      }}
    >
      <input class="input" type="password" bind:value={token} placeholder="ghp_… token with gist scope" aria-label="GitHub token" autocomplete="off" />
      <button class="btn primary" type="submit" disabled={tokenBusy || !token.trim()}>{tokenBusy ? 'Connecting…' : 'Connect'}</button>
    </form>
  {/if}
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
  .row > span:first-child {
    color: var(--text);
  }
  .help {
    font-size: 13px;
    color: var(--text-muted);
    margin: 6px 0;
  }
  .help code,
  .mono {
    font-family: var(--mono);
    font-size: 12px;
  }
  .muted {
    color: var(--text-muted);
    font-weight: 400;
    font-size: 13px;
  }
  .btns {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
    margin: 8px 0;
  }
  .btns .input {
    flex: 1;
    min-width: 200px;
  }
  .status.ok {
    color: var(--success-text);
  }
  .status.error {
    color: var(--danger-text);
  }
  .chip.optional {
    text-transform: uppercase;
    font-size: 10px;
    letter-spacing: 0.06em;
  }
  .ok {
    font-size: 11px;
    color: var(--text-muted);
  }
</style>
