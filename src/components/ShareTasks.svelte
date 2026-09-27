<script lang="ts">
  // Share the selected tasks as a link (group projects). See lib/sharelist.ts.
  import { fly } from 'svelte/transition';
  import { focusTrap } from '../lib/focusTrap';
  import { store } from '../lib/store.svelte';
  import { toasts } from '../lib/toast.svelte';
  import { buildSharedList, shareLink, SHARE_LIMITS } from '../lib/sharelist';
  import { t } from '../lib/i18n/index.svelte';

  let { ids, onclose }: { ids: string[]; onclose: () => void } = $props();

  let name = $state('');
  let from = $state('');
  let notes = $state(false);
  const tasks = $derived(ids.map((id) => store.byId.get(id)).filter((x) => !!x));
  const link = $derived(shareLink(buildSharedList(tasks, { name, from, notes }), `${location.origin}${location.pathname}`));

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      toasts.push({ message: t('share.copied'), kind: 'success', emoji: '🔗' });
    } catch {
      prompt(t('share.copy'), link);
    }
  }
  async function send() {
    try {
      await navigator.share({ title: name || t('share.title'), url: link });
    } catch {
      /* cancelled */
    }
  }
</script>

<div class="modal-backdrop" onclick={onclose} onkeydown={(e) => e.key === 'Escape' && onclose()} role="presentation">
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div use:focusTrap class="modal" role="dialog" aria-modal="true" aria-labelledby="share-h" tabindex="-1" onclick={(e) => e.stopPropagation()} in:fly={{ y: 20, duration: 200 }}>
    <h2 id="share-h">🔗 {t('share.title')}</h2>
    <p class="muted">{t('share.help')}</p>
    <p><strong>{t('share.count', { count: Math.min(tasks.length, SHARE_LIMITS.items) })}</strong></p>
    {#if tasks.length > SHARE_LIMITS.items}<p class="warn">{t('share.tooMany', { max: SHARE_LIMITS.items })}</p>{/if}
    <label class="field">{t('share.name')} <input class="input" bind:value={name} placeholder={t('share.namePh')} maxlength="60" /></label>
    <label class="field">{t('share.from')} <input class="input" bind:value={from} maxlength="60" /></label>
    <label class="chk"><input type="checkbox" bind:checked={notes} /> {t('share.notes')}</label>
    <input class="input link" readonly value={link} aria-label={t('share.copy')} onfocus={(e) => (e.currentTarget as HTMLInputElement).select()} />
    {#if link.length > 2000}<p class="warn">{t('share.long')}</p>{/if}
    <div class="actions">
      <button class="btn ghost" onclick={onclose}>{t('common.close')}</button>
      {#if 'share' in navigator}<button class="btn" onclick={() => void send()}>{t('share.send')}</button>{/if}
      <button class="btn primary" onclick={() => void copy()}>{t('share.copy')}</button>
    </div>
  </div>
</div>

<style>
  h2 {
    margin: 0 0 8px;
    font-size: 17px;
  }
  .muted {
    color: var(--text-muted);
    font-size: 13px;
  }
  .warn {
    color: var(--warn-text);
    font-size: 13px;
  }
  .field {
    display: grid;
    gap: 4px;
    font-size: 13px;
    color: var(--text-muted);
    margin-bottom: 8px;
  }
  .chk {
    display: flex;
    gap: 6px;
    align-items: center;
    font-size: 13px;
    margin-bottom: 8px;
  }
  .link {
    font-family: var(--mono);
    font-size: 12px;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 12px;
  }
</style>
