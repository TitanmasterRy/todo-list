<script lang="ts">
  // Settings → GitHub Gist sync.
  import { store } from '../../lib/store.svelte';
  import { toasts } from '../../lib/toast.svelte';
  import { sync, syncNow, checkToken, disconnect } from '../../lib/gist.svelte';
  import { hasSecret, isLocked, requestUnlock, setSecrets } from '../../lib/secrets.svelte';
  import { t } from '../../lib/i18n/index.svelte';
  import { formatDateTime } from '../../lib/dates';
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
      toasts.push({ message: t('gist.on', { login: tokenLogin }), kind: 'success', emoji: '☁️' });
    } catch (err) {
      toasts.push({ message: t('gist.failed'), detail: err instanceof Error ? err.message : String(err), kind: 'warn' });
    } finally {
      tokenBusy = false;
    }
  }
</script>

<section class="card">
  <h2>{t('settings.gist')} <span class="chip optional">{t('settings.optional')}</span></h2>
  <p class="help">
    {t('gist.help1')}
    <a href="https://github.com/settings/tokens/new?scopes=gist&description=Homework%20To-Do" target="_blank" rel="noopener noreferrer">{t('gist.token')}</a>
    {t('gist.help2a')} <code>gist</code>
    {t('gist.help2b')}
  </p>
  {#if hasSecret('gistToken')}
    <div class="row">
      <span>{t('gist.status')}</span>
      <span class="status {sync.status}">
        {isLocked('gistToken')
          ? t('gist.locked')
          : sync.status === 'syncing'
            ? t('sync.syncing')
            : sync.status === 'error'
              ? t('sync.error', { error: sync.lastError ?? '' })
              : sync.status === 'ok'
                ? t('gist.upToDate')
                : sync.pending
                  ? t('gist.pending')
                  : t('sync.connected')}
        {#if s.lastSyncAt}<span class="muted"> · {t('gist.last', { when: formatDateTime(new Date(s.lastSyncAt)) })}</span>{/if}
      </span>
    </div>
    <div class="row">
      <span>Gist</span>
      {#if s.gistId}<a href="https://gist.github.com/{s.gistId}" target="_blank" rel="noopener noreferrer" class="mono">{s.gistId.slice(0, 10)}…</a>{:else}<span class="muted"
          >{t('gist.firstSync')}</span
        >{/if}
    </div>
    <div class="btns">
      {#if isLocked('gistToken')}<button class="btn" onclick={() => void requestUnlock()}>{t('eco.unlock')}</button>{/if}
      <button class="btn" onclick={() => void syncNow({ pull: true, interactive: true })} disabled={sync.status === 'syncing'}>{t('sync.now')}</button>
      <button class="btn danger" onclick={disconnect}>{t('sync.disconnect')}</button>
    </div>
  {:else}
    <form
      class="btns"
      onsubmit={(e) => {
        e.preventDefault();
        void connectGist();
      }}
    >
      <input class="input" type="password" bind:value={token} placeholder={t('gist.tokenPh')} aria-label={t('gist.tokenLabel')} autocomplete="off" />
      <button class="btn primary" type="submit" disabled={tokenBusy || !token.trim()}>{tokenBusy ? t('gist.connecting') : t('sync.connect')}</button>
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
