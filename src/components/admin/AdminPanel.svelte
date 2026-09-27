<script lang="ts">
  // The hidden admin panel: Ctrl+Alt+Shift+A, ?admin in the address, or tap the version in Settings → Help 7 times.
  // Opens only with the admin passphrase. English only (it's for the site owner).
  import { onMount } from 'svelte';
  import { focusTrap } from '../../lib/focusTrap';
  import { adminAuth } from '../../lib/adminAuth.svelte';
  import { ui } from '../../lib/ui.svelte';
  import AdminOverview from './AdminOverview.svelte';
  import AdminEconomy from './AdminEconomy.svelte';
  import AdminSite from './AdminSite.svelte';
  import AdminArcade from './AdminArcade.svelte';
  import AdminData from './AdminData.svelte';
  import AdminDebug from './AdminDebug.svelte';
  import AdminSecurity from './AdminSecurity.svelte';

  let { onclose }: { onclose: () => void } = $props();

  const TABS = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'economy', label: '🪙 Economy' },
    { id: 'site', label: '📣 Site' },
    { id: 'arcade', label: '🕹️ Arcade' },
    { id: 'data', label: '🗄️ Data' },
    { id: 'debug', label: '🛠️ Debug' },
    { id: 'security', label: '🔐 Security' },
  ] as const;
  let tab = $state<(typeof TABS)[number]['id']>('overview');

  let pass = $state('');
  let pass2 = $state('');
  let error = $state('');
  let busy = $state(false);
  let now = $state(Date.now());

  onMount(() => {
    void adminAuth.load();
    const iv = setInterval(() => (now = Date.now()), 1000);
    return () => clearInterval(iv);
  });

  const lockedFor = $derived(Math.max(0, Math.ceil((adminAuth.lockedUntil - now) / 1000)));

  async function submit(e: Event) {
    e.preventDefault();
    if (busy) return;
    error = '';
    busy = true;
    try {
      if (adminAuth.source === 'none') {
        if (pass !== pass2) throw new Error('The two passphrases don’t match.');
        await adminAuth.setup(pass);
      } else if (!(await adminAuth.unlock(pass))) {
        error = lockedFor || adminAuth.lockedUntil > Date.now() ? 'Too many wrong tries. Wait a bit.' : 'That’s not it.';
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      pass = pass2 = '';
      busy = false;
    }
  }
</script>

<div class="modal-backdrop" onkeydown={(e) => e.key === 'Escape' && onclose()} role="presentation">
  <div use:focusTrap class="modal admin" class:wide={ui.adminUnlocked} role="dialog" aria-modal="true" aria-labelledby="admin-h" tabindex="-1">
    <header>
      <h2 id="admin-h">🛡️ Admin</h2>
      <span class="grow"></span>
      {#if ui.adminUnlocked}<button class="btn ghost sm" onclick={() => adminAuth.lock()}>Lock</button>{/if}
      <button class="btn ghost sm icon" aria-label="Close" onclick={onclose}>×</button>
    </header>

    {#if !adminAuth.ready}
      <p class="muted">Loading…</p>
    {:else if !ui.adminUnlocked}
      <form onsubmit={submit} class="gate">
        {#if adminAuth.source === 'none'}
          <p class="muted">
            Choose an admin passphrase for this device (8+ characters). To use the same one on every device, copy its hash from Security afterwards into the
            <code>VITE_ADMIN_HASH</code> build variable.
          </p>
          <input class="input" type="password" bind:value={pass} placeholder="New admin passphrase" aria-label="New admin passphrase" autocomplete="new-password" />
          <input class="input" type="password" bind:value={pass2} placeholder="Repeat it" aria-label="Repeat admin passphrase" autocomplete="new-password" />
        {:else}
          <!-- svelte-ignore a11y_autofocus -->
          <input class="input" type="password" bind:value={pass} placeholder="Admin passphrase" aria-label="Admin passphrase" autocomplete="current-password" autofocus />
        {/if}
        {#if lockedFor}<p class="err" role="alert">Locked for {lockedFor}s after too many wrong tries.</p>{:else if error}<p class="err" role="alert">{error}</p>{/if}
        <div class="actions">
          <button type="button" class="btn ghost" onclick={onclose}>Cancel</button>
          <button type="submit" class="btn primary" disabled={!pass || busy || lockedFor > 0}
            >{busy ? 'Checking…' : adminAuth.source === 'none' ? 'Set passphrase' : 'Unlock'}</button
          >
        </div>
      </form>
    {:else}
      <div class="tabs" role="tablist" aria-label="Admin sections">
        {#each TABS as t (t.id)}
          <button role="tab" aria-selected={tab === t.id} class:on={tab === t.id} onclick={() => (tab = t.id)}>{t.label}</button>
        {/each}
      </div>
      <div class="body" role="tabpanel">
        {#if tab === 'overview'}<AdminOverview />
        {:else if tab === 'economy'}<AdminEconomy />
        {:else if tab === 'site'}<AdminSite />
        {:else if tab === 'arcade'}<AdminArcade />
        {:else if tab === 'data'}<AdminData />
        {:else if tab === 'debug'}<AdminDebug />
        {:else}<AdminSecurity />{/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .admin {
    width: min(420px, 94vw);
  }
  .admin.wide {
    width: min(980px, 96vw);
    max-height: 92vh;
    display: flex;
    flex-direction: column;
  }
  header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }
  h2 {
    margin: 0;
    font-size: 18px;
  }
  .grow {
    flex: 1;
  }
  .gate {
    display: grid;
    gap: 8px;
  }
  .muted {
    color: var(--text-muted);
    font-size: 13px;
  }
  .err {
    color: var(--danger-text);
    font-size: 13px;
    margin: 0;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
  code {
    font-family: var(--mono);
    font-size: 12px;
  }
  .tabs {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
    border-bottom: 1px solid var(--border);
    padding-bottom: 8px;
  }
  .tabs button {
    background: none;
    border: 1px solid transparent;
    color: var(--text-muted);
    padding: 6px 10px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font: inherit;
    font-size: 13px;
  }
  .tabs button.on {
    color: var(--text);
    background: var(--bg-hover);
    border-color: var(--border);
  }
  .body {
    overflow: auto;
    padding-top: 12px;
    min-height: 0;
  }
</style>
