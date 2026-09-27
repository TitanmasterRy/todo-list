<script lang="ts">
  // Tools → Connect → Canvas: sync assignments from your Canvas calendar feed (Calendar → Calendar Feed).
  import { store } from '../../lib/store.svelte';
  import { toasts } from '../../lib/toast.svelte';
  import { forgetSecret, hasSecret, secret } from '../../lib/secrets.svelte';
  import { isCanvasFeedUrl } from '../../lib/canvas';
  import { applyCanvasText, canvas, startCanvasSync, syncCanvas } from '../../lib/canvasSync.svelte';
  import { formatDateTime } from '../../lib/dates';
  import { t } from '../../lib/i18n/index.svelte';

  let url = $state(secret('canvasFeedUrl'));
  let proxy = $state(store.settings.schoologyProxy);
  const connected = $derived(hasSecret('canvasFeedUrl'));
  const valid = $derived(isCanvasFeedUrl(url));
  const synced = $derived(store.tasks.filter((t) => t.source === 'canvas').length);

  async function save(e: SubmitEvent) {
    e.preventDefault();
    if (!valid) return;
    store.updateSettings({ canvasFeedUrl: url.trim(), schoologyProxy: proxy.trim() });
    startCanvasSync();
    await syncCanvas();
  }
  async function upload(e: Event) {
    const f = (e.currentTarget as HTMLInputElement).files?.[0];
    (e.currentTarget as HTMLInputElement).value = '';
    if (!f) return;
    try {
      const r = applyCanvasText(await f.text());
      toasts.push({ message: t('canvas.imported', { created: r.created, updated: r.updated }), detail: t('canvas.inFile', { n: r.total }), kind: 'success', emoji: '🎨' });
    } catch (err) {
      toasts.push({ message: t('common.readFailed'), detail: err instanceof Error ? err.message : String(err), kind: 'warn' });
    }
  }
</script>

<section class="card">
  <h2>🎨 Canvas</h2>
  <p class="help">
    {t('canvas.help')}
  </p>
  {#if connected}
    <div class="row">
      <span class="status {canvas.status}">
        {canvas.status === 'syncing'
          ? t('sync.syncing')
          : canvas.status === 'error'
            ? t('sync.error', { error: canvas.lastError ?? '' })
            : store.settings.lastCanvasSync
              ? t('sync.syncedAt', { when: formatDateTime(new Date(store.settings.lastCanvasSync)) })
              : t('sync.connected')}
      </span>
      <span class="muted">· {t('canvas.count', { count: synced })}</span>
      <span class="grow"></span>
      <button class="btn sm" onclick={() => void syncCanvas()} disabled={canvas.status === 'syncing'}>{t('sync.now')}</button>
      <button
        class="btn sm ghost"
        onclick={() => {
          forgetSecret('canvasFeedUrl');
          url = '';
        }}>{t('sync.disconnect')}</button
      >
    </div>
  {/if}
  <form class="grid" onsubmit={save}>
    <label
      >{t('canvas.feed')}
      <input
        class="input"
        bind:value={url}
        placeholder="https://yourschool.instructure.com/feeds/calendars/user_….ics"
        aria-label={t('canvas.feedLabel')}
        autocomplete="off"
        spellcheck="false"
      />
    </label>
    {#if url && !valid}<p class="warn">{t('canvas.invalid')}</p>{/if}
    <label
      >{t('canvas.proxy')}
      <input class="input" bind:value={proxy} placeholder="https://my-relay.workers.dev/?url=" aria-label={t('sync.proxyLabel')} autocomplete="off" />
    </label>
    <label class="chk"
      ><input type="checkbox" checked={!!store.settings.canvasIncludeEvents} onchange={(e) => store.updateSettings({ canvasIncludeEvents: e.currentTarget.checked })} />
      {t('canvas.events')}</label
    >
    <div class="row">
      <button class="btn primary" type="submit" disabled={!valid || canvas.status === 'syncing'}>{connected ? t('sync.saveSync') : t('sync.connect')}</button>
      <label class="btn ghost file">{t('canvas.upload')}<input type="file" accept=".ics,text/calendar" onchange={upload} hidden /></label>
    </div>
  </form>
  <p class="muted">
    {t('canvas.relay')}
  </p>
  <p class="muted">{t('canvas.teams')}</p>
</section>

<style>
  h2 {
    font-size: 16px;
    margin: 0 0 6px;
  }
  .help,
  .muted {
    font-size: 13px;
    color: var(--text-muted);
    margin: 6px 0;
  }
  .warn {
    color: var(--warn-text);
    font-size: 12px;
    margin: 0;
  }
  .grid {
    display: grid;
    gap: 10px;
    max-width: 620px;
    margin: 8px 0;
  }
  .grid label:not(.chk):not(.file) {
    display: grid;
    gap: 4px;
    font-size: 13px;
    color: var(--text-muted);
  }
  .chk {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    font-size: 13px;
  }
  .grow {
    flex: 1;
  }
  .file {
    cursor: pointer;
  }
  .status.ok {
    color: var(--success-text);
  }
  .status.error {
    color: var(--danger-text);
  }
</style>
