<script lang="ts">
  import { onMount } from 'svelte';
  import { store } from '../lib/store.svelte';
  import { toasts } from '../lib/toast.svelte';
  import { formatDue } from '../lib/dates';
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
      toasts.push({ message: google.email ? `Signed in as ${google.email}` : 'Signed in to Google', kind: 'success', emoji: '✅' });
      if (s.googleSyncEnabled) void driveSync({ pull: true, interactive: true });
    } catch (e) {
      fail('Google sign-in failed', e);
    } finally {
      authBusy = false;
    }
  }

  function doSignOut() {
    signOut();
    suggestions = [];
    scanned = false;
    toasts.push({ message: 'Signed out of Google', kind: 'info' });
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
    toasts.push({ message: `Added ${created.length} task${created.length === 1 ? '' : 's'} from Gmail`, kind: 'success', emoji: '📧' });
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
        message: tasks.length ? `Imported ${tasks.length} from Google Classroom` : 'Google Classroom is up to date',
        detail: created.size ? `${created.size} new course${created.size === 1 ? '' : 's'}` : undefined,
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
      toasts.push({ message: 'Nothing due in the next 30 days', kind: 'info' });
      return;
    }
    calBusy = true;
    try {
      const r = await pushTasksToCalendar(upcoming);
      toasts.push({ message: `Google Calendar updated`, detail: `${r.created} created · ${r.updated} updated`, kind: 'success', emoji: '📅' });
    } catch (e) {
      fail('Calendar push failed', e);
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
      if (google.syncStatus === 'ok') toasts.push({ message: 'Synced with Google Drive', kind: 'success', emoji: '☁️' });
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
    if (!iso) return 'never';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? 'never' : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }
</script>

<div class="google">
  <section class="card">
    <div class="head">
      <h2>Google account</h2>
      {#if signedIn}
        <span class="status ok">● Signed in{google.email ? ` as ${google.email}` : ''}</span>
      {:else if google.status === 'ready'}
        <span class="status">○ Not signed in</span>
      {:else}
        <span class="status">○ Needs setup</span>
      {/if}
    </div>
    {#if !s.googleClientId?.trim()}
      <p class="muted">
        Add your OAuth Client ID in <button class="link" onclick={() => store.go('settings')}>Settings</button> to enable Gmail scanning, Classroom import, Calendar push and Drive sync.
        Everything runs in your browser; nothing is sent anywhere but Google.
      </p>
    {/if}
    <details class="help" open={!s.googleClientId?.trim()}>
      <summary>Setup (one time, about 5 minutes)</summary>
      <ol class="steps">
        <li>Open <code>console.cloud.google.com</code> and create a <strong>project</strong>.</li>
        <li>
          <strong>APIs &amp; Services → OAuth consent screen</strong>: choose <strong>External</strong>, fill in the app name, and add yourself under <strong>Test users</strong>.
        </li>
        <li>
          <strong>APIs &amp; Services → Library</strong>: enable the <strong>Gmail API</strong>, <strong>Google Calendar API</strong>, <strong>Google Classroom API</strong> and
          <strong>Google Drive API</strong> (only the ones you plan to use).
        </li>
        <li>
          <strong>Credentials → Create credentials → OAuth client ID → Web application</strong>. Under <strong>Authorized JavaScript origins</strong> add this page's origin:
          <code>{origin}</code>.
        </li>
        <li>
          Copy the Client ID (ends in <code>.apps.googleusercontent.com</code>) and paste it into <button class="link" onclick={() => store.go('settings')}>Settings</button>.
        </li>
      </ol>
    </details>
    <div class="btns">
      {#if signedIn}
        <button class="btn" onclick={doSignOut}>Sign out</button>
        {#if grantedLabels.length}<span class="muted">Access: {grantedLabels.join(', ')}</span>{/if}
      {:else}
        <button class="btn primary" onclick={doSignIn} disabled={authBusy || !s.googleClientId?.trim()}>{authBusy ? 'Opening Google…' : 'Sign in with Google'}</button>
      {/if}
    </div>
    <label class="check"
      ><input type="checkbox" checked={s.googleClassroomEnabled} onchange={(e) => store.updateSettings({ googleClassroomEnabled: (e.target as HTMLInputElement).checked })} /> Include
      Google Classroom when signing in</label
    >
    {#if google.error}<p class="err">{google.error}</p>{/if}
  </section>

  <section class="card">
    <h2>Scan Gmail for assignments</h2>
    <p class="muted">
      Searches your mail with a Gmail query and suggests tasks from messages that mention homework, quizzes, due dates and so on. Only subjects and short previews are read.
    </p>
    <form
      class="scan"
      onsubmit={(e) => {
        e.preventDefault();
        void scan();
      }}
    >
      <input class="input" bind:value={query} placeholder={DEFAULT_GMAIL_QUERY} aria-label="Gmail search query" spellcheck="false" />
      <button class="btn primary" type="submit" disabled={scanBusy || !s.googleClientId?.trim()}>{scanBusy ? 'Scanning…' : 'Scan'}</button>
      <button class="btn ghost sm" type="button" onclick={() => (query = DEFAULT_GMAIL_QUERY)}>Reset query</button>
    </form>
    {#if scanError}<p class="err">{scanError}</p>{/if}
    {#if scanned}
      <div class="result-head">
        <span class="muted"
          >{scannedCount} message{scannedCount === 1 ? '' : 's'} · {visible.length} suggestion{visible.length === 1 ? '' : 's'}{suggestions.length - visible.length
            ? ` · ${suggestions.length - visible.length} already added or ignored`
            : ''}</span
        >
        {#if highCount}<button class="btn sm" onclick={addAllHigh}>Add all high-confidence ({highCount})</button>{/if}
      </div>
      {#if !visible.length}
        <p class="muted">Nothing new looked like an assignment. Try a broader query, e.g. <code>newer_than:60d from:school.org</code>.</p>
      {/if}
      <ul class="suggestions">
        {#each visible as x (x.messageId)}
          <li class="sug">
            <div class="top">
              <span class="chip conf {x.confidence}">{x.confidence}</span>
              <input class="input title" bind:value={x.title} aria-label="Task title" />
            </div>
            <div class="meta">
              {#if x.dueAt}<span class="chip">📅 {formatDue(x.dueAt, store.now, s.timeFormat)}</span>{:else}<span class="chip faint">no date</span>{/if}
              <select class="select course" bind:value={x.courseId} aria-label="Course">
                <option value={undefined}>No course</option>
                {#each store.activeCourses as c (c.id)}<option value={c.id}>{c.emoji ?? ''} {c.name}</option>{/each}
              </select>
              <a class="open" href={x.url} target="_blank" rel="noopener noreferrer">Open mail ↗</a>
              <span class="spacer"></span>
              <button class="btn sm primary" onclick={() => addOne(x)} disabled={!x.title.trim()}>Add task</button>
              <button class="btn sm ghost" onclick={() => ignore(x)}>Ignore</button>
            </div>
            <div class="reason">{x.reason}</div>
          </li>
        {/each}
      </ul>
      {#if s.gmailIgnored?.length}
        <button class="btn ghost sm" onclick={forgetIgnored}>Forget {s.gmailIgnored.length} ignored message{s.gmailIgnored.length === 1 ? '' : 's'}</button>
      {/if}
    {/if}
  </section>

  <section class="card">
    <h2>Google Classroom</h2>
    <p class="muted">Imports your active classes and their assignments. Courses are matched by name or created for you; work you already turned in is marked complete.</p>
    <div class="btns">
      <button class="btn primary" onclick={runClassroomImport} disabled={classroomBusy || !s.googleClientId?.trim()}
        >{classroomBusy ? 'Importing…' : 'Import from Classroom'}</button
      >
      {#if classroomResult}
        <span class="muted"
          >{classroomResult.added} added · {classroomResult.done} already done · {classroomResult.skipped} skipped{classroomResult.courses
            ? ` · ${classroomResult.courses} new course${classroomResult.courses === 1 ? '' : 's'}`
            : ''} ({classroomResult.total} total)</span
        >
      {/if}
    </div>
    {#if classroomError}<p class="err">{classroomError}</p>{/if}
  </section>

  <section class="card">
    <h2>Google Calendar</h2>
    <p class="muted">Adds an event for each open task with a due date in the next 30 days ({upcoming.length} right now). Running it again updates the same events.</p>
    <div class="btns">
      <button class="btn primary" onclick={pushCalendar} disabled={calBusy || !s.googleClientId?.trim()}
        >{calBusy ? 'Pushing…' : 'Push upcoming due dates to Google Calendar'}</button
      >
    </div>
  </section>

  <section class="card">
    <div class="head">
      <h2>Sync with Google Drive</h2>
      {#if s.googleSyncEnabled}
        <span class="status" class:ok={google.syncStatus === 'ok'} class:error={google.syncStatus === 'error'}>
          {google.syncStatus === 'syncing' ? '⏳ Syncing…' : google.syncStatus === 'ok' ? '● Synced' : google.syncStatus === 'error' ? '● Error' : '○ Waiting for sign-in'}
        </span>
      {/if}
    </div>
    <p class="muted">
      Keeps a private copy of your data in your Google Drive app folder so other devices signed into the same Google account stay in sync. The copy is invisible in Drive and only
      this app can read it.
    </p>
    <label class="check"
      ><input type="checkbox" checked={s.googleSyncEnabled} disabled={syncBusy} onchange={(e) => void toggleSync((e.target as HTMLInputElement).checked)} /> Sync my data through Google
      Drive</label
    >
    <div class="btns">
      <button class="btn" onclick={syncNow} disabled={syncBusy || !s.googleSyncEnabled || !s.googleClientId?.trim()}>{syncBusy ? 'Syncing…' : 'Sync now'}</button>
      <span class="muted">Last sync: {fmtWhen(s.lastGoogleSyncAt)}</span>
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
