<script lang="ts">
  // Settings → Schoology sync: feed URL, status and quick actions (full setup lives in the Schoology view).
  import { store } from '../../lib/store.svelte';
  import { schoology, syncNow as syncSchoology } from '../../lib/schoologySync.svelte';
  import { forgetSecret, hasSecret, secret } from '../../lib/secrets.svelte';
  import { set } from './settings';
  import { t } from '../../lib/i18n/index.svelte';
  import { formatDateTime } from '../../lib/dates';
  const s = $derived(store.settings);
  let schoologyUrl = $state(secret('schoologyFeedUrl'));
  let schoologyProxy = $state(store.settings.schoologyProxy);
</script>

<section class="card">
  <h2>{t('settings.schoology')} <span class="chip optional">{t('settings.optional')}</span></h2>
  <p class="help">
    {t('sgys.mode')} <strong>{s.schoologyMode === 'api' ? t('sgys.api') : t('sgys.ics')}</strong>, {t('sgys.every', { n: s.schoologyIntervalMin })}
    {t('sgys.full')} <button class="link" onclick={() => store.go('schoology')}>{t('sgys.view')}</button>.
  </p>
  <form
    class="btns"
    onsubmit={(e) => {
      e.preventDefault();
      store.updateSettings({ schoologyFeedUrl: schoologyUrl.trim(), schoologyProxy: schoologyProxy.trim() });
      if (schoologyUrl.trim()) void syncSchoology();
    }}
  >
    <input class="input" bind:value={schoologyUrl} placeholder="https://app.schoology.com/calendar/feed/ical/…/schoology.ics" aria-label={t('sgys.feedUrl')} />
    <input class="input" bind:value={schoologyProxy} placeholder={t('sgys.proxyPh')} aria-label={t('sgys.proxy')} />
    <button class="btn primary" type="submit">{t('common.save')}</button>
  </form>
  {#if hasSecret('schoologyFeedUrl')}
    <div class="row">
      <span>{t('gist.status')}</span><span class="status {schoology.status}"
        >{schoology.status === 'error' ? t('sync.error', { error: schoology.lastError ?? '' }) : t(`sgys.status.${schoology.status}`)}{#if s.lastSchoologySync}<span class="muted">
            · {t('gist.last', { when: formatDateTime(new Date(s.lastSchoologySync)) })}</span
          >{/if}</span
      >
    </div>
    <div class="row">
      <label for="sauto">{t('sgys.auto')}</label>
      <input
        id="sauto"
        type="checkbox"
        class="switch"
        checked={s.schoologyAutoCreateCourses}
        onchange={(e) => set('schoologyAutoCreateCourses', (e.target as HTMLInputElement).checked)}
      />
    </div>
    <div class="btns">
      <button class="btn" onclick={() => void syncSchoology()}>{t('sync.now')}</button>
      <button
        class="btn danger"
        onclick={() => {
          forgetSecret('schoologyFeedUrl');
          schoologyUrl = '';
        }}>{t('sync.disconnect')}</button
      >
      {#if s.schoologyIgnored.length}<button class="btn ghost sm" onclick={() => set('schoologyIgnored', [])}>{t('sgys.forget', { count: s.schoologyIgnored.length })}</button>{/if}
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
