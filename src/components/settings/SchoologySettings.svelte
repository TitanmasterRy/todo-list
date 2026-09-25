<script lang="ts">
  // Settings → Schoology sync: feed URL, status and quick actions (full setup lives in the Schoology view).
  import { store } from '../../lib/store.svelte';
  import { schoology, syncNow as syncSchoology } from '../../lib/schoologySync.svelte';
  import { forgetSecret, hasSecret, secret } from '../../lib/secrets.svelte';
  import { set } from './settings';
  import { t } from '../../lib/i18n/index.svelte';
  const s = $derived(store.settings);
  let schoologyUrl = $state(secret('schoologyFeedUrl'));
  let schoologyProxy = $state(store.settings.schoologyProxy);
</script>

<section class="card">
  <h2>{t('settings.schoology')} <span class="chip optional">{t('settings.optional')}</span></h2>
  <p class="help">
    Mode: <strong>{s.schoologyMode === 'api' ? 'API sign-in (assignments + grades)' : 'calendar feed (assignments)'}</strong>, syncing every {s.schoologyIntervalMin} min. Full setup
    (API key sign-in, proxy, manual import) lives in the <button class="link" onclick={() => store.go('schoology')}>Schoology view</button>.
  </p>
  <form
    class="btns"
    onsubmit={(e) => {
      e.preventDefault();
      store.updateSettings({ schoologyFeedUrl: schoologyUrl.trim(), schoologyProxy: schoologyProxy.trim() });
      if (schoologyUrl.trim()) void syncSchoology();
    }}
  >
    <input class="input" bind:value={schoologyUrl} placeholder="https://app.schoology.com/calendar/feed/ical/…/schoology.ics" aria-label="Schoology feed URL" />
    <input class="input" bind:value={schoologyProxy} placeholder="CORS proxy prefix (optional)" aria-label="CORS proxy" />
    <button class="btn primary" type="submit">Save</button>
  </form>
  {#if hasSecret('schoologyFeedUrl')}
    <div class="row">
      <span>Status</span><span class="status {schoology.status}"
        >{schoology.status === 'error' ? `Error: ${schoology.lastError}` : schoology.status}{#if s.lastSchoologySync}<span class="muted">
            · last {new Date(s.lastSchoologySync).toLocaleString()}</span
          >{/if}</span
      >
    </div>
    <div class="row">
      <label for="sauto">Create courses for new class names</label>
      <input
        id="sauto"
        type="checkbox"
        class="switch"
        checked={s.schoologyAutoCreateCourses}
        onchange={(e) => set('schoologyAutoCreateCourses', (e.target as HTMLInputElement).checked)}
      />
    </div>
    <div class="btns">
      <button class="btn" onclick={() => void syncSchoology()}>Sync now</button>
      <button
        class="btn danger"
        onclick={() => {
          forgetSecret('schoologyFeedUrl');
          schoologyUrl = '';
        }}>Disconnect</button
      >
      {#if s.schoologyIgnored.length}<button class="btn ghost sm" onclick={() => set('schoologyIgnored', [])}
          >Forget {s.schoologyIgnored.length} deleted assignment{s.schoologyIgnored.length > 1 ? 's' : ''}</button
        >{/if}
    </div>
  {/if}
</section>

<style>
  section {
    margin-bottom: 12px;
  }
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
  .row label {
    color: var(--text);
  }
  .row > span:first-child {
    color: var(--text);
  }
  .switch {
    width: 40px;
    height: 22px;
    appearance: none;
    background: var(--border-strong);
    border-radius: 999px;
    position: relative;
    cursor: pointer;
    transition: background var(--dur);
    flex-shrink: 0;
  }
  .switch::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #fff;
    transition: transform var(--dur) var(--spring);
  }
  .switch:checked {
    background: var(--accent);
  }
  .switch:checked::after {
    transform: translateX(18px);
  }
  .link {
    color: var(--accent-text);
    font-weight: 500;
  }
  .help {
    font-size: 13px;
    color: var(--text-muted);
    margin: 6px 0;
  }
  .muted {
    color: var(--text-muted);
    font-weight: 400;
    font-size: 13px;
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
    color: var(--success-text);
  }
  .status.error {
    color: var(--danger-text);
  }
  .chip.optional {
    text-transform: uppercase;
    font-size: 10px;
    letter-spacing: 0.06em;
  }
  .ok {
    font-size: 11px;
    color: var(--text-muted);
  }
</style>
