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
  import type { ExportBundle, Task } from '../../lib/types';
  import { hasSecret, useSecret } from '../../lib/secrets.svelte';
  import { openEnvelope, sealWith } from '../../lib/syncCrypto';
  import { isEncryptedEnvelope, WrongPassphraseError, type EncryptedEnvelope } from '../../lib/crypto';
  import { folderBackupSupported, chooseFolder, forgetFolder, folderName, requestPersistence, isPersisted, writeBackup } from '../../lib/localBackup.svelte';
  import { withoutSecrets } from '../../lib/secretSlots';
  import { deleteEverything, remoteCopies, type RemoteCopy, type RemoteId, type WipeResult } from '../../lib/wipe';
  import { set } from './settings';
  import { t } from '../../lib/i18n/index.svelte';
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
  let fileInput: HTMLInputElement | undefined = $state();
  let importMode = $state<'replace' | 'merge'>('merge');

  let csvInput: HTMLInputElement | undefined = $state();
  let csvPreview = $state<(ReturnType<typeof importCSV> & { from?: string }) | null>(null);
  async function pickCSV(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    (e.target as HTMLInputElement).value = '';
    if (!f) return;
    const text = await f.text();
    // a Google Takeout Tasks.json, or CSV (this app, Todoist, spreadsheets)
    if (/\.json$/i.test(f.name) || text.trimStart().startsWith('{')) {
      const { importGoogleTasks } = await import('../../lib/googletasks');
      const g = importGoogleTasks(text);
      if (!g) {
        toasts.push({ message: 'That JSON isn’t a Google Tasks export', detail: 'For a Homework To-Do backup, use Import backup instead.', kind: 'warn' });
        return;
      }
      csvPreview = { tasks: g.tasks, columns: {}, skipped: g.skipped, from: `Google Tasks${g.lists.length ? `: ${g.lists.join(', ')}` : ''}` };
      return;
    }
    csvPreview = importCSV(text);
  }
  function confirmCSV() {
    if (!csvPreview) return;
    const made = store.importTasks(csvPreview.tasks);
    toasts.push({ message: `Imported ${made.length} tasks`, kind: 'success', emoji: '📥' });
    csvPreview = null;
  }
  // with a sync passphrase set, backups can be end-to-end encrypted too (same format as the synced copy)
  let encryptExport = $state(true); // only offered (and applied) while a sync passphrase is set
  async function exportNow() {
    try {
      let data: unknown = store.snapshotBundle();
      if (encryptExport && hasSecret('syncPassphrase')) {
        const pass = await useSecret('syncPassphrase');
        if (!pass) return;
        data = await sealWith(data, pass);
      }
      downloadJSON(backupFilename(), data);
      set('lastExportAt', new Date().toISOString());
      toasts.push({ message: encryptExport && hasSecret('syncPassphrase') ? 'Encrypted backup downloaded' : 'Backup downloaded', kind: 'success', emoji: '💾' });
    } catch (err) {
      toasts.push({ message: 'Backup failed', detail: err instanceof Error ? err.message : String(err), kind: 'warn' });
    }
  }

  // an encrypted file waiting for its passphrase (when the sync passphrase isn't set or doesn't fit)
  let encryptedFile = $state<EncryptedEnvelope | null>(null);
  let filePass = $state('');
  let filePassError = $state('');

  async function importFile(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const raw: unknown = JSON.parse(await file.text());
      if (isEncryptedEnvelope(raw)) {
        const pass = hasSecret('syncPassphrase') ? await useSecret('syncPassphrase') : '';
        try {
          if (!pass) throw new WrongPassphraseError();
          await applyImport(parseBundle(await openEnvelope(raw, [pass])));
        } catch (err) {
          if (!(err instanceof WrongPassphraseError)) throw err;
          encryptedFile = raw;
          filePass = '';
          filePassError = '';
        }
        return;
      }
      await applyImport(parseBundle(raw));
    } catch (err) {
      toasts.push({ message: 'Import failed', detail: err instanceof Error ? err.message : String(err), kind: 'warn' });
    } finally {
      if (fileInput) fileInput.value = '';
    }
  }

  async function openEncryptedFile(e: Event) {
    e.preventDefault();
    if (!encryptedFile || !filePass) return;
    try {
      const bundle = parseBundle(await openEnvelope(encryptedFile, [filePass]));
      encryptedFile = null;
      await applyImport(bundle);
    } catch (err) {
      filePassError = err instanceof WrongPassphraseError ? 'That passphrase does not open this file.' : err instanceof Error ? err.message : String(err);
    }
  }

  async function applyImport(bundle: ExportBundle) {
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
    // settings from a file never replace this device's keys or sync connection
    if (bundle.settings) store.updateSettings({ ...withoutSecrets(bundle.settings), gistId: store.settings.gistId });
  }

  // "Delete everything": a confirmation that lists what goes, including the synced copies elsewhere
  let wipeOpen = $state(false);
  let wipeBusy = $state(false);
  let remotes = $state<RemoteCopy[]>([]);
  let wipeRemote = $state<RemoteId[]>([]);
  let wipeResults = $state<WipeResult[] | null>(null);
  function openWipe() {
    remotes = remoteCopies();
    wipeRemote = remotes.map((r) => r.id);
    wipeResults = null;
    wipeOpen = true;
  }
  function toggleRemote(id: RemoteId, on: boolean) {
    wipeRemote = on ? [...wipeRemote, id] : wipeRemote.filter((x) => x !== id);
  }
  const localSummary = $derived(
    [
      `${store.tasks.length} task${store.tasks.length === 1 ? '' : 's'}`,
      `${store.courses.length} course${store.courses.length === 1 ? '' : 's'}`,
      `${store.cards.length} notecard${store.cards.length === 1 ? '' : 's'}`,
      'stats, coins and attachments',
      'settings and saved keys',
    ].join(', '),
  );
  async function wipeNow() {
    wipeBusy = true;
    try {
      const results = await deleteEverything(wipeRemote);
      wipeResults = results;
      wipeOpen = false;
      const failed = results.filter((r) => !r.ok);
      toasts.push({
        message: failed.length ? `Deleted, but ${failed.length} item${failed.length > 1 ? 's' : ''} failed` : 'Everything deleted',
        detail: results.map((r) => `${r.label}: ${r.message}`).join(' · '),
        kind: 'warn',
        timeout: 10000,
      });
    } finally {
      wipeBusy = false;
    }
  }

  async function archiveNow() {
    await store.archiveOldCompleted();
    toasts.push({ message: 'Old completed tasks archived', detail: 'They still count for stats and the heatmap.', kind: 'success' });
  }

  const archivedCount = $derived(store.tasks.filter((t) => t.archived).length);
</script>

<section class="card">
  <h2>{t('settings.data')}</h2>
  <div class="btns">
    <button class="btn primary" onclick={exportNow}>Download backup</button>
    <button class="btn" onclick={() => fileInput?.click()}>Import JSON…</button>
    <select class="select" bind:value={importMode} aria-label="Import mode">
      <option value="merge">Import: merge (newest wins)</option>
      <option value="replace">Import: replace everything</option>
    </select>
    <input type="file" accept="application/json,.json" bind:this={fileInput} onchange={importFile} class="visually-hidden" aria-label="Import file" />
  </div>
  {#if hasSecret('syncPassphrase')}
    <label class="check"><input type="checkbox" bind:checked={encryptExport} /> <span>Encrypt backups with my sync passphrase</span></label>
  {/if}
  {#if encryptedFile}
    <form class="btns" onsubmit={openEncryptedFile}>
      <span class="muted">This backup is encrypted. Enter the passphrase it was made with:</span>
      <input class="input" type="password" bind:value={filePass} aria-label="Backup passphrase" autocomplete="off" />
      <button class="btn primary" type="submit" disabled={!filePass}>Open and import</button>
      <button class="btn ghost" type="button" onclick={() => (encryptedFile = null)}>Cancel</button>
      {#if filePassError}<span class="err" role="alert">{filePassError}</span>{/if}
    </form>
  {/if}
  <div class="btns">
    <button class="btn" onclick={() => downloadText(`homework-todo-${store.today}.csv`, tasksToCSV($state.snapshot(store.tasks) as Task[], store.courses), 'text/csv')}
      >Export CSV</button
    >
    <button class="btn" onclick={() => downloadText(`homework-todo-${store.today}.md`, tasksToMarkdown($state.snapshot(store.tasks) as Task[], store.courses), 'text/markdown')}
      >Export Markdown</button
    >
    <button class="btn" onclick={() => csvInput?.click()}>Import CSV or Google Tasks…</button>
    <input
      type="file"
      accept=".csv,text/csv,.tsv,text/tab-separated-values,.txt,.json,application/json"
      bind:this={csvInput}
      onchange={pickCSV}
      class="visually-hidden"
      aria-label="Import CSV file"
    />
  </div>
  {#if csvPreview}
    <div class="csvprev card">
      <strong>{csvPreview.tasks.length} tasks found</strong>
      <span class="muted">
        {csvPreview.from
          ? csvPreview.from
          : Object.keys(csvPreview.columns).length
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
  <div class="danger-zone">
    {#if wipeOpen}
      <div class="wipe" role="group" aria-labelledby="wipe-h">
        <strong id="wipe-h">Delete everything?</strong>
        <p class="help">This can't be undone. It permanently removes:</p>
        <ul class="wipe-list">
          <li><strong>This device:</strong> {localSummary}.</li>
          {#each remotes as r (r.id)}
            <li>
              <label class="check">
                <input type="checkbox" checked={wipeRemote.includes(r.id)} onchange={(e) => toggleRemote(r.id, (e.target as HTMLInputElement).checked)} />
                <span><strong>{r.label}:</strong> {r.detail}</span>
              </label>
            </li>
          {/each}
        </ul>
        {#if remotes.some((r) => !wipeRemote.includes(r.id))}
          <p class="help warn">Synced copies you keep stay online, and signing in again later would bring that data back.</p>
        {/if}
        <p class="help">Download a backup first if you might want any of it later.</p>
        <div class="btns">
          <button class="btn danger" onclick={() => void wipeNow()} disabled={wipeBusy}>{wipeBusy ? 'Deleting…' : 'Delete everything'}</button>
          <button class="btn ghost" onclick={() => (wipeOpen = false)} disabled={wipeBusy}>Cancel</button>
        </div>
      </div>
    {:else}
      <div class="btns"><button class="btn danger" onclick={openWipe}>Delete everything…</button></div>
    {/if}
    {#if wipeResults}
      <ul class="wipe-list results" aria-label="Deletion results">
        {#each wipeResults as r (r.id)}<li class:bad={!r.ok}>{r.ok ? '✓' : '✗'} {r.label}: {r.message}</li>{/each}
      </ul>
    {/if}
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
    margin-top: 8px;
  }
  .wipe {
    border: 1px solid var(--danger);
    border-radius: var(--radius-sm);
    padding: 10px 12px;
  }
  .wipe-list {
    margin: 6px 0;
    padding-left: 18px;
    font-size: 14px;
  }
  .wipe-list li {
    margin: 4px 0;
  }
  .wipe-list.results {
    list-style: none;
    padding-left: 0;
  }
  .wipe-list .bad {
    color: var(--danger-text);
  }
  .check {
    display: flex;
    gap: 8px;
    align-items: flex-start;
  }
  .check input {
    margin-top: 3px;
  }
  .help.warn {
    color: var(--warn-text);
  }
  .err {
    color: var(--danger-text);
    font-size: 13px;
  }
  .sub {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    margin: 14px 0 4px;
  }
</style>
