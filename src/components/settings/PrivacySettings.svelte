<script lang="ts">
  // Settings → Privacy & security: the passphrase lock for saved keys, end-to-end encryption of the synced
  // copy, and what goes to which service (the same facts as PRIVACY.md).
  import { store } from '../../lib/store.svelte';
  import { toasts } from '../../lib/toast.svelte';
  import { changePassphrase, disableLock, enableLock, forgetVault, hasSecret, isLocked, lockNow, requestUnlock, secret, setSecrets, vault } from '../../lib/secrets.svelte';
  import { clearSyncKeys, rememberPreviousPassphrase } from '../../lib/syncCrypto';
  import { syncNow as gistSync } from '../../lib/gist.svelte';
  import { driveSync } from '../../lib/google.svelte';
  import { account, syncNow as accountSync } from '../../lib/account.svelte';
  import type { SecretSlot } from '../../lib/secrets.svelte';
  import { t } from '../../lib/i18n/index.svelte';

  const MIN = 8;
  const LABELS: Record<string, () => string> = {
    gistToken: () => t('gist.tokenLabel'),
    aiApiKey: () => t('priv.anthropic'),
    schoologyFeedUrl: () => t('sgys.feedUrl'),
    canvasFeedUrl: () => t('canvas.feedLabel'),
    schoologyKey: () => t('priv.sgyKey'),
    schoologySecret: () => t('priv.sgySecret'),
    spotifyRefreshToken: () => t('priv.spotify'),
    syncPassphrase: () => t('priv.syncPass'),
  };
  const label = (slot: SecretSlot) => LABELS[slot]?.() ?? t('priv.aiKey', { name: slot.slice(7).replace(/^./, (c) => c.toUpperCase()) });

  // ---------- key lock ----------
  let lockPass = $state('');
  let lockPass2 = $state('');
  let lockBusy = $state(false);
  let changing = $state(false);
  let confirmForget = $state(false);
  const lockProblem = $derived(lockPass.length < MIN ? t('priv.min', { n: MIN }) : lockPass !== lockPass2 ? t('priv.mismatch') : '');

  async function run(fn: () => Promise<void>, ok: string) {
    lockBusy = true;
    try {
      await fn();
      toasts.push({ message: ok, kind: 'success', emoji: '🔐' });
      lockPass = lockPass2 = '';
      changing = false;
    } catch (e) {
      toasts.push({ message: t('priv.failed'), detail: e instanceof Error ? e.message : String(e), kind: 'warn' });
    } finally {
      lockBusy = false;
    }
  }
  const savedSlots = $derived(vault.enabled ? vault.stored : []);

  // ---------- sync encryption ----------
  let syncPass = $state('');
  let syncPass2 = $state('');
  let syncChanging = $state(false);
  const syncOn = $derived(hasSecret('syncPassphrase'));
  const syncProblem = $derived(syncPass.length < MIN ? t('priv.min', { n: MIN }) : syncPass !== syncPass2 ? t('priv.mismatch') : '');
  const anySync = $derived(hasSecret('gistToken') || store.settings.googleSyncEnabled || !!account.userId);

  /** Re-upload everywhere so the copies switch to (or from) the encrypted format now. */
  function resync() {
    if (hasSecret('gistToken')) void gistSync({ pull: true, interactive: true });
    if (store.settings.googleSyncEnabled) void driveSync({ pull: true, interactive: false });
    if (account.userId) void accountSync({ pull: true, interactive: true });
  }
  function saveSyncPass() {
    if (syncProblem) return;
    const old = secret('syncPassphrase');
    if (old) rememberPreviousPassphrase(old); // the old copy can still be read once, then it's rewritten
    clearSyncKeys();
    setSecrets({ syncPassphrase: syncPass });
    syncPass = syncPass2 = '';
    syncChanging = false;
    toasts.push({
      message: old ? t('priv.syncChanged') : t('priv.e2eOn'),
      detail: anySync ? t('priv.reencrypt') : t('priv.fromNow'),
      kind: 'success',
      emoji: '🔐',
      timeout: 8000,
    });
    resync();
  }
  async function turnOffSync() {
    if (isLocked('syncPassphrase') && !(await requestUnlock())) return;
    const old = secret('syncPassphrase');
    rememberPreviousPassphrase(old);
    clearSyncKeys();
    setSecrets({ syncPassphrase: '' });
    toasts.push({ message: t('priv.e2eOff'), detail: t('priv.e2eOffDetail'), kind: 'info' });
    resync();
  }
</script>

<section class="card" id="privacy">
  <h2>{t('settings.privacy')}</h2>
  <p class="help">
    {t('priv.intro')}
  </p>

  <h3 class="sub">{t('priv.lockTitle')}</h3>
  <p class="help">
    {t('priv.lockHelp')}
  </p>
  {#if !vault.enabled}
    <form
      class="btns"
      onsubmit={(e) => {
        e.preventDefault();
        if (!lockProblem) void run(() => enableLock(lockPass), t('priv.locked'));
      }}
    >
      <input class="input" type="password" bind:value={lockPass} placeholder={t('priv.newPass')} aria-label={t('priv.keyPass')} autocomplete="new-password" />
      <input class="input" type="password" bind:value={lockPass2} placeholder={t('priv.repeat')} aria-label={t('priv.repeatKey')} autocomplete="new-password" />
      <button class="btn primary" type="submit" disabled={lockBusy || !!lockProblem}>{lockBusy ? t('priv.locking') : t('priv.lock')}</button>
    </form>
    {#if lockPass && lockProblem}<p class="help warn">{lockProblem}</p>{/if}
  {:else}
    <div class="row">
      <span>{t('gist.status')}</span>
      <span class="status" class:ok={vault.unlocked}>{vault.unlocked ? t('priv.onUnlocked') : t('priv.onLocked')}</span>
    </div>
    <p class="help">{t('priv.protected', { list: savedSlots.length ? savedSlots.map(label).join(', ') : t('priv.nothingSaved') })}</p>
    <div class="btns">
      {#if vault.unlocked}
        <button class="btn" onclick={lockNow}>{t('priv.lockNow')}</button>
        <button class="btn" onclick={() => (changing = !changing)}>{t('priv.change')}</button>
        <button class="btn" onclick={() => void run(disableLock, t('priv.removed'))}>{t('priv.remove')}</button>
      {:else}
        <button class="btn primary" onclick={() => void requestUnlock()}>{t('eco.unlock')}</button>
      {/if}
      <button class="btn danger" onclick={() => (confirmForget = true)}>{t('priv.forget')}</button>
    </div>
    {#if changing && vault.unlocked}
      <form
        class="btns"
        onsubmit={(e) => {
          e.preventDefault();
          if (!lockProblem) void run(() => changePassphrase(lockPass), t('priv.changed'));
        }}
      >
        <input class="input" type="password" bind:value={lockPass} placeholder={t('priv.newPass')} aria-label={t('priv.newKeyPass')} autocomplete="new-password" />
        <input class="input" type="password" bind:value={lockPass2} placeholder={t('priv.repeat')} aria-label={t('priv.repeatNewKey')} autocomplete="new-password" />
        <button class="btn primary" type="submit" disabled={lockBusy || !!lockProblem}>{t('common.save')}</button>
      </form>
    {/if}
    {#if confirmForget}
      <div class="confirm">
        <p class="help">{t('priv.forgetHelp')}</p>
        <div class="btns">
          <button
            class="btn danger"
            onclick={() => {
              forgetVault();
              confirmForget = false;
              toasts.push({ message: t('priv.deleted'), kind: 'warn' });
            }}>{t('priv.deleteKeys')}</button
          >
          <button class="btn ghost" onclick={() => (confirmForget = false)}>{t('common.cancel')}</button>
        </div>
      </div>
    {/if}
  {/if}

  <h3 class="sub">{t('priv.e2eTitle')}</h3>
  <p class="help">
    {t('priv.e2eHelp')}
  </p>
  <p class="help warn">{t('priv.e2eWarn')}</p>
  {#if syncOn && !syncChanging}
    <div class="row">
      <span>{t('gist.status')}</span>
      <span class="status ok">{isLocked('syncPassphrase') ? t('priv.onWithKeys') : t('priv.on')}</span>
    </div>
    <div class="btns">
      <button class="btn" onclick={() => (syncChanging = true)}>{t('priv.changeSync')}</button>
      <button class="btn" onclick={() => void turnOffSync()}>{t('priv.turnOff')}</button>
    </div>
  {:else}
    <form
      class="btns"
      onsubmit={(e) => {
        e.preventDefault();
        saveSyncPass();
      }}
    >
      <input class="input" type="password" bind:value={syncPass} placeholder={t('priv.syncPass')} aria-label={t('priv.syncPass')} autocomplete="new-password" />
      <input class="input" type="password" bind:value={syncPass2} placeholder={t('priv.repeat')} aria-label={t('priv.repeatSync')} autocomplete="new-password" />
      <button class="btn primary" type="submit" disabled={!!syncProblem}>{syncOn ? t('priv.saveNew') : t('priv.turnOn')}</button>
      {#if syncChanging}<button class="btn ghost" type="button" onclick={() => (syncChanging = false)}>{t('common.cancel')}</button>{/if}
    </form>
    {#if syncPass && syncProblem}<p class="help warn">{syncProblem}</p>{/if}
    {#if syncChanging}<p class="help">{t('priv.otherDevices')}</p>{/if}
  {/if}

  <details class="where">
    <summary>{t('priv.where')}</summary>
    <ul>
      <li><strong>{t('priv.w.device')}</strong> {t('priv.w.device.text')}</li>
      <li><strong>{t('priv.w.gist')}</strong> {t('priv.w.gist.text')}</li>
      <li><strong>{t('priv.w.google')}</strong> {t('priv.w.google.text')}</li>
      <li><strong>{t('priv.w.account')}</strong> {t('priv.w.account.text')}</li>
      <li><strong>{t('priv.w.ai')}</strong> {t('priv.w.ai.text')}</li>
      <li><strong>{t('priv.w.schoology')}</strong> {t('priv.w.schoology.text')}</li>
      <li><strong>{t('priv.w.music')}</strong> {t('priv.w.music.text')}</li>
      <li><strong>{t('priv.w.tools')}</strong> {t('priv.w.tools.text')}</li>
      <li><strong>{t('priv.w.arcade')}</strong> {t('priv.w.arcade.text')}</li>
      <li><strong>{t('priv.w.social')}</strong> {t('priv.w.social.text')}</li>
    </ul>
    <p class="help">
      {t('priv.csp')} <a href="https://github.com/TitanmasterRy/todo-list/blob/main/PRIVACY.md" target="_blank" rel="noopener noreferrer">PRIVACY.md</a>.
    </p>
  </details>
</section>

<style>
  section {
    margin-bottom: 12px;
  }
  h2 {
    font-size: 15px;
    margin: 0 0 10px;
  }
  .sub {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    margin: 14px 0 4px;
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
  .help {
    font-size: 13px;
    color: var(--text-muted);
    margin: 6px 0;
  }
  .help.warn {
    color: var(--warn-text);
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
    min-width: 160px;
  }
  .status.ok {
    color: var(--success-text);
  }
  .confirm {
    border: 1px solid var(--danger);
    border-radius: var(--radius-sm);
    padding: 8px 12px;
  }
  .where {
    margin-top: 12px;
    font-size: 14px;
  }
  .where summary {
    cursor: pointer;
    font-weight: 600;
  }
  .where ul {
    padding-left: 18px;
    margin: 8px 0;
  }
  .where li {
    margin: 6px 0;
  }
</style>
