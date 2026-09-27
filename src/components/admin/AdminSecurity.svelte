<script lang="ts">
  // Admin → Security: change the passphrase, make a hash for VITE_ADMIN_HASH, and what the panel can and can't protect.
  import { adminAuth } from '../../lib/adminAuth.svelte';
  import { hashPassphrase } from '../../lib/admin';
  import { toasts } from '../../lib/toast.svelte';

  let current = $state('');
  let next = $state('');
  let next2 = $state('');
  let forHash = $state('');
  let hash = $state('');
  let busy = $state(false);

  async function change(e: Event) {
    e.preventDefault();
    if (next !== next2) return toasts.push({ message: 'The new passphrases don’t match', kind: 'warn' });
    busy = true;
    try {
      await adminAuth.changePassphrase(current, next);
      toasts.push({ message: 'Admin passphrase changed', kind: 'success' });
      current = next = next2 = '';
    } catch (err) {
      toasts.push({ message: 'Not changed', detail: err instanceof Error ? err.message : String(err), kind: 'warn' });
    } finally {
      busy = false;
    }
  }

  async function makeHash(e: Event) {
    e.preventDefault();
    if (forHash.length < 8) return toasts.push({ message: 'Use at least 8 characters', kind: 'warn' });
    busy = true;
    hash = await hashPassphrase(forHash);
    forHash = '';
    busy = false;
  }
</script>

<section class="card">
  <h3>Passphrase</h3>
  <p class="muted">
    {#if adminAuth.source === 'build'}
      This site's admin passphrase is set at build time (<code>VITE_ADMIN_HASH</code>), so it's the same on every device. To change it, make a new hash below and update the
      variable.
    {:else}
      The passphrase is set on this device only. To use one passphrase everywhere (and stop anyone else from setting one on a fresh device), put a hash in the
      <code>VITE_ADMIN_HASH</code> build variable. On GitHub Pages: repo Settings → Secrets and variables → Actions → Variables → <code>VITE_ADMIN_HASH</code>.
    {/if}
  </p>
  {#if adminAuth.source === 'device'}
    <form class="row" onsubmit={change}>
      <input class="input" type="password" bind:value={current} placeholder="Current passphrase" aria-label="Current admin passphrase" autocomplete="current-password" />
      <input class="input" type="password" bind:value={next} placeholder="New passphrase" aria-label="New admin passphrase" autocomplete="new-password" />
      <input class="input" type="password" bind:value={next2} placeholder="Repeat new" aria-label="Repeat new admin passphrase" autocomplete="new-password" />
      <button class="btn sm primary" disabled={busy || !current || !next}>Change</button>
    </form>
  {/if}
  <form class="row" onsubmit={makeHash}>
    <input class="input grow" type="password" bind:value={forHash} placeholder="Passphrase to hash" aria-label="Passphrase to hash" autocomplete="new-password" />
    <button class="btn sm" disabled={busy || !forHash}>Make VITE_ADMIN_HASH</button>
  </form>
  {#if hash}<pre class="hash">{hash}</pre>{/if}
</section>

<section class="card">
  <h3>What this protects</h3>
  <ul class="muted">
    <li>The panel is hidden and needs the passphrase. Five wrong tries lock it for a few minutes, longer each time.</li>
    <li>Your GitHub token is encrypted with the passphrase and never leaves this device except to talk to GitHub.</li>
    <li>
      The app runs entirely in the browser, so the panel can only change <em>this</em> browser's data. Someone who knows web developer tools could edit their own data without it too.
      Site-wide changes (announcements, switches, arcade games) need the GitHub token, which is the real key to your site.
    </li>
  </ul>
</section>

<style>
  section {
    margin-bottom: 12px;
  }
  h3 {
    margin: 0 0 8px;
    font-size: 15px;
  }
  .muted {
    color: var(--text-muted);
    font-size: 13px;
  }
  ul.muted {
    padding-left: 18px;
    margin: 0;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 8px 0;
  }
  .row .input {
    width: auto;
  }
  .grow {
    flex: 1;
  }
  code,
  .hash {
    font-family: var(--mono);
    font-size: 12px;
  }
  .hash {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 8px;
    word-break: break-all;
    white-space: pre-wrap;
    user-select: all;
  }
</style>
