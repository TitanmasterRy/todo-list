<script lang="ts">
  // Settings → Data: backup, import/export, persistence, folder backups, archiving and reset.
  import { store } from '../../lib/store.svelte';
  import { toasts } from '../../lib/toast.svelte';
  import { undo } from '../../lib/undo.svelte';
  import { backupFilename, downloadJSON, parseBundle } from '../../lib/backup';
  import { pwa, promptInstall } from '../../lib/pwa.svelte';
  import { downloadText } from '../../lib/download';
  import { tasksToCSV, tasksToMarkdown } from '../../lib/exporters';
  import { importCSV } from '../../lib/csvimport';
  import type { Task } from '../../lib/types';
  import { folderBackupSupported, chooseFolder, forgetFolder, folderName, requestPersistence, isPersisted, writeBackup } from '../../lib/localBackup.svelte';
  import { set } from './settings';
  const s = $derived(store.settings);
  let persisted = $state<boolean | null>(null);
  void isPersisted().then((v) => (persisted = v));
  let backupFolder = $state(folderName());
  async function pickFolder() {
    try {
      backupFolder = await chooseFolder();
      toasts.push({
        message: `Backups will be written to “${backupFolder}”`,
        detail: 'A JSON copy is saved a few seconds after every change, plus one dated file per day.',
        kind: 'success',
        emoji: '💾',
      });
    } catch (e) {
      if ((e as Error).name !== 'AbortError') toasts.push({ message: 'Could not use that folder', detail: String(e), kind: 'warn' });
    }
  }
  async function persistNow() {
    persisted = await requestPersistence();
    toasts.push({
      message: persisted ? 'Storage marked persistent' : 'Browser declined persistence',
      detail: persisted
        ? 'The browser will not evict this app’s data under storage pressure.'
        : 'Install the app or use it more; browsers grant this to sites you use often. Folder backups still protect you.',
      kind: persisted ? 'success' : 'info',
    });
  }
  let resetStep = $state(0);
  let fileInput: HTMLInputElement | undefined = $state();
  let importMode = $state<'replace' | 'merge'>('merge');

  let csvInput: HTMLInputElement | undefined = $state();
  let csvPreview = $state<ReturnType<typeof importCSV> | null>(null);
  async function pickCSV(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    (e.target as HTMLInputElement).value = '';
    if (!f) return;
    csvPreview = importCSV(await f.text());
  }
  function confirmCSV() {
    if (!csvPreview) return;
    const made = store.importTasks(csvPreview.tasks);
    toasts.push({ message: `Imported ${made.length} tasks`, kind: 'success', emoji: '📥' });
    csvPreview = null;
  }
  function exportNow() {
    downloadJSON(backupFilename(), store.snapshotBundle());
    set('lastExportAt', new Date().toISOString());
    toasts.push({ message: 'Backup downloaded', kind: 'success', emoji: '💾' });
  }

  async function importFile(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const bundle = parseBundle(JSON.parse(text));
      if (importMode === 'replace') {
        const before = store.snapshotBundle();
        await store.loadBundle(bundle);
        undo.push({ label: `Imported ${bundle.tasks.length} tasks (replaced data)`, undo: () => void store.loadBundle(before) }, { kind: 'warn', timeout: 10000 });
      } else {
        const { mergeBundles } = await import('../../lib/backup');
        const local = store.snapshotBundle();
        const { merged } = mergeBundles(local, bundle);
        await store.loadBundle(merged);
        undo.push({ label: `Merged ${bundle.tasks.length} tasks from file`, undo: () => void store.loadBundle(local) }, { timeout: 10000 });
      }
      if (bundle.settings) store.updateSettings({ ...bundle.settings, gistToken: store.settings.gistToken, gistId: store.settings.gistId });
    } catch (err) {
      toasts.push({ message: 'Import failed', detail: err instanceof Error ? err.message : String(err), kind: 'warn' });
    } finally {
      if (fileInput) fileInput.value = '';
    }
  }

  async function resetAll() {
    if (resetStep < 2) {
      resetStep++;
      setTimeout(() => (resetStep = 0), 6000);
      return;
    }
    await store.resetAll();
    resetStep = 0;
    toasts.push({ message: 'All data erased', kind: 'warn' });
    store.go('today');
  }

  async function archiveNow() {
    await store.archiveOldCompleted();
    toasts.push({ message: 'Old completed tasks archived', detail: 'They still count for stats and the heatmap.', kind: 'success' });
  }

  const archivedCount = $derived(store.tasks.filter((t) => t.archived).length);
</script>

<section class="card">
  <h2>Data</h2>
  <div class="btns">
    <button class="btn primary" onclick={exportNow}>Download backup</button>
    <button class="btn" onclick={() => fileInput?.click()}>Import JSON…</button>
    <select class="select" bind:value={importMode} aria-label="Import mode">
      <option value="merge">Import: merge (newest wins)</option>
      <option value="replace">Import: replace everything</option>
    </select>
    <input type="file" accept="application/json,.json" bind:this={fileInput} onchange={importFile} class="visually-hidden" aria-label="Import file" />
  </div>
  <div class="btns">
    <button class="btn" onclick={() => downloadText(`homework-todo-${store.today}.csv`, tasksToCSV($state.snapshot(store.tasks) as Task[], store.courses), 'text/csv')}
      >Export CSV</button
    >
    <button class="btn" onclick={() => downloadText(`homework-todo-${store.today}.md`, tasksToMarkdown($state.snapshot(store.tasks) as Task[], store.courses), 'text/markdown')}
      >Export Markdown</button
    >
    <button class="btn" onclick={() => csvInput?.click()}>Import CSV…</button>
    <input type="file" accept=".csv,text/csv,.tsv,text/tab-separated-values,.txt" bind:this={csvInput} onchange={pickCSV} class="visually-hidden" aria-label="Import CSV file" />
  </div>
  {#if csvPreview}
    <div class="csvprev card">
      <strong>{csvPreview.tasks.length} tasks found</strong>
      <span class="muted">
        {Object.keys(csvPreview.columns).length
          ? `Columns: ${Object.entries(csvPreview.columns)
              .map(([k, v]) => `${v} → ${k}`)
              .join(', ')}`
          : 'No header row: one task per line'}{csvPreview.skipped ? ` · ${csvPreview.skipped} rows skipped` : ''}
      </span>
      <ul class="list">
        {#each csvPreview.tasks.slice(0, 5) as t, i (i)}<li>
            <span class="grow">{t.done ? '✓ ' : ''}{t.title}</span><span class="muted">{t.dueAt ?? ''} {t.course ?? ''}</span>
          </li>{/each}
      </ul>
      <div class="btns">
        <button class="btn primary" onclick={confirmCSV} disabled={!csvPreview.tasks.length}>Import {csvPreview.tasks.length}</button>
        <button class="btn ghost" onclick={() => (csvPreview = null)}>Cancel</button>
      </div>
    </div>
  {/if}
  <p class="help">
    CSV import reads this app's CSV export, Todoist's CSV export, or any spreadsheet with a title column (due, notes, priority, course, tags and status are picked up when present).
  </p>
  <p class="help">Last export: {s.lastExportAt ? new Date(s.lastExportAt).toLocaleString() : 'never'}. You’ll get a reminder after 14 days without one.</p>
  <h3 class="sub">Never lose data</h3>
  <div class="row">
    <span>Persistent storage {persisted === null ? '' : persisted ? '· granted' : '· not yet'}</span>
    <button class="btn sm" onclick={persistNow} disabled={persisted === true}>Ask the browser to keep my data</button>
  </div>
  {#if folderBackupSupported()}
    <div class="row">
      <span>Auto-backup to a folder{backupFolder ? ` · ${backupFolder}` : ''}{s.lastLocalBackupAt ? ` · last ${new Date(s.lastLocalBackupAt).toLocaleTimeString()}` : ''}</span>
      <span class="btns">
        <button class="btn sm" onclick={pickFolder}>{backupFolder ? 'Change folder' : 'Choose folder'}</button>
        {#if backupFolder}<button class="btn ghost sm" onclick={() => void writeBackup()}>Back up now</button><button
            class="btn ghost sm"
            onclick={() => {
              void forgetFolder();
              backupFolder = null;
            }}>Stop</button
          >{/if}
      </span>
    </div>
    <p class="help">
      Writes <code>homework-todo-backup.json</code> (and a dated copy each day) into a folder on this device a few seconds after every change. Works in Chrome and Edge; pick a folder
      that syncs to the cloud (Drive, iCloud, OneDrive) for off-device safety.
    </p>
  {:else}
    <p class="help">Folder auto-backup needs Chrome or Edge on desktop. On this browser, use Download backup, Gist sync, or Google Drive sync.</p>
  {/if}
  <div class="row">
    <span>Offline copy of the app</span>
    <a class="btn sm" href="./lite/index.html" download="homework-todo-offline.html">Download offline version</a>
  </div>
  <p class="help">
    A single HTML file you can keep on a USB stick or your desktop. It runs from a double-click with no internet: tasks, courses, notecards, calculator, timers and stats work;
    sync, AI and Schoology need the online app. Its data lives in that browser profile separately from the online app, so export/import to move between them.
  </p>
  <div class="row">
    <label for="arch">Archive completed older than (days, 0 = never)</label>
    <input
      id="arch"
      class="input num"
      type="number"
      min="0"
      max="3650"
      value={s.archiveAfterDays}
      onchange={(e) => set('archiveAfterDays', Math.max(0, Number((e.target as HTMLInputElement).value) || 0))}
    />
  </div>
  <div class="btns">
    <button class="btn" onclick={archiveNow} disabled={!s.archiveAfterDays}>Archive now</button>
    <span class="muted">{archivedCount} archived (kept for stats)</span>
  </div>
  {#if pwa.installEvent && !pwa.installed}
    <div class="btns"><button class="btn" onclick={() => void promptInstall()}>📱 Install app</button></div>
  {/if}
  <div class="btns danger-zone">
    <button class="btn danger" onclick={resetAll}>
      {resetStep === 0 ? 'Reset all data…' : resetStep === 1 ? 'Really? Click again to confirm' : 'Last chance: erase everything'}
    </button>
    {#if resetStep > 0}<button class="btn ghost sm" onclick={() => (resetStep = 0)}>Cancel</button>{/if}
  </div>
</section>

<style>
  section {
    margin-bottom: 12px;
  }
  .csvprev {
    display: grid;
    gap: 6px;
    margin: 8px 0;
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
  .select {
    width: auto;
    min-width: 90px;
  }
  .input.num {
    width: auto;
    min-width: 90px;
  }
  .input.num {
    width: 90px;
  }
  .help {
    font-size: 13px;
    color: var(--text-muted);
    margin: 6px 0;
  }
  .help code {
    font-family: var(--mono);
    font-size: 12px;
  }
  .muted {
    color: var(--text-muted);
    font-weight: 400;
    font-size: 13px;
  }
  .grow {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .list li {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 0;
    border-top: 1px solid var(--border);
    font-size: 14px;
  }
  .btns {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
    margin: 8px 0;
  }
  .danger-zone {
    border-top: 1px solid var(--border);
    padding-top: 10px;
  }
  .sub {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    margin: 14px 0 4px;
  }
</style>
