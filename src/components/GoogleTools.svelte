<script lang="ts">
  import { onMount } from 'svelte';
  import { store } from '../lib/store.svelte';
  import { toasts } from '../lib/toast.svelte';
  import { formatDateTime, formatDue } from '../lib/dates';
  import { t } from '../lib/i18n/index.svelte';
  import { COURSE_COLORS, COURSE_EMOJIS } from '../lib/colors';
  import { matchCourseName } from '../lib/schoology';
  import { extractAssignmentsFromMail, type Suggestion } from '../lib/google-parse';
  import {
    google,
    signIn,
    signOut,
    scanGmail,
    importClassroom,
    pushTasksToCalendar,
    driveSync,
    startGoogleSync,
    neededScopes,
    upcomingDatedTasks,
    DEFAULT_GMAIL_QUERY,
    SCOPE_GMAIL,
    SCOPE_CLASSROOM,
    SCOPE_CAL,
    SCOPE_DRIVE,
  } from '../lib/google.svelte';

  const s = $derived(store.settings);
  const origin = typeof location !== 'undefined' ? location.origin : '';

  let authBusy = $state(false);
  let query = $state('');
  let scanBusy = $state(false);
  let scanError = $state('');
  let scanned = $state(false);
  let scannedCount = $state(0);
  let suggestions = $state<Suggestion[]>([]);
  let classroomBusy = $state(false);
  let classroomResult = $state<{ courses: number; added: number; done: number; skipped: number; total: number } | null>(null);
  let classroomError = $state('');
  let calBusy = $state(false);
  let syncBusy = $state(false);

  onMount(() => {
    startGoogleSync();
    query = s.gmailQuery?.trim() || DEFAULT_GMAIL_QUERY;
  });

  const signedIn = $derived(google.status === 'signedIn');
  const existingExternal = $derived(new Set(store.tasks.map((t) => t.externalId).filter(Boolean) as string[]));
  const ignored = $derived(new Set(s.gmailIgnored ?? []));
  const visible = $derived(suggestions.filter((x) => !existingExternal.has(`gmail:${x.messageId}`) && !ignored.has(x.messageId)));
  const highCount = $derived(visible.filter((x) => x.confidence === 'high').length);
  const upcoming = $derived(upcomingDatedTasks(30));

  function fail(message: string, err: unknown) {
    toasts.push({ message, detail: err instanceof Error ? err.message : String(err), kind: 'warn', timeout: 8000 });
  }

  async function doSignIn() {
    authBusy = true;
    try {
      await signIn(neededScopes());
      toasts.push({ message: google.email ? t('google.signedInAs', { email: google.email }) : t('google.signedIn'), kind: 'success', emoji: '✅' });
      if (s.googleSyncEnabled) void driveSync({ pull: true, interactive: true });
    } catch (e) {
      fail(t('google.signInFailed'), e);
    } finally {
      authBusy = false;
    }
  }

  function doSignOut() {
    signOut();
    suggestions = [];
    scanned = false;
    toasts.push({ message: t('google.signedOut'), kind: 'info' });
  }

  async function scan() {
    const q = query.trim() || DEFAULT_GMAIL_QUERY;
    if (q !== s.gmailQuery) store.updateSettings({ gmailQuery: q });
    scanBusy = true;
    scanError = '';
    try {
      const messages = await scanGmail(q, 40);
      scannedCount = messages.length;
      suggestions = extractAssignmentsFromMail(
        messages,
        store.activeCourses.map((c) => ({ id: c.id, name: c.name })),
        store.now,
      );
      scanned = true;
    } catch (e) {
      scanError = e instanceof Error ? e.message : String(e);
    } finally {
      scanBusy = false;
    }
  }

  function taskInput(x: Suggestion) {
    return {
      title: x.title.trim(),
      dueAt: x.dueAt,
      courseId: x.courseId || undefined,
      source: 'gmail' as const,
      externalId: `gmail:${x.messageId}`,
      url: x.url,
    };
  }

  function addOne(x: Suggestion) {
    if (!x.title.trim()) return;
    store.addTask(taskInput(x));
  }

  function addAllHigh() {
    const items = visible.filter((x) => x.confidence === 'high' && x.title.trim());
    if (!items.length) return;
    const created = store.addTasks(items.map(taskInput));
    toasts.push({ message: t('google.addedGmail', { count: created.length }), kind: 'success', emoji: '📧' });
  }

  function ignore(x: Suggestion) {
    if (ignored.has(x.messageId)) return;
    store.updateSettings({ gmailIgnored: [...(s.gmailIgnored ?? []), x.messageId] });
  }

  function forgetIgnored() {
    store.updateSettings({ gmailIgnored: [] });
  }

  function resolveCourse(name: string, created: Map<string, string>): string | undefined {
    const norm = name.trim().toLowerCase();
    if (!norm) return undefined;
    if (created.has(norm)) return created.get(norm);
    const alias = store.courses.find((c) => c.schoologyName && c.schoologyName.toLowerCase() === norm);
    if (alias) return alias.id;
    const matched = matchCourseName(
      name,
      store.activeCourses.map((c) => ({ id: c.id, name: c.name })),
    );
    if (matched) return matched;
    const i = store.courses.length + created.size;
    const c = store.addCourse({ name: name.trim().slice(0, 40), color: COURSE_COLORS[(i * 3) % COURSE_COLORS.length], emoji: COURSE_EMOJIS[i % COURSE_EMOJIS.length] });
    created.set(norm, c.id);
    return c.id;
  }

  async function runClassroomImport() {
    classroomBusy = true;
    classroomError = '';
    if (!s.googleClassroomEnabled) store.updateSettings({ googleClassroomEnabled: true });
    try {
      const { work } = await importClassroom();
      const created = new Map<string, string>();
      const ignoredExt = new Set(s.schoologyIgnored ?? []);
      const fresh = work.filter((w) => !existingExternal.has(w.externalId) && !ignoredExt.has(w.externalId));
      const inputs = fresh.map((w) => ({
        title: w.title,
        dueAt: w.dueAt,
        courseId: resolveCourse(w.courseName, created),
        notes: w.notes,
        type: w.type,
        priority: w.type === 'exam' ? ('high' as const) : ('normal' as const),
        source: 'classroom' as const,
        externalId: w.externalId,
        url: w.url,
      }));
      const tasks = store.addTasks(inputs);
      const byExt = new Map(tasks.map((t) => [t.externalId, t.id]));
      let done = 0;
      const doneAt = new Date().toISOString();
      for (const w of fresh) {
        if (!w.done) continue;
        const id = byExt.get(w.externalId);
        if (id) {
          store.updateTask(id, { completedAt: doneAt });
          done++;
        }
      }
      classroomResult = { courses: created.size, added: tasks.length, done, skipped: work.length - fresh.length, total: work.length };
      toasts.push({
        message: tasks.length ? t('google.imported', { n: tasks.length }) : t('google.upToDate'),
        detail: created.size ? t('google.newCourses', { count: created.size }) : undefined,
        kind: 'success',
        emoji: '🎓',
      });
    } catch (e) {
      classroomError = e instanceof Error ? e.message : String(e);
    } finally {
      classroomBusy = false;
    }
  }

  async function pushCalendar() {
    if (!upcoming.length) {
      toasts.push({ message: t('google.nothing30'), kind: 'info' });
      return;
    }
    calBusy = true;
    try {
      const r = await pushTasksToCalendar(upcoming);
      toasts.push({ message: t('google.calUpdated'), detail: t('google.calDetail', { created: r.created, updated: r.updated }), kind: 'success', emoji: '📅' });
    } catch (e) {
      fail(t('google.calFailed'), e);
    } finally {
      calBusy = false;
    }
  }

  async function toggleSync(on: boolean) {
    store.updateSettings({ googleSyncEnabled: on });
    if (on) await syncNow();
    else google.syncStatus = 'idle';
  }

  async function syncNow() {
    syncBusy = true;
    try {
      await driveSync({ pull: true, interactive: true });
      if (google.syncStatus === 'ok') toasts.push({ message: t('google.driveSynced'), kind: 'success', emoji: '☁️' });
    } finally {
      syncBusy = false;
    }
  }

  function scopeLabel(scope: string): string {
    if (scope === SCOPE_GMAIL) return 'Gmail';
    if (scope === SCOPE_CAL) return 'Calendar';
    if (scope === SCOPE_DRIVE) return 'Drive';
    if (SCOPE_CLASSROOM.split(' ').includes(scope)) return 'Classroom';
    return '';
  }
  const grantedLabels = $derived(Array.from(new Set(google.scopes.map(scopeLabel).filter(Boolean))));

  function fmtWhen(iso: string | undefined): string {
    if (!iso) return t('google.never');
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? t('google.never') : formatDateTime(d, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }
</script>

<div class="google">
  <section class="card">
    <div class="head">
      <h2>{t('google.account')}</h2>
      {#if signedIn}
        <span class="status ok">● {google.email ? t('google.signedInAs', { email: google.email }) : t('google.signedInShort')}</span>
      {:else if google.status === 'ready'}
        <span class="status">○ {t('google.notSignedIn')}</span>
      {:else}
        <span class="status">○ {t('google.needsSetup')}</span>
      {/if}
    </div>
    {#if !s.googleClientId?.trim()}
      <p class="muted">
        {t('google.addId')} <button class="link" onclick={() => store.go('settings')}>{t('nav.settings')}</button>
        {t('google.addId2')}
      </p>
    {/if}
    <details class="help" open={!s.googleClientId?.trim()}>
      <summary>{t('google.setup')}</summary>
      <ol class="steps">
        <li>{t('google.step1')}</li>
        <li>
          {t('google.step2')}
        </li>
        <li>
          {t('google.step3')}
        </li>
        <li>
          {t('google.step4')}
          <code>{origin}</code>.
        </li>
        <li>
          {t('google.step5')} <button class="link" onclick={() => store.go('settings')}>{t('nav.settings')}</button>.
        </li>
      </ol>
    </details>
    <div class="btns">
      {#if signedIn}
        <button class="btn" onclick={doSignOut}>{t('google.signOut')}</button>
        {#if grantedLabels.length}<span class="muted">{t('google.access', { list: grantedLabels.join(', ') })}</span>{/if}
      {:else}
        <button class="btn primary" onclick={doSignIn} disabled={authBusy || !s.googleClientId?.trim()}>{authBusy ? t('google.opening') : t('google.signIn')}</button>
      {/if}
    </div>
    <label class="check"
      ><input type="checkbox" checked={s.googleClassroomEnabled} onchange={(e) => store.updateSettings({ googleClassroomEnabled: (e.target as HTMLInputElement).checked })} />
      {t('google.includeClassroom')}</label
    >
    {#if google.error}<p class="err">{google.error}</p>{/if}
  </section>

  <section class="card">
    <h2>{t('google.scanTitle')}</h2>
    <p class="muted">
      {t('google.scanHelp')}
    </p>
    <form
      class="scan"
      onsubmit={(e) => {
        e.preventDefault();
        void scan();
      }}
    >
      <input class="input" bind:value={query} placeholder={DEFAULT_GMAIL_QUERY} aria-label={t('google.query')} spellcheck="false" />
      <button class="btn primary" type="submit" disabled={scanBusy || !s.googleClientId?.trim()}>{scanBusy ? t('google.scanning') : t('google.scan')}</button>
      <button class="btn ghost sm" type="button" onclick={() => (query = DEFAULT_GMAIL_QUERY)}>{t('google.resetQuery')}</button>
    </form>
    {#if scanError}<p class="err">{scanError}</p>{/if}
    {#if scanned}
      <div class="result-head">
        <span class="muted"
          >{t('google.messages', { count: scannedCount })} · {t('google.suggestions', { count: visible.length })}{suggestions.length - visible.length
            ? ` · ${t('google.alreadyIgnored', { n: suggestions.length - visible.length })}`
            : ''}</span
        >
        {#if highCount}<button class="btn sm" onclick={addAllHigh}>{t('google.addHigh', { n: highCount })}</button>{/if}
      </div>
      {#if !visible.length}
        <p class="muted">{t('google.nothingNew')} <code>newer_than:60d from:school.org</code>.</p>
      {/if}
      <ul class="suggestions">
        {#each visible as x (x.messageId)}
          <li class="sug">
            <div class="top">
              <span class="chip conf {x.confidence}">{t(`google.conf.${x.confidence}`)}</span>
              <input class="input title" bind:value={x.title} aria-label={t('editor.titlePh')} />
            </div>
            <div class="meta">
              {#if x.dueAt}<span class="chip">📅 {formatDue(x.dueAt, store.now, s.timeFormat)}</span>{:else}<span class="chip faint">{t('focus.noDate')}</span>{/if}
              <select class="select course" bind:value={x.courseId} aria-label={t('inbox.course')}>
                <option value={undefined}>{t('inbox.noCourse')}</option>
                {#each store.activeCourses as c (c.id)}<option value={c.id}>{c.emoji ?? ''} {c.name}</option>{/each}
              </select>
              <a class="open" href={x.url} target="_blank" rel="noopener noreferrer">{t('google.openMail')}</a>
              <span class="spacer"></span>
              <button class="btn sm primary" onclick={() => addOne(x)} disabled={!x.title.trim()}>{t('app.addTask')}</button>
              <button class="btn sm ghost" onclick={() => ignore(x)}>{t('google.ignore')}</button>
            </div>
            <div class="reason">{x.reason}</div>
          </li>
        {/each}
      </ul>
      {#if s.gmailIgnored?.length}
        <button class="btn ghost sm" onclick={forgetIgnored}>{t('google.forget', { count: s.gmailIgnored.length })}</button>
      {/if}
    {/if}
  </section>

  <section class="card">
    <h2>Google Classroom</h2>
    <p class="muted">{t('google.classroomHelp')}</p>
    <div class="btns">
      <button class="btn primary" onclick={runClassroomImport} disabled={classroomBusy || !s.googleClientId?.trim()}
        >{classroomBusy ? t('cards.importing') : t('google.importClassroom')}</button
      >
      {#if classroomResult}
        <span class="muted"
          >{t('google.result', { added: classroomResult.added, done: classroomResult.done, skipped: classroomResult.skipped })}{classroomResult.courses
            ? ` · ${t('google.newCourses', { count: classroomResult.courses })}`
            : ''} ({t('review.total', { n: classroomResult.total })})</span
        >
      {/if}
    </div>
    {#if classroomError}<p class="err">{classroomError}</p>{/if}
  </section>

  <section class="card">
    <h2>Google Calendar</h2>
    <p class="muted">{t('google.calHelp', { n: upcoming.length })}</p>
    <div class="btns">
      <button class="btn primary" onclick={pushCalendar} disabled={calBusy || !s.googleClientId?.trim()}>{calBusy ? t('google.pushing') : t('google.push')}</button>
    </div>
  </section>

  <section class="card">
    <div class="head">
      <h2>{t('google.driveTitle')}</h2>
      {#if s.googleSyncEnabled}
        <span class="status" class:ok={google.syncStatus === 'ok'} class:error={google.syncStatus === 'error'}>
          {google.syncStatus === 'syncing'
            ? `⏳ ${t('sync.syncing')}`
            : google.syncStatus === 'ok'
              ? `● ${t('google.synced')}`
              : google.syncStatus === 'error'
                ? `● ${t('google.error')}`
                : `○ ${t('google.waiting')}`}
        </span>
      {/if}
    </div>
    <p class="muted">
      {t('google.driveHelp')}
    </p>
    <label class="check"
      ><input type="checkbox" checked={s.googleSyncEnabled} disabled={syncBusy} onchange={(e) => void toggleSync((e.target as HTMLInputElement).checked)} />
      {t('google.driveToggle')}</label
    >
    <div class="btns">
      <button class="btn" onclick={syncNow} disabled={syncBusy || !s.googleSyncEnabled || !s.googleClientId?.trim()}>{syncBusy ? t('sync.syncing') : t('sync.now')}</button>
      <span class="muted">{t('google.lastSync', { when: fmtWhen(s.lastGoogleSyncAt) })}</span>
    </div>
    {#if google.syncError}<p class="err">{google.syncError}</p>{/if}
  </section>
</div>

<style>
  .google {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 6px;
  }
  h2 {
    font-size: 16px;
    margin: 0 0 6px;
  }
  .head h2 {
    margin: 0;
  }
  .status {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-muted);
  }
  .status.ok {
    color: var(--success-text);
  }
  .status.error {
    color: var(--danger-text);
  }
  .muted {
    color: var(--text-muted);
    font-size: 13px;
    font-weight: 400;
    margin: 0 0 8px;
  }
  .err {
    color: var(--danger-text);
    font-size: 13px;
    margin: 8px 0 0;
  }
  .help {
    font-size: 13px;
    color: var(--text-muted);
    margin: 4px 0 10px;
  }
  .help summary {
    cursor: pointer;
    font-weight: 600;
  }
  .steps {
    padding-left: 20px;
    margin: 8px 0 0;
    font-size: 13px;
  }
  .steps li {
    margin-bottom: 6px;
  }
  code {
    font-family: var(--mono);
    font-size: 12px;
    word-break: break-all;
  }
  .btns {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
    margin: 6px 0;
  }
  .check {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    margin: 6px 0;
  }
  .link {
    color: var(--accent-text);
  }
  .scan {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }
  .scan .input {
    flex: 1 1 260px;
    font-family: var(--mono);
    font-size: 13px;
  }
  .result-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin: 12px 0 6px;
  }
  .suggestions {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .sug {
    border-top: 1px solid var(--border);
    padding: 10px 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .top {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .top .title {
    flex: 1;
    font-weight: 600;
  }
  .meta {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }
  .meta .course {
    width: auto;
    padding: 4px 8px;
    font-size: 13px;
  }
  .spacer {
    flex: 1;
  }
  .open {
    font-size: 12px;
    color: var(--accent-text);
    white-space: nowrap;
  }
  .reason {
    font-size: 12px;
    color: var(--text-faint, var(--text-muted));
  }
  .chip.faint {
    color: var(--text-faint, var(--text-muted));
  }
  .chip.conf {
    text-transform: uppercase;
    font-size: 10px;
    letter-spacing: 0.06em;
  }
  .chip.conf.high {
    color: var(--success-text);
    border-color: color-mix(in srgb, var(--success) 40%, transparent);
    background: color-mix(in srgb, var(--success) 12%, transparent);
  }
  .chip.conf.medium {
    color: var(--warn-text);
    border-color: color-mix(in srgb, var(--warn) 40%, transparent);
    background: color-mix(in srgb, var(--warn) 12%, transparent);
  }
  @media (max-width: 520px) {
    .meta .spacer {
      display: none;
    }
  }
</style>
