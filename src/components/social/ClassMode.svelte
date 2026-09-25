<script lang="ts">
  // Tools → Class mode. Teachers publish a course's assignments as a read-only class list (a file, an .ics feed,
  // or a public gist); students subscribe to its link and get the assignments as tasks, refreshed on load.
  import { store } from '../../lib/store.svelte';
  import { toasts } from '../../lib/toast.svelte';
  import { downloadText } from '../../lib/download';
  import { buildClassICS, buildClassList, classLink, classSourceUrl, serializeClassList } from '../../lib/classlist';
  import { canPublishGist, classes, importFile, publishedFor, publishGist, refresh, refreshAll, savePublished, subscribe, unsubscribe } from '../../lib/social/classSync.svelte';
  import { socialUi } from '../../lib/social/state.svelte';

  // ---------- teacher ----------
  let courseId = $state(store.activeCourses[0]?.id ?? '');
  // each course keeps one class list id, so re-publishing updates the same list for subscribed students
  $effect(() => {
    if (courseId && !classes.published[courseId]) savePublished(courseId, publishedFor(courseId));
  });
  const pub = $derived(courseId ? classes.published[courseId] : undefined);
  let teacher = $state('');
  let includeNotes = $state(true);
  let upcomingOnly = $state(true);
  let hostedUrl = $state('');
  let publishing = $state(false);
  $effect(() => {
    // load the saved choices for the picked course
    if (!pub) return;
    teacher = pub.teacher ?? '';
    includeNotes = pub.includeNotes;
    upcomingOnly = pub.upcomingOnly;
  });
  const course = $derived(store.courseById(courseId));
  const list = $derived(course && pub ? buildClassList(course, store.tasks, { id: pub.id, teacher, includeNotes, fromDay: upcomingOnly ? store.today : undefined }) : null);
  const slug = $derived(
    (course?.name ?? 'class')
      .replace(/[^\w-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'class',
  );
  const hostedLink = $derived(classSourceUrl(hostedUrl) ? classLink(classSourceUrl(hostedUrl)!, location.href) : '');

  function remember() {
    if (pub && courseId) savePublished(courseId, { ...pub, teacher: teacher.trim() || undefined, includeNotes, upcomingOnly });
  }
  function downloadJson() {
    if (!list) return;
    remember();
    downloadText(`${slug}-class-list.json`, serializeClassList(list), 'application/json');
    toasts.push({ message: 'Class list downloaded', detail: 'Host it anywhere students can reach, or send the file.', kind: 'success', emoji: '🧑‍🏫' });
  }
  function downloadIcs() {
    if (!list) return;
    remember();
    downloadText(`${slug}-class-calendar.ics`, buildClassICS(list), 'text/calendar');
  }
  async function toGist() {
    if (!list) return;
    remember();
    publishing = true;
    try {
      await publishGist(courseId, list);
      toasts.push({ message: pub?.gistId ? 'Class list updated' : 'Class list published', detail: 'Send students the link below.', kind: 'success', emoji: '🧑‍🏫' });
    } catch (e) {
      toasts.push({ message: "Couldn't publish the gist", detail: e instanceof Error ? e.message : String(e), kind: 'warn', timeout: 10000 });
    } finally {
      publishing = false;
    }
  }
  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      toasts.push({ message: `${what} copied`, kind: 'success', emoji: '📋' });
    } catch {
      toasts.push({ message: "Couldn't copy: select it and copy it", kind: 'warn' });
    }
  }

  // ---------- student ----------
  let subUrl = $state(socialUi.classUrl);
  let unsubbing = $state<string | null>(null);
  async function doSubscribe(e?: SubmitEvent) {
    e?.preventDefault();
    try {
      await subscribe(subUrl);
      subUrl = '';
      socialUi.classUrl = '';
    } catch (err) {
      toasts.push({ message: "Couldn't subscribe", detail: err instanceof Error ? err.message : String(err), kind: 'warn', timeout: 10000 });
    }
  }
  async function onFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    try {
      if (f.size > 512 * 1024) throw new Error('The file is too big (over 512 kB).');
      importFile(await f.text());
    } catch (err) {
      toasts.push({ message: "Couldn't import the class list", detail: err instanceof Error ? err.message : String(err), kind: 'warn', timeout: 10000 });
    }
  }
  function when(iso?: string): string {
    return iso ? new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'never';
  }
</script>

<section class="card" aria-label="Subscribe to a class">
  <h2>Subscribe to a class</h2>
  <p class="help">
    Paste the link your teacher shared. The app fetches the list now, each time it opens, and when you press Refresh, and adds the assignments to that course. It's read-only:
    nothing goes back to the teacher, and your own changes (notes, done, deleted) stay yours.
  </p>
  {#if socialUi.classUrl}
    <p class="banner">🧑‍🏫 Someone shared a class list with you. Check the link, then press Subscribe.</p>
  {/if}
  <form class="row" onsubmit={doSubscribe} aria-label="Subscribe to a class list">
    <input class="input grow" bind:value={subUrl} placeholder="https://gist.githubusercontent.com/…/homework-todo-class.json" aria-label="Class list link" />
    <button class="btn primary" type="submit" disabled={!subUrl.trim() || classes.busy === 'new'}>{classes.busy === 'new' ? 'Subscribing…' : 'Subscribe'}</button>
  </form>
  <label class="file">Or import a class list file <input type="file" accept=".json,application/json" onchange={onFile} aria-label="Import a class list file" /></label>

  {#if classes.subs.length}
    <ul class="subs" aria-label="Class subscriptions">
      {#each classes.subs as s (s.listId)}
        <li>
          <div class="grow">
            <strong>{store.courseById(s.courseId)?.emoji ?? '🧑‍🏫'} {s.course}</strong>
            {#if s.teacher}<span class="muted">· {s.teacher}</span>{/if}
            <div class="muted">
              {s.items} assignment{s.items === 1 ? '' : 's'} · list updated {when(s.updatedAt)} · checked {when(s.lastSync)}{s.url ? '' : ' · from a file'}{s.removed
                ? ` · ${s.removed} no longer listed`
                : ''}
            </div>
            {#if s.lastError}<div class="err">{s.lastError}</div>{/if}
          </div>
          <div class="row">
            {#if s.url}<button class="btn sm" onclick={() => refresh(s.listId)} disabled={!!classes.busy}>{classes.busy === s.listId ? 'Refreshing…' : 'Refresh'}</button>{/if}
            <button class="btn ghost sm" onclick={() => store.go('courses', { courseId: s.courseId ?? null })}>Open course</button>
            {#if unsubbing === s.listId}
              <button
                class="btn sm"
                onclick={() => {
                  unsubscribe(s.listId);
                  unsubbing = null;
                }}>Keep tasks</button
              >
              <button
                class="btn sm danger"
                onclick={() => {
                  unsubscribe(s.listId, true);
                  unsubbing = null;
                }}>Remove open tasks</button
              >
            {:else}
              <button class="btn ghost sm" onclick={() => (unsubbing = s.listId)}>Unsubscribe</button>
            {/if}
          </div>
        </li>
      {/each}
    </ul>
    {#if classes.subs.filter((s) => s.url).length > 1}<button class="btn sm" onclick={() => refreshAll()} disabled={!!classes.busy}>Refresh all</button>{/if}
  {/if}
</section>

<section class="card" aria-label="Publish a class list">
  <h2>Publish a class list <span class="muted">for teachers</span></h2>
  <p class="help">
    Pick a course and share its assignments with students. Only each assignment's title, due date, type, notes (if you tick it) and link are published: never grades, completion,
    time spent or anything else from this app.
  </p>
  {#if !store.activeCourses.length}
    <p class="muted">Add a course with some assignments first.</p>
  {:else}
    <div class="grid2">
      <label
        >Course
        <select class="select" bind:value={courseId} aria-label="Course to publish">
          {#each store.activeCourses as c (c.id)}<option value={c.id}>{c.emoji ?? ''} {c.name}</option>{/each}
        </select>
      </label>
      <label>Teacher name (optional) <input class="input" bind:value={teacher} maxlength="60" placeholder="Ms. Rivera" /></label>
      <label class="check"><input type="checkbox" bind:checked={includeNotes} /> Include notes</label>
      <label class="check"><input type="checkbox" bind:checked={upcomingOnly} /> Only today and later</label>
    </div>
    <p class="muted">{list?.items.length ?? 0} assignment{list?.items.length === 1 ? '' : 's'} will be published.</p>
    <div class="row">
      <button class="btn primary" onclick={downloadJson} disabled={!list?.items.length}>Download class list (.json)</button>
      <button class="btn" onclick={downloadIcs} disabled={!list?.items.length}>Download calendar (.ics)</button>
      {#if canPublishGist()}
        <button class="btn" onclick={toGist} disabled={!list?.items.length || publishing}
          >{publishing ? 'Publishing…' : pub?.gistId ? 'Update public gist' : 'Publish as public gist'}</button
        >
      {/if}
    </div>
    {#if !canPublishGist()}
      <p class="muted">
        Add a GitHub token in Settings → Sync (Gist) to publish a link you can update with one click. Or host the downloaded file anywhere and paste its link below.
      </p>
    {/if}
    {#if pub?.rawUrl}
      <div class="links">
        <p class="muted">
          Published {when(pub.publishedAt)}. Anyone with these links can read the list (a public gist). Press Update after changing assignments; students get it the next time their
          app opens.
        </p>
        <label>Link for students <input class="input" readonly value={classLink(pub.rawUrl, location.href)} aria-label="Link for students" /></label>
        <button class="btn sm" onclick={() => copy(classLink(pub.rawUrl!, location.href), 'Student link')}>Copy student link</button>
        <label>Calendar feed (.ics) <input class="input" readonly value={pub.icsUrl} aria-label="Calendar feed link" /></label>
        <button class="btn sm" onclick={() => copy(pub.icsUrl ?? '', 'Calendar link')}>Copy calendar link</button>
        {#if pub.htmlUrl}<a class="muted" href={pub.htmlUrl} target="_blank" rel="noopener noreferrer">Open the gist on GitHub</a>{/if}
      </div>
    {/if}
    <details class="hosted">
      <summary>Hosting the file yourself?</summary>
      <p class="muted">
        Put the .json file on any https site that allows cross-site reads (GitHub, a school site with CORS), then paste its address to get a student link. The .ics file works as a
        calendar subscription in Google, Apple and Outlook calendars.
      </p>
      <input class="input" bind:value={hostedUrl} placeholder="https://…/class-list.json" aria-label="Hosted class list address" />
      {#if hostedLink}<input class="input" readonly value={hostedLink} aria-label="Student link for the hosted file" />{/if}
    </details>
  {/if}
</section>

<style>
  section {
    margin-bottom: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  h2 {
    font-size: 16px;
    margin: 0;
  }
  .help,
  .muted {
    font-size: 13px;
    color: var(--text-muted);
    margin: 0;
  }
  .banner {
    margin: 0;
    padding: 8px 10px;
    border-radius: 8px;
    background: var(--bg-elev-2);
    font-size: 13px;
  }
  .row {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }
  .grow {
    flex: 1;
    min-width: 180px;
  }
  .file {
    font-size: 13px;
    color: var(--text-muted);
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }
  .subs {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .subs li {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
    padding: 8px 10px;
    border: 1px solid var(--border);
    border-radius: 10px;
  }
  .err {
    font-size: 12px;
    color: var(--danger, #ef4444);
  }
  .danger {
    color: var(--danger, #ef4444);
  }
  .grid2 {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 10px;
  }
  .grid2 label,
  .links label {
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
  }
  .links,
  .hosted {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 13px;
  }
  .hosted summary {
    cursor: pointer;
    color: var(--text-muted);
  }
</style>
