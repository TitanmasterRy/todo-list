<script lang="ts">
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
        return 'If that email has an account, a reset link is on its way. Open it on this device.';
      });
      return;
    }
    if (mode === 'signup') {
      const bad = validateCredentials(email, password);
      if (bad) return void (message = { kind: 'error', text: bad });
      if (password !== password2) return void (message = { kind: 'error', text: 'The passwords don’t match.' });
      void run(async () => {
        const r = await signUp(email, password);
        password = password2 = '';
        if (r === 'confirmEmail') return `Almost done: we sent a confirmation link to ${email.trim()}. Open it, then sign in here.`;
        toasts.push({ message: 'Account created', detail: 'Your tasks now sync to this account.', kind: 'success', emoji: '☁️' });
      });
      return;
    }
    void run(async () => {
      await signIn(email, password);
      password = '';
      toasts.push({ message: 'Signed in', detail: 'Syncing your data…', kind: 'success', emoji: '☁️' });
    });
  }

  function saveServer(e: SubmitEvent) {
    e.preventDefault();
    store.updateSettings({ accountUrl: serverUrl.trim(), accountAnonKey: serverKey.trim() });
    void run(async () => {
      await reconfigure();
      return accountConfig() ? 'Server saved.' : 'Server cleared.';
    });
  }

  const statusText = $derived(
    account.status === 'syncing'
      ? 'Syncing…'
      : account.status === 'error'
        ? `Error: ${account.lastError}`
        : account.pending
          ? 'Changes pending'
          : account.lastSyncAt
            ? `Up to date · ${new Date(account.lastSyncAt).toLocaleString()}`
            : 'Signed in',
  );
</script>

<section class="card" id="account">
  <h2>Account <span class="chip optional">sync</span></h2>

  {#if !configured}
    <p class="help">
      Sign up with an email and password to keep your tasks, courses, notecards, stats and coins in sync on every device. Accounts need a free <a
        href="https://supabase.com"
        target="_blank"
        rel="noopener noreferrer">Supabase</a
      >
      project, which the site admin sets up once (see <code>DEPLOY.md → Accounts</code>).
    </p>
  {:else if account.userId}
    <div class="row"><span>Signed in as</span><strong class="grow-r">{account.email}</strong></div>
    <div class="row"><span>Status</span><span class="status {account.status}">{statusText}</span></div>
    {#if account.recovering}
      <form
        class="btns"
        onsubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            await changePassword(newPassword);
            newPassword = '';
            return 'Password updated.';
          });
        }}
      >
        <input class="input" type="password" bind:value={newPassword} placeholder="New password (min {MIN_PASSWORD})" autocomplete="new-password" aria-label="New password" />
        <button class="btn primary" type="submit" disabled={busy}>Set new password</button>
      </form>
    {/if}
    <div class="btns">
      <button class="btn" onclick={() => void syncNow({ pull: true })} disabled={account.status === 'syncing'}>Sync now</button>
      {#if !account.recovering}<button class="btn ghost sm" onclick={() => (account.recovering = true)}>Change password</button>{/if}
      <button
        class="btn ghost sm"
        onclick={() =>
          void run(async () => {
            await signOut();
            return 'Signed out. Your data stays on this device.';
          })}>Sign out</button
      >
      {#if !confirmDelete}
        <button class="btn ghost sm" onclick={() => (confirmDelete = true)}>Delete synced copy…</button>
      {:else}
        <button
          class="btn danger sm"
          onclick={() =>
            void run(async () => {
              await deleteServerData();
              confirmDelete = false;
              return 'Synced copy deleted from the server. This device keeps its data.';
            })}>Really delete server copy</button
        >
        <button class="btn ghost sm" onclick={() => (confirmDelete = false)}>Cancel</button>
      {/if}
    </div>
    <p class="help">Syncs on load and a few seconds after every change. Settings and API keys stay on each device; everything else syncs.</p>
  {:else}
    <div class="tabs" role="tablist" aria-label="Account">
      <button
        role="tab"
        aria-selected={mode === 'signin'}
        class:on={mode === 'signin'}
        onclick={() => {
          mode = 'signin';
          message = null;
        }}>Sign in</button
      >
      <button
        role="tab"
        aria-selected={mode === 'signup'}
        class:on={mode === 'signup'}
        onclick={() => {
          mode = 'signup';
          message = null;
        }}>Create account</button
      >
    </div>
    <form class="auth" onsubmit={submit}>
      <label>
        <span>Email</span>
        <input class="input" type="email" bind:value={email} autocomplete="email" required placeholder="you@example.com" />
      </label>
      {#if mode !== 'forgot'}
        <label>
          <span>Password</span>
          <input
            class="input"
            type="password"
            bind:value={password}
            autocomplete={mode === 'signup' ? 'new-password' : 'current-password'}
            required
            minlength={mode === 'signup' ? MIN_PASSWORD : undefined}
            placeholder={mode === 'signup' ? `At least ${MIN_PASSWORD} characters` : ''}
          />
        </label>
      {/if}
      {#if mode === 'signup'}
        <label>
          <span>Confirm password</span>
          <input class="input" type="password" bind:value={password2} autocomplete="new-password" required />
        </label>
      {/if}
      <div class="btns">
        <button class="btn primary" type="submit" disabled={busy}>
          {busy ? 'Working…' : mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Send reset link' : 'Sign in'}
        </button>
        {#if mode === 'signin'}
          <button
            type="button"
            class="link"
            onclick={() => {
              mode = 'forgot';
              message = null;
            }}>Forgot password?</button
          >
        {:else if mode === 'forgot'}
          <button
            type="button"
            class="link"
            onclick={() => {
              mode = 'signin';
              message = null;
            }}>Back to sign in</button
          >
        {/if}
      </div>
    </form>
    <p class="help">When you sign in, this device's data is merged with your account's, so nothing is lost.</p>
  {/if}

  {#if message}
    <p class="msg {message.kind}" role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p>
  {/if}

  <button class="link small" onclick={() => (showServer = !showServer)} aria-expanded={showServer}>
    {showServer ? '▾' : '▸'} Server {configuredAtBuild() ? '(set by this site)' : configured ? '(custom)' : '(not set up)'}
  </button>
  {#if showServer}
    <form class="server" onsubmit={saveServer}>
      <p class="help">
        For site admins or self-hosters: paste your Supabase project URL and <em>anon public</em> key (Project Settings → API).
        {#if configuredAtBuild()}This site already has a server configured; fields here override it for this browser only.{/if}
        Run <code>docs/supabase.sql</code> once in the project's SQL editor first.
      </p>
      <input class="input" bind:value={serverUrl} placeholder="https://xxxx.supabase.co" aria-label="Supabase project URL" />
      <input class="input" bind:value={serverKey} placeholder="anon public key" aria-label="Supabase anon key" />
      <div class="btns"><button class="btn sm" type="submit" disabled={busy}>Save server</button></div>
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
    color: var(--success);
  }
  .status.error {
    color: var(--danger);
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
    color: var(--accent);
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
    color: var(--success);
  }
  .msg.error {
    color: var(--danger);
  }
</style>
