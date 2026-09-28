<script lang="ts">
  // Asks for the key-lock passphrase (once per session). Opened by secrets.svelte.ts whenever something needs a locked key.
  import { fly } from 'svelte/transition';
  import { focusTrap } from '../lib/focusTrap';
  import { cancelUnlock, forgetVault, unlock, vault } from '../lib/secrets.svelte';
  import { toasts } from '../lib/toast.svelte';
  import { t } from '../lib/i18n/index.svelte';

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
      toasts.push({ message: t('unlock.done'), kind: 'success', emoji: '🔓' });
    } catch (err) {
      error = err instanceof Error && err.name === 'WrongPassphraseError' ? t('unlock.wrong') : err instanceof Error ? err.message : String(err);
      pass = '';
    } finally {
      busy = false;
    }
  }
  function forget() {
    forgetVault();
    toasts.push({ message: t('priv.deleted'), detail: t('unlock.deletedDetail'), kind: 'warn', timeout: 8000 });
  }
</script>

<div class="modal-backdrop" onkeydown={(e) => e.key === 'Escape' && cancelUnlock()} role="presentation">
  <div use:focusTrap class="modal" role="dialog" aria-modal="true" aria-labelledby="unlock-h" tabindex="-1" in:fly={{ y: 20, duration: 200 }}>
    <h2 id="unlock-h">🔒 {t('unlock.title')}</h2>
    <p class="why">{vault.prompt?.reason}</p>
    <form onsubmit={submit}>
      <!-- svelte-ignore a11y_autofocus -->
      <input class="input" type="password" bind:value={pass} aria-label={t('unlock.pass')} placeholder={t('unlock.pass')} autocomplete="current-password" autofocus />
      {#if error}<p class="err" role="alert">{error}</p>{/if}
      <div class="actions">
        <button type="button" class="btn ghost" onclick={cancelUnlock}>{t('unlock.notNow')}</button>
        <button type="submit" class="btn primary" disabled={!pass || busy}>{busy ? t('unlock.unlocking') : t('eco.unlock')}</button>
      </div>
    </form>
    {#if forgetting}
      <p class="help">
        {t('unlock.forgetHelp')}
      </p>
      <div class="actions">
        <button type="button" class="btn ghost sm" onclick={() => (forgetting = false)}>{t('unlock.keep')}</button>
        <button type="button" class="btn danger sm" onclick={forget}>{t('priv.deleteKeys')}</button>
      </div>
    {:else}
      <button type="button" class="link" onclick={() => (forgetting = true)}>{t('unlock.forgot')}</button>
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
