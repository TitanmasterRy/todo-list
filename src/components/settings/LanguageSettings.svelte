<script lang="ts">
  // Settings → Language: app language (Auto follows the browser), and a right-to-left override for testing layouts.
  import { store } from '../../lib/store.svelte';
  import { i18n, LOCALES, resolveLocale, t } from '../../lib/i18n/index.svelte';
  import { formatDue } from '../../lib/dates';
  import { set } from './settings';
  const s = $derived(store.settings);
  const browser = $derived(LOCALES.find((l) => l.id === resolveLocale('auto').locale)?.name ?? 'English');
  const sample = $derived(formatDue(new Date(store.now.getTime() + 86400000 * 9).toISOString(), store.now, s.timeFormat));
</script>

<section class="card">
  <h2>{t('settings.language')}</h2>
  <div class="row">
    <label for="lang">{t('settings.language')}</label>
    <select id="lang" class="select" value={s.locale ?? 'auto'} onchange={(e) => set('locale', (e.target as HTMLSelectElement).value as 'auto' | 'en' | 'es')}>
      <option value="auto">{t('settings.languageAutoWith', { name: browser })}</option>
      {#each LOCALES as l (l.id)}<option value={l.id} lang={l.id}>{l.name}</option>{/each}
    </select>
  </div>
  <div class="row">
    <label for="rtl">{t('settings.rtl')}</label>
    <input id="rtl" type="checkbox" class="switch" checked={!!s.forceRtl} onchange={(e) => set('forceRtl', (e.target as HTMLInputElement).checked)} />
  </div>
  <p class="help">{t('settings.languageHelp', { region: i18n.intl, sample })}</p>
</section>

<style>
  section {
    margin-bottom: 12px;
  }
  h2 {
    font-size: 15px;
    margin: 0 0 10px;
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
  .select {
    width: auto;
    min-width: 90px;
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
  .help {
    font-size: 13px;
    color: var(--text-muted);
    margin: 8px 0 0;
  }
</style>
