<script lang="ts">
  // Admin → Debug: the session's error log, notification and service-worker tools, and resets for testing.
  import { errorLog, type LoggedError } from '../../lib/errlog';
  import { notify } from '../../lib/reminders';
  import { store } from '../../lib/store.svelte';
  import { ui } from '../../lib/ui.svelte';
  import { USAGE_KEY } from '../../lib/aiusage';
  import { toasts } from '../../lib/toast.svelte';
  import { downloadText } from '../../lib/download';

  let errors = $state<LoggedError[]>([...errorLog]);
  const refresh = () => (errors = [...errorLog]);

  async function clearCaches() {
    const names = await caches.keys();
    await Promise.all(names.map((n) => caches.delete(n)));
    toasts.push({ message: `Cleared ${names.length} caches`, detail: 'Reload to fetch everything fresh.', kind: 'success' });
  }
  async function checkUpdate() {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (!reg) return toasts.push({ message: 'No service worker here', kind: 'info' });
    await reg.update();
    toasts.push({ message: reg.waiting || reg.installing ? 'An update is on its way' : 'Already up to date', kind: 'info' });
  }
  async function unregister() {
    if (!confirm('Unregister the service worker? The app stops working offline until the next visit.')) return;
    const regs = (await navigator.serviceWorker?.getRegistrations()) ?? [];
    await Promise.all(regs.map((r) => r.unregister()));
    toasts.push({ message: `Unregistered ${regs.length}`, kind: 'success' });
  }
  function reset(key: string, label: string) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* blocked */
    }
    toasts.push({ message: `${label} reset`, kind: 'success' });
  }
  function exportErrors() {
    downloadText(
      'errors.json',
      JSON.stringify({ at: new Date().toISOString(), userAgent: navigator.userAgent, build: __CHANGELOG_HEAD__, errors: errorLog }, null, 2),
      'application/json',
    );
  }
</script>

<section class="card">
  <h3>Errors this session <span class="muted">({errors.length})</span></h3>
  {#if errors.length}
    <ul class="errs">
      {#each errors.slice().reverse() as e, i (i)}
        <li>
          <span class="muted">{new Date(e.at).toLocaleTimeString()}</span>
          {e.message}{#if e.source}<span class="muted"> · {e.source}</span>{/if}
        </li>
      {/each}
    </ul>
  {:else}
    <p class="muted">None so far.</p>
  {/if}
  <div class="row">
    <button class="btn sm" onclick={refresh}>Refresh</button>
    <button class="btn ghost sm" onclick={exportErrors} disabled={!errors.length}>Download as JSON</button>
  </div>
</section>

<section class="card">
  <h3>App and service worker</h3>
  <div class="row">
    <button class="btn sm" onclick={() => notify('🔔 Test notification', 'Notifications work on this device.', 'admin-test')}>Send a test notification</button>
    <button class="btn sm" onclick={() => void checkUpdate()}>Check for an update</button>
    <button class="btn sm" onclick={() => void clearCaches()}>Clear caches</button>
    <button class="btn ghost sm danger" onclick={() => void unregister()}>Unregister service worker</button>
    <button class="btn sm" onclick={() => location.reload()}>Reload</button>
  </div>
</section>

<section class="card">
  <h3>Resets for testing</h3>
  <div class="row">
    <button class="btn sm" onclick={() => ((ui.admin = false), store.updateSettings({ onboarded: false }))}>Show the welcome tour</button>
    <button class="btn sm" onclick={() => ((ui.admin = false), (ui.whatsNew = true))}>Show What's new</button>
    <button class="btn sm" onclick={() => store.updateSettings({ lastSeenChangelog: undefined })}>Forget which changelog was seen</button>
    <button class="btn sm" onclick={() => reset(USAGE_KEY, 'AI usage meter')}>Reset the AI usage meter</button>
    <button class="btn sm" onclick={() => reset('homework-todo:arcade-scores', 'Arcade high scores')}>Reset arcade high scores</button>
    <button class="btn sm" onclick={() => reset('homework-todo:reminders-sent', 'Sent reminders')}>Forget sent reminders</button>
  </div>
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
    font-size: 12px;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 8px 0;
  }
  .errs {
    font-family: var(--mono);
    font-size: 12px;
    max-height: 240px;
    overflow: auto;
    padding-left: 18px;
  }
</style>
