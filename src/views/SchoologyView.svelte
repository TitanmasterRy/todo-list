<script lang="ts">
  import { store, byDueThenOrder } from '../lib/store.svelte';
  import { toasts } from '../lib/toast.svelte';
  import type { Task } from '../lib/types';
  import { addDaysKey, dueKey, formatClock, isOverdue, isDueToday } from '../lib/dates';
  import { t } from '../lib/i18n/index.svelte';
  import { schoology, syncNow, syncFromText, testApiCredentials, schoologyConfigured } from '../lib/schoologySync.svelte';
  import { isSchoologyFeedUrl } from '../lib/schoology';
  import { forgetSecret, secret } from '../lib/secrets.svelte';
  let mode = $state<'api' | 'ics'>(store.settings.schoologyMode);
  let apiKey = $state(secret('schoologyKey'));
  let apiSecret = $state(secret('schoologySecret'));
  let domain = $state(store.settings.schoologyDomain);
  let interval = $state(store.settings.schoologyIntervalMin);
  let signingIn = $state(false);
  let signedInAs = $state('');
  async function signIn() {
    if (!apiKey.trim() || !apiSecret.trim()) return;
    if (!proxy.trim()) {
      toasts.push({ message: t('sgy.needProxy'), detail: t('sgy.needProxyDetail'), kind: 'warn', timeout: 9000 });
      return;
    }
    signingIn = true;
    try {
      signedInAs = await testApiCredentials(apiKey.trim(), apiSecret.trim(), proxy.trim());
      store.updateSettings({
        schoologyMode: 'api',
        schoologyKey: apiKey.trim(),
        schoologySecret: apiSecret.trim(),
        schoologyProxy: proxy.trim(),
        schoologyDomain: domain.trim(),
        schoologyIntervalMin: interval,
      });
      toasts.push({ message: t('google.signedInAs', { email: signedInAs }), detail: t('sgy.signedInDetail'), kind: 'success', emoji: '🔄' });
      showSetup = false;
      void syncNow();
    } catch (e) {
      toasts.push({ message: t('sgy.signInFailed'), detail: e instanceof Error ? e.message : String(e), kind: 'warn', timeout: 10000 });
    } finally {
      signingIn = false;
    }
  }
  import TaskItem from '../components/TaskItem.svelte';

  let url = $state(secret('schoologyFeedUrl'));
  let proxy = $state(store.settings.schoologyProxy);
  let pasted = $state('');
  let showSetup = $state(!schoologyConfigured());
  let showDone = $state(false);
  let fileInput: HTMLInputElement | undefined = $state();
  let busy = $state(false);

  const live = (t: Task) => !t.completedAt || store.lingering.has(t.id);
  const synced = $derived(store.tasks.filter((t) => t.source === 'schoology' && !t.archived));
  const open = $derived(synced.filter(live));
  const overdue = $derived(open.filter((t) => isOverdue(t.dueAt, store.now) && !isDueToday(t.dueAt, store.now)).sort(byDueThenOrder));
  const soonKey = $derived(addDaysKey(store.today, 7));
  const dueSoon = $derived(open.filter((t) => t.dueAt && !overdue.includes(t) && dueKey(t.dueAt) <= soonKey).sort(byDueThenOrder));
  const later = $derived(open.filter((t) => !overdue.includes(t) && !dueSoon.includes(t)).sort(byDueThenOrder));
  const done = $derived(synced.filter((t) => t.completedAt && !store.lingering.has(t.id)).sort((a, b) => (a.completedAt! < b.completedAt! ? 1 : -1)));
  const ids = $derived([...overdue, ...dueSoon, ...later].map((t) => t.id));

  function saveSetup() {
    const clean = url.trim().replace(/^webcal:\/\//i, 'https://');
    store.updateSettings({ schoologyMode: 'ics', schoologyFeedUrl: clean, schoologyProxy: proxy.trim(), schoologyIntervalMin: interval });
    url = clean;
    if (clean) {
      showSetup = false;
      void syncNow();
    }
  }
  async function importText(text: string) {
    busy = true;
    try {
      const r = await syncFromText(text);
      schoology.status = 'ok';
      toasts.push({
        message: t('sgy.imported', { count: r.created }),
        detail: t('sgy.importedDetail', { updated: r.updated, total: r.total }),
        kind: 'success',
        emoji: '🔄',
      });
      pasted = '';
      showSetup = false;
    } catch (e) {
      toasts.push({ message: t('sgy.readFailed'), detail: e instanceof Error ? e.message : String(e), kind: 'warn' });
    } finally {
      busy = false;
    }
  }
  async function onFile(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    await importText(await f.text());
    if (fileInput) fileInput.value = '';
  }
  function mapCourse(name: string, courseId: string) {
    if (!courseId) return;
    if (courseId === '__new') {
      const c = store.addCourse({ name, color: '#6c5ce7' });
      store.updateCourse(c.id, { schoologyName: name });
    } else {
      store.updateCourse(courseId, { schoologyName: name });
    }
    // Re-link tasks that carry this course name in their feed data by re-syncing next time; for now assign by matching unmatched tasks' notes is not possible, so prompt a resync.
    schoology.unmatched = schoology.unmatched.filter((n) => n !== name);
    toasts.push({ message: t('sgy.mapped', { name }), detail: t('sgy.mappedDetail'), kind: 'success' });
  }
  function disconnect() {
    forgetSecret('schoologyFeedUrl', 'schoologyKey', 'schoologySecret');
    store.updateSettings({ lastSchoologyError: undefined });
    url = '';
    apiKey = '';
    apiSecret = '';
    schoology.status = 'off';
    showSetup = true;
  }
</script>

<div class="page">
  <header class="page-head">
    <div>
      <h1>{t('nav.schoology')}</h1>
      <div class="sub">{t('sgy.sub')}</div>
    </div>
    <div class="grow"></div>
    {#if schoologyConfigured()}
      <span class="status {schoology.status}">
        {schoology.status === 'syncing'
          ? t('sync.syncing')
          : schoology.status === 'error'
            ? t('sgy.syncError')
            : schoology.status === 'ok'
              ? t('google.synced')
              : t('sync.connected')}
        {#if store.settings.lastSchoologySync}<span class="muted"> · {formatClock(new Date(store.settings.lastSchoologySync), { hour: 'numeric', minute: '2-digit' })}</span>{/if}
      </span>
      <button class="btn sm" onclick={() => void syncNow()} disabled={schoology.status === 'syncing'}>{t('sync.now')}</button>
      <button class="btn ghost sm" onclick={() => (showSetup = !showSetup)}>{t('tt.setup')}</button>
    {/if}
  </header>

  {#if schoology.status === 'error' && schoology.lastError}
    <div class="card err">⚠ {schoology.lastError}</div>
  {/if}

  {#if showSetup}
    <section class="card setup">
      <h2>{t('sgy.connect')}</h2>
      <div class="modes" role="tablist">
        <button role="tab" aria-selected={mode === 'api'} class:on={mode === 'api'} onclick={() => (mode = 'api')}
          >{t('sgy.apiMode')} <span class="rec">{t('sgy.apiModeSub')}</span></button
        >
        <button role="tab" aria-selected={mode === 'ics'} class:on={mode === 'ics'} onclick={() => (mode = 'ics')}
          >{t('sgy.icsMode')} <span class="rec">{t('sgy.icsModeSub')}</span></button
        >
      </div>
      <p class="help">
        {t('sgy.help')}
      </p>
      <label class="fld">{t('sync.proxyLabel')} <input class="input" bind:value={proxy} placeholder="https://your-worker.workers.dev/?url=" /></label>
      {#if mode === 'api'}
        <ol class="steps">
          <li>
            {t('sgy.api1a')} <a href="https://app.schoology.com/api" target="_blank" rel="noopener noreferrer">app.schoology.com/api</a>
            {t('sgy.api1b')}
          </li>
          <li>{t('sgy.api2', { n: interval })}</li>
        </ol>
        <form
          class="grid"
          onsubmit={(e) => {
            e.preventDefault();
            void signIn();
          }}
        >
          <label class="fld">{t('sgy.key')} <input class="input" bind:value={apiKey} autocomplete="off" /></label>
          <label class="fld">{t('sgy.secret')} <input class="input" type="password" bind:value={apiSecret} autocomplete="off" /></label>
          <label class="fld">{t('sgy.domain')} <input class="input" bind:value={domain} placeholder="https://myschool.schoology.com" /></label>
          <label class="fld">{t('sgy.every')} <input class="input num" type="number" min="5" max="240" bind:value={interval} /> {t('sgy.minutes')}</label>
          <label class="check"
            ><input
              type="checkbox"
              checked={store.settings.schoologyImportGrades}
              onchange={(e) => store.updateSettings({ schoologyImportGrades: (e.target as HTMLInputElement).checked })}
            />
            {t('sgy.grades')}</label
          >
          <label class="check"
            ><input
              type="checkbox"
              checked={store.settings.schoologyAutoCreateCourses}
              onchange={(e) => store.updateSettings({ schoologyAutoCreateCourses: (e.target as HTMLInputElement).checked })}
            />
            {t('sgy.autoCourses')}</label
          >
          <label class="check"
            ><input type="checkbox" checked={store.settings.autoDescribe} onchange={(e) => store.updateSettings({ autoDescribe: (e.target as HTMLInputElement).checked })} />
            {t('sgy.autoDescribe')}</label
          >
          <div class="btns">
            <button class="btn primary" type="submit" disabled={signingIn || !apiKey.trim() || !apiSecret.trim()}>{signingIn ? t('sgy.signingIn') : t('sgy.signInSync')}</button>
            {#if schoologyConfigured()}<button type="button" class="btn danger" onclick={disconnect}>{t('sync.disconnect')}</button>{/if}
          </div>
        </form>
      {:else}
        <ol class="steps">
          <li>
            {t('sgy.ics1')} (<code>https://app.schoology.com/calendar/feed/ical/…/schoology.ics</code>).
          </li>
          <li>{t('sgy.ics2')}</li>
        </ol>
        <form
          class="grid"
          onsubmit={(e) => {
            e.preventDefault();
            saveSetup();
          }}
        >
          <label class="fld">{t('sgy.feedUrl')} <input class="input" bind:value={url} placeholder="https://app.schoology.com/calendar/feed/ical/…/schoology.ics" /></label>
          {#if url && !isSchoologyFeedUrl(url)}<span class="warn">{t('sgy.notFeed')}</span>{/if}
          <label class="fld">{t('sgy.every')} <input class="input num" type="number" min="5" max="240" bind:value={interval} /> {t('sgy.minutes')}</label>
          <label class="check"
            ><input
              type="checkbox"
              checked={store.settings.schoologyAutoCreateCourses}
              onchange={(e) => store.updateSettings({ schoologyAutoCreateCourses: (e.target as HTMLInputElement).checked })}
            />
            {t('sgy.autoCourses')}</label
          >
          <label class="check"
            ><input type="checkbox" checked={store.settings.autoDescribe} onchange={(e) => store.updateSettings({ autoDescribe: (e.target as HTMLInputElement).checked })} />
            {t('sgy.autoDescribeFull')}</label
          >
          <div class="btns">
            <button class="btn primary" type="submit" disabled={!url.trim()}>{t('sync.saveSync')}</button>
            {#if schoologyConfigured()}<button type="button" class="btn danger" onclick={disconnect}>{t('sync.disconnect')}</button>{/if}
          </div>
        </form>
        <div class="manual">
          <h3>{t('sgy.manual')}</h3>
          <div class="btns">
            <button class="btn" onclick={() => fileInput?.click()} disabled={busy}>{t('sgy.upload')}</button>
            <input type="file" accept=".ics,text/calendar" class="visually-hidden" bind:this={fileInput} onchange={onFile} aria-label={t('sgy.uploadLabel')} />
          </div>
          <textarea class="textarea" bind:value={pasted} placeholder={t('sgy.pastePh')}></textarea>
          <button class="btn sm" onclick={() => void importText(pasted)} disabled={!pasted.trim() || busy}>{t('sgy.importPasted')}</button>
        </div>
      {/if}
    </section>
  {/if}

  {#if schoology.unmatched.length}
    <section class="card">
      <h2>{t('sgy.match')}</h2>
      <p class="muted">{t('sgy.matchHelp')}</p>
      {#each schoology.unmatched as name (name)}
        <div class="map-row">
          <span class="grow">{name}</span>
          <select class="select" onchange={(e) => mapCourse(name, (e.target as HTMLSelectElement).value)} aria-label={t('sgy.courseFor', { name })}>
            <option value="">{t('focus.choose')}</option>
            <option value="__new">{t('ps.create', { name })}</option>
            {#each store.activeCourses as c (c.id)}<option value={c.id}>{c.emoji ?? ''} {c.name}</option>{/each}
          </select>
        </div>
      {/each}
    </section>
  {/if}

  {#if !synced.length && !showSetup}
    <div class="empty">
      <div class="big">🔄</div>
      <h3>{t('sgy.none')}</h3>
      <p>{t('sgy.noneHint')}</p>
    </div>
  {/if}

  {#if overdue.length}
    <div class="section-title overdue">
      <span>{t('today.overdue')}</span><span class="count">{overdue.length}</span><span class="spacer"></span><button class="btn sm" onclick={() => store.rollOverdueToToday()}
        >{t('today.rollAll')}</button
      >
    </div>
    <div class="task-list">
      {#each overdue as task (task.id)}<TaskItem {task} listIds={ids} />{/each}
    </div>
  {/if}
  {#if dueSoon.length}
    <div class="section-title"><span>{t('sgy.next7')}</span><span class="count">{dueSoon.length}</span></div>
    <div class="task-list">
      {#each dueSoon as task (task.id)}<TaskItem {task} listIds={ids} />{/each}
    </div>
  {/if}
  {#if later.length}
    <div class="section-title"><span>{t('sgy.later')}</span><span class="count">{later.length}</span></div>
    <div class="task-list">
      {#each later as task (task.id)}<TaskItem {task} listIds={ids} />{/each}
    </div>
  {/if}
  {#if done.length}
    <button class="section-title toggle" onclick={() => (showDone = !showDone)} aria-expanded={showDone}>
      <span>{t('inbox.completed')}</span><span class="count">{done.length}</span><span class="spacer"></span><span class="hint"
        >{showDone ? t('common.hide') : t('common.show')}</span
      >
    </button>
    {#if showDone}
      <div class="task-list">
        {#each done.slice(0, 60) as task (task.id)}<TaskItem {task} compact />{/each}
      </div>
    {/if}
  {/if}
  {#if synced.length && !showSetup}
    <p class="muted foot">
      {t('sgy.foot')}
      <button class="link" onclick={() => store.go('settings')}>{t('nav.settings')}</button>.
    </p>
  {/if}
</div>

<style>
  .status {
    font-size: 13px;
    font-weight: 600;
    padding: 3px 10px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: var(--bg-elev-2);
    box-shadow: inset 0 1px 0 var(--sheen);
  }
  .status.syncing {
    border-color: color-mix(in srgb, var(--accent) 40%, transparent);
    animation: glow-pulse 1.6s ease-out infinite;
  }
  .status.ok {
    color: var(--success-text);
    border-color: color-mix(in srgb, var(--success) 40%, transparent);
    background: color-mix(in srgb, var(--success) 10%, transparent);
    box-shadow: 0 0 12px -4px color-mix(in srgb, var(--success) 60%, transparent);
  }
  .status.error {
    color: var(--danger-text);
    border-color: color-mix(in srgb, var(--danger) 40%, transparent);
    background: color-mix(in srgb, var(--danger) 10%, transparent);
  }
  .muted {
    color: var(--text-muted);
    font-size: 13px;
    font-weight: 400;
  }
  .err {
    color: var(--danger-text);
    margin-bottom: 12px;
    border-color: color-mix(in srgb, var(--danger) 40%, var(--border));
    background: color-mix(in srgb, var(--danger) 6%, var(--bg-elev));
    animation: shake 400ms var(--ease);
  }
  .setup h2,
  section h2 {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
    font-weight: 800;
    letter-spacing: -0.01em;
    margin: 0 0 8px;
  }
  section h2::before {
    content: '';
    width: 4px;
    height: 15px;
    border-radius: 2px;
    background: var(--grad-accent);
    box-shadow: 0 0 8px color-mix(in srgb, var(--accent) 50%, transparent);
    flex-shrink: 0;
  }
  .steps li::marker {
    color: var(--accent-text);
    font-weight: 700;
  }
  .steps {
    font-size: 14px;
    color: var(--text-muted);
    padding-left: 20px;
    margin: 0 0 12px;
  }
  .steps li {
    margin-bottom: 6px;
  }
  .steps code,
  .setup code {
    font-family: var(--mono);
    font-size: 12px;
    word-break: break-all;
  }
  .grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .modes {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
    margin-bottom: 10px;
  }
  .modes button {
    padding: 8px 12px;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: var(--bg-elev-2);
    box-shadow: inset 0 1px 0 var(--sheen);
    font-weight: 600;
    font-size: 13px;
    color: var(--text-muted);
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    transition:
      transform var(--dur) var(--spring),
      border-color var(--dur),
      background var(--dur),
      box-shadow var(--dur);
  }
  .modes button:hover {
    transform: translateY(-2px);
    color: var(--text);
    border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
  }
  .modes button.on {
    border-color: color-mix(in srgb, var(--accent) 70%, var(--border));
    color: var(--text);
    background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 16%, var(--bg-elev-2)), color-mix(in srgb, var(--accent-2) 8%, var(--bg-elev-2)));
    box-shadow:
      inset 0 1px 0 var(--sheen),
      0 0 0 1px color-mix(in srgb, var(--accent) 25%, transparent),
      0 0 18px -6px color-mix(in srgb, var(--accent) 70%, transparent);
  }
  .modes .rec {
    font-size: 11px;
    font-weight: 400;
    color: var(--text-faint);
  }
  .fld {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted);
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 8px;
  }
  .input.num {
    width: 80px;
    display: inline-block;
  }
  .grid label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .grid label.check {
    flex-direction: row;
    align-items: center;
    font-weight: 400;
    font-size: 14px;
    color: var(--text);
  }
  .warn {
    color: var(--warn-text);
    font-size: 12px;
  }
  .btns {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin: 6px 0;
  }
  .manual {
    border-top: 1px solid var(--border);
    margin-top: 12px;
    padding-top: 12px;
  }
  .manual h3 {
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    margin: 0 0 6px;
  }
  .manual .textarea {
    margin: 8px 0;
    min-height: 70px;
    font-family: var(--mono);
    font-size: 12px;
  }
  .map-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 0;
    border-top: 1px solid var(--border);
    font-size: 14px;
    animation: rise-in 300ms var(--ease) backwards;
  }
  .map-row .select {
    width: auto;
  }
  .grow {
    flex: 1;
  }
  section.card {
    margin-bottom: 12px;
    animation: rise-in var(--dur-slow) var(--ease) backwards;
  }
  .section-title .count {
    font-variant-numeric: tabular-nums;
  }
  .toggle {
    transition: color var(--dur);
  }
  .toggle:hover {
    color: var(--text);
  }
  .section-title.overdue span:first-child {
    color: var(--overdue);
  }
  .toggle {
    width: 100%;
    text-align: left;
  }
  .hint {
    font-weight: 400;
    text-transform: none;
    letter-spacing: 0;
    color: var(--text-faint);
  }
  .foot {
    margin-top: 16px;
  }
  .link {
    color: var(--accent-text);
  }
</style>
