<script lang="ts">
  // Calendar export: download due dates as an .ics file.
  import { store } from '../../lib/store.svelte';
  import { toasts } from '../../lib/toast.svelte';
  import { addDaysKey, dueKey } from '../../lib/dates';
  import { buildICS } from '../../lib/ics';
  import { downloadText } from '../../lib/download';
  import { t } from '../../lib/i18n/index.svelte';

  let includeDone = $state(false);
  let horizon = $state<'all' | '30' | '90'>('all');
  const calTasks = $derived(
    store.tasks.filter((t) => {
      if (!t.dueAt || t.archived) return false;
      if (!includeDone && t.completedAt) return false;
      if (horizon !== 'all' && dueKey(t.dueAt) > addDaysKey(store.today, Number(horizon))) return false;
      return true;
    }),
  );
  function exportICS() {
    downloadText('homework-todo.ics', buildICS(calTasks, store.courses), 'text/calendar');
    toasts.push({
      message: t('ics.exported', { count: calTasks.length }),
      detail: t('cmd.icsDetail'),
      kind: 'success',
      emoji: '📆',
    });
  }
</script>

<section class="card">
  <h2>{t('tools.calendar')}</h2>
  <p class="help">
    {t('ics.help')}
  </p>
  <div class="grid2">
    <label
      >{t('ics.range')}
      <select class="select" bind:value={horizon}>
        <option value="30">{t('inbox.nextDays', { n: 30 })}</option>
        <option value="90">{t('inbox.nextDays', { n: 90 })}</option>
        <option value="all">{t('ics.everything')}</option>
      </select>
    </label>
    <label class="check"><input type="checkbox" bind:checked={includeDone} /> {t('ics.includeDone')}</label>
  </div>
  <p class="muted">{t('ics.willExport', { count: calTasks.length })}</p>
  <button class="btn primary" onclick={exportICS} disabled={!calTasks.length}>{t('ics.download')}</button>
  <details class="how">
    <summary>{t('ics.how')}</summary>
    <ul>
      <li><strong>Google Calendar:</strong> {t('ics.howGoogle')}</li>
      <li><strong>Apple Calendar:</strong> {t('ics.howApple')}</li>
      <li><strong>Outlook:</strong> {t('ics.howOutlook')}</li>
    </ul>
  </details>
</section>

<style>
  section {
    margin-bottom: 12px;
  }
  h2 {
    font-size: 16px;
    margin: 0 0 8px;
  }
  .help {
    font-size: 13px;
    color: var(--text-muted);
    margin: 4px 0 10px;
  }
  .muted {
    color: var(--text-muted);
    font-size: 13px;
  }
  .grid2 {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 10px;
    margin-bottom: 10px;
  }
  .grid2 label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted);
  }
  .grid2 label.check {
    flex-direction: row;
    align-items: center;
    align-self: end;
    padding-bottom: 8px;
  }
  .how {
    margin-top: 12px;
    font-size: 13px;
    color: var(--text-muted);
  }
  .how ul {
    padding-left: 18px;
  }
</style>
