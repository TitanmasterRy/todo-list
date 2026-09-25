<script lang="ts">
  // Tools → Connect → Canvas: sync assignments from your Canvas calendar feed (Calendar → Calendar Feed).
  import { store } from '../../lib/store.svelte';
  import { toasts } from '../../lib/toast.svelte';
  import { forgetSecret, hasSecret, secret } from '../../lib/secrets.svelte';
  import { isCanvasFeedUrl } from '../../lib/canvas';
  import { applyCanvasText, canvas, startCanvasSync, syncCanvas } from '../../lib/canvasSync.svelte';

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
      toasts.push({ message: `Canvas: ${r.created} new, ${r.updated} updated`, detail: `${r.total} in the file`, kind: 'success', emoji: '🎨' });
    } catch (err) {
      toasts.push({ message: 'Couldn’t read that file', detail: err instanceof Error ? err.message : String(err), kind: 'warn' });
    }
  }
</script>

<section class="card">
  <h2>🎨 Canvas</h2>
  <p class="help">
    In Canvas, open <strong>Calendar</strong> and click <strong>Calendar Feed</strong> (bottom right), then copy the link. Assignments show up here with their course, due date and a
    link back. Your own notes, completions and deletions stay yours.
  </p>
  {#if connected}
    <div class="row">
      <span class="status {canvas.status}">
        {canvas.status === 'syncing'
          ? 'Syncing…'
          : canvas.status === 'error'
            ? `Error: ${canvas.lastError}`
            : store.settings.lastCanvasSync
              ? `Synced ${new Date(store.settings.lastCanvasSync).toLocaleString()}`
              : 'Connected'}
      </span>
      <span class="muted">· {synced} task{synced === 1 ? '' : 's'} from Canvas</span>
      <span class="grow"></span>
      <button class="btn sm" onclick={() => void syncCanvas()} disabled={canvas.status === 'syncing'}>Sync now</button>
      <button
        class="btn sm ghost"
        onclick={() => {
          forgetSecret('canvasFeedUrl');
          url = '';
        }}>Disconnect</button
      >
    </div>
  {/if}
  <form class="grid" onsubmit={save}>
    <label
      >Feed link
      <input
        class="input"
        bind:value={url}
        placeholder="https://yourschool.instructure.com/feeds/calendars/user_….ics"
        aria-label="Canvas feed link"
        autocomplete="off"
        spellcheck="false"
      />
    </label>
    {#if url && !valid}<p class="warn">That doesn’t look like a Canvas calendar feed (it ends in /feeds/calendars/user_….ics).</p>{/if}
    <label
      >CORS proxy prefix (optional, shared with Schoology)
      <input class="input" bind:value={proxy} placeholder="https://my-relay.workers.dev/?url=" aria-label="CORS proxy prefix" autocomplete="off" />
    </label>
    <label class="chk"
      ><input type="checkbox" checked={!!store.settings.canvasIncludeEvents} onchange={(e) => store.updateSettings({ canvasIncludeEvents: e.currentTarget.checked })} /> Also add calendar
      events (not just assignments)</label
    >
    <div class="row">
      <button class="btn primary" type="submit" disabled={!valid || canvas.status === 'syncing'}>{connected ? 'Save and sync' : 'Connect'}</button>
      <label class="btn ghost file">Or upload the .ics file<input type="file" accept=".ics,text/calendar" onchange={upload} hidden /></label>
    </div>
  </form>
  <p class="muted">
    Browsers usually can't read Canvas feeds directly, so syncing goes through your CORS relay (see DEPLOY.md; the relay allows *.instructure.com, and your school's own Canvas
    address with EXTRA_FEED_HOSTS). The feed link is private: it stays on this device and is covered by the key lock.
  </p>
  <p class="muted">Microsoft Teams Assignments has no calendar feed yet; add those with the Syllabus box or quick add.</p>
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
