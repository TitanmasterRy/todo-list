<script lang="ts">
  // Asks for the key-lock passphrase (once per session). Opened by secrets.svelte.ts whenever something needs a locked key.
  import { fly } from 'svelte/transition';
  import { focusTrap } from '../lib/focusTrap';
  import { cancelUnlock, forgetVault, unlock, vault } from '../lib/secrets.svelte';
  import { toasts } from '../lib/toast.svelte';

  let pass = $state('');
  let busy = $state(false);
  let error = $state('');
  let forgetting = $state(false);

  async function submit(e: Event) {
    e.preventDefault();
    if (!pass || busy) return;
    busy = true;
    error = '';
    try {
      await unlock(pass);
      toasts.push({ message: 'Keys unlocked for this session', kind: 'success', emoji: '🔓' });
    } catch (err) {
      error = err instanceof Error && err.name === 'WrongPassphraseError' ? 'That passphrase is not right. Try again.' : err instanceof Error ? err.message : String(err);
      pass = '';
    } finally {
      busy = false;
    }
  }
  function forget() {
    forgetVault();
    toasts.push({ message: 'Saved keys deleted', detail: 'Your tasks and other data are untouched. Add your keys again in Settings.', kind: 'warn', timeout: 8000 });
  }
</script>

<div class="modal-backdrop" onkeydown={(e) => e.key === 'Escape' && cancelUnlock()} role="presentation">
  <div use:focusTrap class="modal" role="dialog" aria-modal="true" aria-labelledby="unlock-h" tabindex="-1" in:fly={{ y: 20, duration: 200 }}>
    <h2 id="unlock-h">🔒 Unlock your keys</h2>
    <p class="why">{vault.prompt?.reason}</p>
    <form onsubmit={submit}>
      <!-- svelte-ignore a11y_autofocus -->
      <input class="input" type="password" bind:value={pass} aria-label="Passphrase" placeholder="Passphrase" autocomplete="current-password" autofocus />
      {#if error}<p class="err" role="alert">{error}</p>{/if}
      <div class="actions">
        <button type="button" class="btn ghost" onclick={cancelUnlock}>Not now</button>
        <button type="submit" class="btn primary" disabled={!pass || busy}>{busy ? 'Unlocking…' : 'Unlock'}</button>
      </div>
    </form>
    {#if forgetting}
      <p class="help">
        This deletes every saved API key and token on this device. Your tasks and other data stay. You'll need to add your keys again (and your sync passphrase, if you use one).
      </p>
      <div class="actions">
        <button type="button" class="btn ghost sm" onclick={() => (forgetting = false)}>Keep them</button>
        <button type="button" class="btn danger sm" onclick={forget}>Delete my saved keys</button>
      </div>
    {:else}
      <button type="button" class="link" onclick={() => (forgetting = true)}>Forgot the passphrase?</button>
    {/if}
  </div>
</div>

<style>
  .why,
  .help {
    font-size: 14px;
    color: var(--text-muted);
    margin: 0 0 10px;
  }
  .err {
    color: var(--danger-text);
    font-size: 13px;
    margin: 6px 0 0;
  }
  .link {
    background: none;
    border: 0;
    padding: 0;
    color: var(--accent-text);
    text-decoration: underline;
    font-size: 13px;
    cursor: pointer;
    margin-top: 8px;
  }
</style>
