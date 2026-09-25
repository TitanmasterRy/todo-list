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
  const LABELS: Record<string, string> = {
    gistToken: 'GitHub token',
    aiApiKey: 'Anthropic key',
    schoologyFeedUrl: 'Schoology feed URL',
    canvasFeedUrl: 'Canvas feed URL',
    schoologyKey: 'Schoology API key',
    schoologySecret: 'Schoology API secret',
    spotifyRefreshToken: 'Spotify sign-in',
    syncPassphrase: 'Sync passphrase',
  };
  const label = (slot: SecretSlot) => LABELS[slot] ?? `${slot.slice(7).replace(/^./, (c) => c.toUpperCase())} AI key`;

  // ---------- key lock ----------
  let lockPass = $state('');
  let lockPass2 = $state('');
  let lockBusy = $state(false);
  let changing = $state(false);
  let confirmForget = $state(false);
  const lockProblem = $derived(lockPass.length < MIN ? `Use at least ${MIN} characters.` : lockPass !== lockPass2 ? 'The two passphrases don’t match.' : '');

  async function run(fn: () => Promise<void>, ok: string) {
    lockBusy = true;
    try {
      await fn();
      toasts.push({ message: ok, kind: 'success', emoji: '🔐' });
      lockPass = lockPass2 = '';
      changing = false;
    } catch (e) {
      toasts.push({ message: 'That didn’t work', detail: e instanceof Error ? e.message : String(e), kind: 'warn' });
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
  const syncProblem = $derived(syncPass.length < MIN ? `Use at least ${MIN} characters.` : syncPass !== syncPass2 ? 'The two passphrases don’t match.' : '');
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
      message: old ? 'Sync passphrase changed' : 'End-to-end encryption on',
      detail: anySync ? 'Your synced copy is being re-encrypted now. Enter the same passphrase on your other devices.' : 'Synced copies will be encrypted from now on.',
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
    toasts.push({ message: 'End-to-end encryption off', detail: 'The next sync stores a plain copy again.', kind: 'info' });
    resync();
  }
</script>

<section class="card" id="privacy">
  <h2>{t('settings.privacy')}</h2>
  <p class="help">
    Everything lives on this device unless you switch on a sync or an integration. There are no analytics, ads or trackers, and this site has no server of its own.
  </p>

  <h3 class="sub">Lock my keys with a passphrase</h3>
  <p class="help">
    API keys and tokens (AI keys, GitHub token, Schoology keys and feed link, Spotify sign-in, sync passphrase) are stored encrypted (AES-256-GCM, key from your passphrase with
    PBKDF2) instead of in plain text. You enter the passphrase once each time you open the app: right away if a sync needs a key, otherwise the first time you use a feature that
    does.
  </p>
  {#if !vault.enabled}
    <form
      class="btns"
      onsubmit={(e) => {
        e.preventDefault();
        if (!lockProblem) void run(() => enableLock(lockPass), 'Keys locked with your passphrase');
      }}
    >
      <input class="input" type="password" bind:value={lockPass} placeholder="New passphrase" aria-label="Key passphrase" autocomplete="new-password" />
      <input class="input" type="password" bind:value={lockPass2} placeholder="Repeat it" aria-label="Repeat key passphrase" autocomplete="new-password" />
      <button class="btn primary" type="submit" disabled={lockBusy || !!lockProblem}>{lockBusy ? 'Locking…' : 'Lock my keys'}</button>
    </form>
    {#if lockPass && lockProblem}<p class="help warn">{lockProblem}</p>{/if}
  {:else}
    <div class="row">
      <span>Status</span>
      <span class="status" class:ok={vault.unlocked}>{vault.unlocked ? 'On · unlocked for this session' : 'On · locked'}</span>
    </div>
    <p class="help">Protected: {savedSlots.length ? savedSlots.map(label).join(', ') : 'nothing saved yet (new keys are encrypted as you add them)'}.</p>
    <div class="btns">
      {#if vault.unlocked}
        <button class="btn" onclick={lockNow}>Lock now</button>
        <button class="btn" onclick={() => (changing = !changing)}>Change passphrase</button>
        <button class="btn" onclick={() => void run(disableLock, 'Passphrase removed: keys are stored in plain text again')}>Remove passphrase</button>
      {:else}
        <button class="btn primary" onclick={() => void requestUnlock()}>Unlock</button>
      {/if}
      <button class="btn danger" onclick={() => (confirmForget = true)}>Forget passphrase…</button>
    </div>
    {#if changing && vault.unlocked}
      <form
        class="btns"
        onsubmit={(e) => {
          e.preventDefault();
          if (!lockProblem) void run(() => changePassphrase(lockPass), 'Passphrase changed');
        }}
      >
        <input class="input" type="password" bind:value={lockPass} placeholder="New passphrase" aria-label="New key passphrase" autocomplete="new-password" />
        <input class="input" type="password" bind:value={lockPass2} placeholder="Repeat it" aria-label="Repeat new key passphrase" autocomplete="new-password" />
        <button class="btn primary" type="submit" disabled={lockBusy || !!lockProblem}>Save</button>
      </form>
    {/if}
    {#if confirmForget}
      <div class="confirm">
        <p class="help">Forgetting the passphrase deletes every saved key and token on this device. Your tasks and other data stay. You'll add the keys again afterwards.</p>
        <div class="btns">
          <button
            class="btn danger"
            onclick={() => {
              forgetVault();
              confirmForget = false;
              toasts.push({ message: 'Saved keys deleted', kind: 'warn' });
            }}>Delete my saved keys</button
          >
          <button class="btn ghost" onclick={() => (confirmForget = false)}>Cancel</button>
        </div>
      </div>
    {/if}
  {/if}

  <h3 class="sub">End-to-end encrypt my synced copy</h3>
  <p class="help">
    The copy stored on GitHub (Gist), Google Drive and the account server is encrypted in this browser before it's uploaded, so those services only ever see scrambled data. Use the
    same passphrase on every device. Copies made before you turn this on are read as they are and replaced with an encrypted one on the next sync.
  </p>
  <p class="help warn">If you forget this passphrase, the synced copy can't be read by anyone, including you. The data on this device is not affected.</p>
  {#if syncOn && !syncChanging}
    <div class="row">
      <span>Status</span>
      <span class="status ok">{isLocked('syncPassphrase') ? 'On · locked with your keys' : 'On'}</span>
    </div>
    <div class="btns">
      <button class="btn" onclick={() => (syncChanging = true)}>Change sync passphrase</button>
      <button class="btn" onclick={() => void turnOffSync()}>Turn off</button>
    </div>
  {:else}
    <form
      class="btns"
      onsubmit={(e) => {
        e.preventDefault();
        saveSyncPass();
      }}
    >
      <input class="input" type="password" bind:value={syncPass} placeholder="Sync passphrase" aria-label="Sync passphrase" autocomplete="new-password" />
      <input class="input" type="password" bind:value={syncPass2} placeholder="Repeat it" aria-label="Repeat sync passphrase" autocomplete="new-password" />
      <button class="btn primary" type="submit" disabled={!!syncProblem}>{syncOn ? 'Save new passphrase' : 'Turn on'}</button>
      {#if syncChanging}<button class="btn ghost" type="button" onclick={() => (syncChanging = false)}>Cancel</button>{/if}
    </form>
    {#if syncPass && syncProblem}<p class="help warn">{syncProblem}</p>{/if}
    {#if syncChanging}<p class="help">Other devices will need the new passphrase; until then they show a “doesn't match” error and don't overwrite the copy.</p>{/if}
  {/if}

  <details class="where">
    <summary>What goes where</summary>
    <ul>
      <li>
        <strong>This device:</strong> tasks, courses, notecards, stats, coins and attachments in the browser's IndexedDB; settings and keys in localStorage. Nothing leaves it unless
        you turn on one of the features below.
      </li>
      <li>
        <strong>GitHub Gist sync:</strong> your data (tasks, courses, templates, notecards, day notes, stats, coins, deletions) goes to a private gist on your account via api.github.com,
        with your token. Encrypted if you turn that on above.
      </li>
      <li>
        <strong>Google:</strong> sign-in runs through Google Identity Services (accounts.google.com). Gmail scanning reads the subject, sender, date and preview line of emails that match
        your search; Classroom is read-only; Calendar push creates one event per dated task (title, course, notes, due time); Drive sync stores your data in the app's private Drive folder.
        All requests go straight from your browser to Google; the sign-in token stays in memory.
      </li>
      <li>
        <strong>Account (email and password):</strong> your email and password go to this site's Supabase project, which keeps one row with your synced data (encrypted if you turn that
        on). Settings and keys are never part of it.
      </li>
      <li>
        <strong>AI helper:</strong> the text you ask about (a question, notes you paste, a task title, photos you scan) goes to the provider you picked, with your own key. Ollama runs
        on your computer and sends nothing out.
      </li>
      <li>
        <strong>Schoology:</strong> the app fetches your calendar feed or the Schoology API, directly or through the relay you deploy; your key signs requests in the browser and the
        secret is never sent.
      </li>
      <li>
        <strong>Spotify and music embeds:</strong> Spotify gets its own sign-in and playback commands. Embedded players (Spotify, YouTube, SoundCloud, Apple Music) are loaded from those
        sites, which may set their own cookies.
      </li>
      <li>
        <strong>Tools:</strong> DOI lookups go to api.crossref.org and ISBN lookups to openlibrary.org. Python and on-device text recognition download their engines from cdn.jsdelivr.net
        the first time; your code and photos stay here. Java and C++ open onecompiler.com in a new tab.
      </li>
      <li><strong>Arcade:</strong> games run in sandboxed frames with no access to your data. Embed-link games load from their own sites.</li>
      <li>
        <strong>Study rooms, friends, class mode:</strong> links and codes go only where you send them. A room link holds the room's name and timer; a friend code holds your name, emoji,
        streak, best streak, this week's XP, level and when it was made; a published class list holds the course and its assignments' titles, due dates, types, notes and links (a gist
        is public). With an account, "Show who's in" and a live friend card use this site's Supabase project.
      </li>
    </ul>
    <p class="help">
      The page's Content-Security-Policy only allows connections to these services. Full details: <a
        href="https://github.com/TitanmasterRy/todo-list/blob/main/PRIVACY.md"
        target="_blank"
        rel="noopener noreferrer">PRIVACY.md</a
      >.
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
