<script lang="ts">
  import { store, byDueThenOrder } from '../lib/store.svelte';
  import { toasts } from '../lib/toast.svelte';
  import type { Task } from '../lib/types';
  import { addDaysKey, dueKey, isOverdue, isDueToday } from '../lib/dates';
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
      toasts.push({ message: 'The proxy is required for the API', detail: 'Deploy docs/cors-proxy-worker.js (2 minutes, free) and paste its URL.', kind: 'warn', timeout: 9000 });
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
      toasts.push({ message: `Signed in as ${signedInAs}`, detail: 'Assignments and grades will sync automatically.', kind: 'success', emoji: '🔄' });
      showSetup = false;
      void syncNow();
    } catch (e) {
      toasts.push({ message: 'Sign-in failed', detail: e instanceof Error ? e.message : String(e), kind: 'warn', timeout: 10000 });
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
        message: `Imported ${r.created} new assignment${r.created === 1 ? '' : 's'}`,
        detail: `${r.updated} updated · ${r.total} in file`,
        kind: 'success',
        emoji: '🔄',
      });
      pasted = '';
      showSetup = false;
    } catch (e) {
      toasts.push({ message: 'Could not read that calendar', detail: e instanceof Error ? e.message : String(e), kind: 'warn' });
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
    toasts.push({ message: `Mapped “${name}”`, detail: 'Sync again to attach existing assignments.', kind: 'success' });
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
      <h1>Schoology</h1>
      <div class="sub">Assignments synced from your Schoology calendar. Complete them here to earn XP; deadlines stay in step with the feed.</div>
    </div>
    <div class="grow"></div>
    {#if schoologyConfigured()}
      <span class="status {schoology.status}">
        {schoology.status === 'syncing' ? 'Syncing…' : schoology.status === 'error' ? 'Sync error' : schoology.status === 'ok' ? 'Synced' : 'Connected'}
        {#if store.settings.lastSchoologySync}<span class="muted">
            · {new Date(store.settings.lastSchoologySync).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span
          >{/if}
      </span>
      <button class="btn sm" onclick={() => void syncNow()} disabled={schoology.status === 'syncing'}>Sync now</button>
      <button class="btn ghost sm" onclick={() => (showSetup = !showSetup)}>Setup</button>
    {/if}
  </header>

  {#if schoology.status === 'error' && schoology.lastError}
    <div class="card err">⚠ {schoology.lastError}</div>
  {/if}

  {#if showSetup}
    <section class="card setup">
      <h2>Connect Schoology</h2>
      <div class="modes" role="tablist">
        <button role="tab" aria-selected={mode === 'api'} class:on={mode === 'api'} onclick={() => (mode = 'api')}
          >Sign in with API key <span class="rec">assignments + grades</span></button
        >
        <button role="tab" aria-selected={mode === 'ics'} class:on={mode === 'ics'} onclick={() => (mode = 'ics')}>Calendar feed <span class="rec">assignments only</span></button>
      </div>
      <p class="help">
        Schoology has no “Sign in with Schoology” button for outside apps, and it blocks browsers on other sites from talking to it. Both ways below need a tiny relay you own:
        deploy <code>docs/cors-proxy-worker.js</code> as a free Cloudflare Worker (about two minutes) and paste its URL. Your keys go only from your browser to Schoology through that
        relay.
      </p>
      <label class="fld">CORS proxy prefix <input class="input" bind:value={proxy} placeholder="https://your-worker.workers.dev/?url=" /></label>
      {#if mode === 'api'}
        <ol class="steps">
          <li>
            Open <a href="https://app.schoology.com/api" target="_blank" rel="noopener noreferrer">app.schoology.com/api</a> while logged in. It shows your personal
            <strong>Consumer Key</strong>
            and <strong>Secret</strong>. (If the page is missing, your school has disabled student API access; use the calendar feed instead.)
          </li>
          <li>Paste them below and sign in. The app then syncs every course, assignment, due date and grade on load and every {interval} minutes.</li>
        </ol>
        <form
          class="grid"
          onsubmit={(e) => {
            e.preventDefault();
            void signIn();
          }}
        >
          <label class="fld">Consumer key <input class="input" bind:value={apiKey} autocomplete="off" /></label>
          <label class="fld">Consumer secret <input class="input" type="password" bind:value={apiSecret} autocomplete="off" /></label>
          <label class="fld">Your school’s Schoology address (optional, for links) <input class="input" bind:value={domain} placeholder="https://myschool.schoology.com" /></label>
          <label class="fld">Sync every <input class="input num" type="number" min="5" max="240" bind:value={interval} /> minutes</label>
          <label class="check"
            ><input
              type="checkbox"
              checked={store.settings.schoologyImportGrades}
              onchange={(e) => store.updateSettings({ schoologyImportGrades: (e.target as HTMLInputElement).checked })}
            /> Import grades (fills scores on assignments and course final grades; pays grade XP)</label
          >
          <label class="check"
            ><input
              type="checkbox"
              checked={store.settings.schoologyAutoCreateCourses}
              onchange={(e) => store.updateSettings({ schoologyAutoCreateCourses: (e.target as HTMLInputElement).checked })}
            /> Create courses automatically for new class names</label
          >
          <label class="check"
            ><input type="checkbox" checked={store.settings.autoDescribe} onchange={(e) => store.updateSettings({ autoDescribe: (e.target as HTMLInputElement).checked })} /> Auto-describe
            assignments that have no description</label
          >
          <div class="btns">
            <button class="btn primary" type="submit" disabled={signingIn || !apiKey.trim() || !apiSecret.trim()}>{signingIn ? 'Signing in…' : 'Sign in and sync'}</button>
            {#if schoologyConfigured()}<button type="button" class="btn danger" onclick={disconnect}>Disconnect</button>{/if}
          </div>
        </form>
      {:else}
        <ol class="steps">
          <li>
            In Schoology open <strong>Calendar</strong> → <strong>⚙ / Export</strong> → <strong>Enable</strong> the iCal feed and copy its URL (<code
              >https://app.schoology.com/calendar/feed/ical/…/schoology.ics</code
            >).
          </li>
          <li>Paste it below. Without a proxy you can still upload the <code>.ics</code> file by hand whenever you want to refresh.</li>
        </ol>
        <form
          class="grid"
          onsubmit={(e) => {
            e.preventDefault();
            saveSetup();
          }}
        >
          <label class="fld">Feed URL <input class="input" bind:value={url} placeholder="https://app.schoology.com/calendar/feed/ical/…/schoology.ics" /></label>
          {#if url && !isSchoologyFeedUrl(url)}<span class="warn">That doesn’t look like a Schoology iCal URL, but you can try it.</span>{/if}
          <label class="fld">Sync every <input class="input num" type="number" min="5" max="240" bind:value={interval} /> minutes</label>
          <label class="check"
            ><input
              type="checkbox"
              checked={store.settings.schoologyAutoCreateCourses}
              onchange={(e) => store.updateSettings({ schoologyAutoCreateCourses: (e.target as HTMLInputElement).checked })}
            /> Create courses automatically for new class names</label
          >
          <label class="check"
            ><input type="checkbox" checked={store.settings.autoDescribe} onchange={(e) => store.updateSettings({ autoDescribe: (e.target as HTMLInputElement).checked })} /> Auto-describe
            assignments that have no description (plan, steps, estimate)</label
          >
          <div class="btns">
            <button class="btn primary" type="submit" disabled={!url.trim()}>Save and sync</button>
            {#if schoologyConfigured()}<button type="button" class="btn danger" onclick={disconnect}>Disconnect</button>{/if}
          </div>
        </form>
        <div class="manual">
          <h3>Or import the file manually</h3>
          <div class="btns">
            <button class="btn" onclick={() => fileInput?.click()} disabled={busy}>Upload .ics file…</button>
            <input type="file" accept=".ics,text/calendar" class="visually-hidden" bind:this={fileInput} onchange={onFile} aria-label="Upload calendar file" />
          </div>
          <textarea class="textarea" bind:value={pasted} placeholder="…or paste the contents of the .ics file here (starts with BEGIN:VCALENDAR)"></textarea>
          <button class="btn sm" onclick={() => void importText(pasted)} disabled={!pasted.trim() || busy}>Import pasted calendar</button>
        </div>
      {/if}
    </section>
  {/if}

  {#if schoology.unmatched.length}
    <section class="card">
      <h2>Match classes to courses</h2>
      <p class="muted">These class names in the feed don’t match a course yet. Pick one or create it, then sync again.</p>
      {#each schoology.unmatched as name (name)}
        <div class="map-row">
          <span class="grow">{name}</span>
          <select class="select" onchange={(e) => mapCourse(name, (e.target as HTMLSelectElement).value)} aria-label="Course for {name}">
            <option value="">Choose…</option>
            <option value="__new">Create “{name}”</option>
            {#each store.activeCourses as c (c.id)}<option value={c.id}>{c.emoji ?? ''} {c.name}</option>{/each}
          </select>
        </div>
      {/each}
    </section>
  {/if}

  {#if !synced.length && !showSetup}
    <div class="empty">
      <div class="big">🔄</div>
      <h3>No synced assignments yet</h3>
      <p>Sync now, or open Setup to upload your calendar file.</p>
    </div>
  {/if}

  {#if overdue.length}
    <div class="section-title overdue">
      <span>Overdue</span><span class="count">{overdue.length}</span><span class="spacer"></span><button class="btn sm" onclick={() => store.rollOverdueToToday()}
        >Roll all to today</button
      >
    </div>
    <div class="task-list">
      {#each overdue as task (task.id)}<TaskItem {task} listIds={ids} />{/each}
    </div>
  {/if}
  {#if dueSoon.length}
    <div class="section-title"><span>Due in the next 7 days</span><span class="count">{dueSoon.length}</span></div>
    <div class="task-list">
      {#each dueSoon as task (task.id)}<TaskItem {task} listIds={ids} />{/each}
    </div>
  {/if}
  {#if later.length}
    <div class="section-title"><span>Later</span><span class="count">{later.length}</span></div>
    <div class="task-list">
      {#each later as task (task.id)}<TaskItem {task} listIds={ids} />{/each}
    </div>
  {/if}
  {#if done.length}
    <button class="section-title toggle" onclick={() => (showDone = !showDone)} aria-expanded={showDone}>
      <span>Completed</span><span class="count">{done.length}</span><span class="spacer"></span><span class="hint">{showDone ? 'Hide' : 'Show'}</span>
    </button>
    {#if showDone}
      <div class="task-list">
        {#each done.slice(0, 60) as task (task.id)}<TaskItem {task} compact />{/each}
      </div>
    {/if}
  {/if}
  {#if synced.length && !showSetup}
    <p class="muted foot">
      Deleting a synced assignment here keeps it from coming back on the next sync. Manage the connection under Setup, or in <button
        class="link"
        onclick={() => store.go('settings')}>Settings</button
      >.
    </p>
  {/if}
</div>

<style>
  .status {
    font-size: 13px;
    font-weight: 600;
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
  }
  .err {
    color: var(--danger-text);
    margin-bottom: 12px;
  }
  .setup h2,
  section h2 {
    font-size: 16px;
    margin: 0 0 8px;
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
    font-weight: 600;
    font-size: 13px;
    color: var(--text-muted);
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
  }
  .modes button.on {
    border-color: var(--accent);
    color: var(--text);
    background: color-mix(in srgb, var(--accent) 12%, transparent);
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
  }
  .map-row .select {
    width: auto;
  }
  .grow {
    flex: 1;
  }
  section.card {
    margin-bottom: 12px;
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
