<script lang="ts">
  import { t } from '../lib/i18n/index.svelte';
  // Settings → Account: sign up / sign in with email and password to sync across devices.
  import { store } from '../lib/store.svelte';
  import { toasts } from '../lib/toast.svelte';
  import {
    account,
    accountConfig,
    configuredAtBuild,
    changePassword,
    deleteServerData,
    MIN_PASSWORD,
    reconfigure,
    sendPasswordReset,
    signIn,
    signOut,
    signUp,
    syncNow,
    validateCredentials,
  } from '../lib/account.svelte';
  import { formatDateTime } from '../lib/dates';

  let mode = $state<'signin' | 'signup' | 'forgot'>('signin');
  let email = $state('');
  let password = $state('');
  let password2 = $state('');
  let newPassword = $state('');
  let busy = $state(false);
  let message = $state<{ kind: 'ok' | 'error'; text: string } | null>(null);
  let showServer = $state(false);
  let serverUrl = $state(store.settings.accountUrl);
  let serverKey = $state(store.settings.accountAnonKey);
  let confirmDelete = $state(false);

  const configured = $derived(!!accountConfig());

  async function run(fn: () => Promise<void | string>) {
    busy = true;
    message = null;
    try {
      const r = await fn();
      if (typeof r === 'string') message = { kind: 'ok', text: r };
    } catch (e) {
      message = { kind: 'error', text: e instanceof Error ? e.message : String(e) };
    } finally {
      busy = false;
    }
  }

  function submit(e: SubmitEvent) {
    e.preventDefault();
    if (mode === 'forgot') {
      void run(async () => {
        await sendPasswordReset(email);
        return t('acct.resetSent');
      });
      return;
    }
    if (mode === 'signup') {
      const bad = validateCredentials(email, password);
      if (bad) return void (message = { kind: 'error', text: bad });
      if (password !== password2) return void (message = { kind: 'error', text: t('acct.mismatch') });
      void run(async () => {
        const r = await signUp(email, password);
        password = password2 = '';
        if (r === 'confirmEmail') return t('acct.confirmSent', { email: email.trim() });
        toasts.push({ message: t('acct.created'), detail: t('acct.createdDetail'), kind: 'success', emoji: '☁️' });
      });
      return;
    }
    void run(async () => {
      await signIn(email, password);
      password = '';
      toasts.push({ message: t('google.signedInShort'), detail: t('acct.syncing'), kind: 'success', emoji: '☁️' });
    });
  }

  function saveServer(e: SubmitEvent) {
    e.preventDefault();
    store.updateSettings({ accountUrl: serverUrl.trim(), accountAnonKey: serverKey.trim() });
    void run(async () => {
      await reconfigure();
      return accountConfig() ? t('acct.serverSaved') : t('acct.serverCleared');
    });
  }

  const statusText = $derived(
    account.status === 'syncing'
      ? t('sync.syncing')
      : account.status === 'error'
        ? t('sync.error', { error: account.lastError ?? '' })
        : account.pending
          ? t('gist.pending')
          : account.lastSyncAt
            ? `${t('gist.upToDate')} · ${formatDateTime(new Date(account.lastSyncAt))}`
            : t('google.signedInShort'),
  );
</script>

<section class="card" id="account">
  <h2>{t('settings.account')} <span class="chip optional">{t('settings.sync')}</span></h2>

  {#if !configured}
    <p class="help">
      {t('acct.intro1')} <a href="https://supabase.com" target="_blank" rel="noopener noreferrer">Supabase</a>
      {t('acct.intro2')} <code>DEPLOY.md → Accounts</code>).
    </p>
  {:else if account.userId}
    <div class="row"><span>{t('acct.as')}</span><strong class="grow-r">{account.email}</strong></div>
    <div class="row"><span>{t('gist.status')}</span><span class="status {account.status}">{statusText}</span></div>
    {#if account.recovering}
      <form
        class="btns"
        onsubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            await changePassword(newPassword);
            newPassword = '';
            return t('acct.passUpdated');
          });
        }}
      >
        <input
          class="input"
          type="password"
          bind:value={newPassword}
          placeholder={t('acct.newPassPh', { n: MIN_PASSWORD })}
          autocomplete="new-password"
          aria-label={t('acct.newPass')}
        />
        <button class="btn primary" type="submit" disabled={busy}>{t('acct.setPass')}</button>
      </form>
    {/if}
    <div class="btns">
      <button class="btn" onclick={() => void syncNow({ pull: true, interactive: true })} disabled={account.status === 'syncing'}>{t('sync.now')}</button>
      {#if !account.recovering}<button class="btn ghost sm" onclick={() => (account.recovering = true)}>{t('acct.changePass')}</button>{/if}
      <button
        class="btn ghost sm"
        onclick={() =>
          void run(async () => {
            await signOut();
            return t('acct.signedOut');
          })}>{t('google.signOut')}</button
      >
      {#if !confirmDelete}
        <button class="btn ghost sm" onclick={() => (confirmDelete = true)}>{t('acct.deleteCopy')}</button>
      {:else}
        <button
          class="btn danger sm"
          onclick={() =>
            void run(async () => {
              await deleteServerData();
              confirmDelete = false;
              return t('acct.copyDeleted');
            })}>{t('acct.reallyDelete')}</button
        >
        <button class="btn ghost sm" onclick={() => (confirmDelete = false)}>{t('common.cancel')}</button>
      {/if}
    </div>
    <p class="help">{t('acct.syncHelp')}</p>
  {:else}
    <div class="tabs" role="tablist" aria-label={t('settings.account')}>
      <button
        role="tab"
        aria-selected={mode === 'signin'}
        class:on={mode === 'signin'}
        onclick={() => {
          mode = 'signin';
          message = null;
        }}>{t('acct.signIn')}</button
      >
      <button
        role="tab"
        aria-selected={mode === 'signup'}
        class:on={mode === 'signup'}
        onclick={() => {
          mode = 'signup';
          message = null;
        }}>{t('acct.create')}</button
      >
    </div>
    <form class="auth" onsubmit={submit}>
      <label>
        <span>{t('acct.email')}</span>
        <input class="input" type="email" bind:value={email} autocomplete="email" required placeholder={t('acct.emailPh')} />
      </label>
      {#if mode !== 'forgot'}
        <label>
          <span>{t('acct.password')}</span>
          <input
            class="input"
            type="password"
            bind:value={password}
            autocomplete={mode === 'signup' ? 'new-password' : 'current-password'}
            required
            minlength={mode === 'signup' ? MIN_PASSWORD : undefined}
            placeholder={mode === 'signup' ? t('acct.atLeast', { n: MIN_PASSWORD }) : ''}
          />
        </label>
      {/if}
      {#if mode === 'signup'}
        <label>
          <span>{t('acct.confirmPass')}</span>
          <input class="input" type="password" bind:value={password2} autocomplete="new-password" required />
        </label>
      {/if}
      <div class="btns">
        <button class="btn primary" type="submit" disabled={busy}>
          {busy ? t('scan.working') : mode === 'signup' ? t('acct.create') : mode === 'forgot' ? t('acct.sendReset') : t('acct.signIn')}
        </button>
        {#if mode === 'signin'}
          <button
            type="button"
            class="link"
            onclick={() => {
              mode = 'forgot';
              message = null;
            }}>{t('acct.forgot')}</button
          >
        {:else if mode === 'forgot'}
          <button
            type="button"
            class="link"
            onclick={() => {
              mode = 'signin';
              message = null;
            }}>{t('acct.back')}</button
          >
        {/if}
      </div>
    </form>
    <p class="help">{t('acct.merge')}</p>
  {/if}

  {#if message}
    <p class="msg {message.kind}" role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p>
  {/if}

  <button class="link small" onclick={() => (showServer = !showServer)} aria-expanded={showServer}>
    {showServer ? '▾' : '▸'}
    {t('acct.server')}
    {configuredAtBuild() ? t('acct.bySite') : configured ? t('acct.custom') : t('acct.notSet')}
  </button>
  {#if showServer}
    <form class="server" onsubmit={saveServer}>
      <p class="help">
        {t('acct.admin')}
        {#if configuredAtBuild()}{t('acct.override')}{/if}
        {t('acct.run1')} <code>docs/supabase.sql</code>
        {t('acct.run2')}
      </p>
      <input class="input" bind:value={serverUrl} placeholder="https://xxxx.supabase.co" aria-label={t('acct.url')} />
      <input class="input" bind:value={serverKey} placeholder={t('acct.keyPh')} aria-label={t('acct.keyLabel')} />
      <div class="btns"><button class="btn sm" type="submit" disabled={busy}>{t('acct.saveServer')}</button></div>
    </form>
  {/if}
</section>

<style>
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
  .grow-r {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
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
  .tabs {
    display: flex;
    gap: 4px;
    margin-bottom: 10px;
    border-bottom: 1px solid var(--border);
  }
  .tabs button {
    padding: 8px 12px;
    border-bottom: 2px solid transparent;
    color: var(--text-muted);
    font-weight: 600;
    font-size: 14px;
  }
  .tabs button.on {
    color: var(--text);
    border-bottom-color: var(--accent);
  }
  .auth {
    display: grid;
    gap: 10px;
    max-width: 420px;
  }
  .auth label {
    display: grid;
    gap: 4px;
    font-size: 13px;
    color: var(--text-muted);
  }
  .server {
    display: grid;
    gap: 8px;
    max-width: 520px;
    margin-top: 6px;
  }
  .link {
    background: none;
    padding: 0;
    color: var(--accent-text);
    font-size: 13px;
  }
  .link.small {
    margin-top: 8px;
    color: var(--text-muted);
  }
  .msg {
    font-size: 13px;
    margin: 8px 0;
    padding: 8px 10px;
    border-radius: var(--radius-sm, 8px);
    background: var(--bg-sunken, var(--bg-elev));
  }
  .msg.ok {
    color: var(--success-text);
  }
  .msg.error {
    color: var(--danger-text);
  }
</style>
