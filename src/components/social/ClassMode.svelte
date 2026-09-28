<script lang="ts">
  // Tools → Class mode. Teachers publish a course's assignments as a read-only class list (a file, an .ics feed,
  // or a public gist); students subscribe to its link and get the assignments as tasks, refreshed on load.
  import { store } from '../../lib/store.svelte';
  import { toasts } from '../../lib/toast.svelte';
  import { downloadText } from '../../lib/download';
  import { buildClassICS, buildClassList, classLink, classSourceUrl, serializeClassList } from '../../lib/classlist';
  import { canPublishGist, classes, importFile, publishedFor, publishGist, refresh, refreshAll, savePublished, subscribe, unsubscribe } from '../../lib/social/classSync.svelte';
  import { socialUi } from '../../lib/social/state.svelte';
  import { formatDateTime } from '../../lib/dates';
  import { t } from '../../lib/i18n/index.svelte';

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
    toasts.push({ message: t('class.downloaded'), detail: t('class.downloadedDetail'), kind: 'success', emoji: '🧑‍🏫' });
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
      toasts.push({ message: pub?.gistId ? t('class.updated') : t('class.published'), detail: t('class.sendLink'), kind: 'success', emoji: '🧑‍🏫' });
    } catch (e) {
      toasts.push({ message: t('class.gistFailed'), detail: e instanceof Error ? e.message : String(e), kind: 'warn', timeout: 10000 });
    } finally {
      publishing = false;
    }
  }
  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      toasts.push({ message: t('friends.copied', { what }), kind: 'success', emoji: '📋' });
    } catch {
      toasts.push({ message: t('friends.copyFailed'), kind: 'warn' });
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
      toasts.push({ message: t('class.subFailed'), detail: err instanceof Error ? err.message : String(err), kind: 'warn', timeout: 10000 });
    }
  }
  async function onFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    try {
      if (f.size > 512 * 1024) throw new Error(t('class.tooBig'));
      importFile(await f.text());
    } catch (err) {
      toasts.push({ message: t('class.importFailed'), detail: err instanceof Error ? err.message : String(err), kind: 'warn', timeout: 10000 });
    }
  }
  function when(iso?: string): string {
    return iso ? formatDateTime(new Date(iso), { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : t('google.never');
  }
</script>

<section class="card" aria-label={t('class.subTitle')}>
  <h2>{t('class.subTitle')}</h2>
  <p class="help">
    {t('class.subHelp')}
  </p>
  {#if socialUi.classUrl}
    <p class="banner">🧑‍🏫 {t('class.shared')}</p>
  {/if}
  <form class="row" onsubmit={doSubscribe} aria-label={t('class.subList')}>
    <input class="input grow" bind:value={subUrl} placeholder="https://gist.githubusercontent.com/…/homework-todo-class.json" aria-label={t('class.link')} />
    <button class="btn primary" type="submit" disabled={!subUrl.trim() || classes.busy === 'new'}>{classes.busy === 'new' ? t('class.subscribing') : t('class.subscribe')}</button>
  </form>
  <label class="file">{t('class.orFile')} <input type="file" accept=".json,application/json" onchange={onFile} aria-label={t('class.fileLabel')} /></label>

  {#if classes.subs.length}
    <ul class="subs" aria-label={t('class.subs')}>
      {#each classes.subs as s (s.listId)}
        <li>
          <div class="grow">
            <strong>{store.courseById(s.courseId)?.emoji ?? '🧑‍🏫'} {s.course}</strong>
            {#if s.teacher}<span class="muted">· {s.teacher}</span>{/if}
            <div class="muted">
              {t('class.items', { count: s.items })} · {t('class.listUpdated', { when: when(s.updatedAt) })} · {t('class.checked', { when: when(s.lastSync) })}{s.url
                ? ''
                : ` · ${t('class.fromFile')}`}{s.removed ? ` · ${t('class.removed', { n: s.removed })}` : ''}
            </div>
            {#if s.lastError}<div class="err">{s.lastError}</div>{/if}
          </div>
          <div class="row">
            {#if s.url}<button class="btn sm" onclick={() => refresh(s.listId)} disabled={!!classes.busy}
                >{classes.busy === s.listId ? t('class.refreshing') : t('class.refresh')}</button
              >{/if}
            <button class="btn ghost sm" onclick={() => store.go('courses', { courseId: s.courseId ?? null })}>{t('class.openCourse')}</button>
            {#if unsubbing === s.listId}
              <button
                class="btn sm"
                onclick={() => {
                  unsubscribe(s.listId);
                  unsubbing = null;
                }}>{t('class.keep')}</button
              >
              <button
                class="btn sm danger"
                onclick={() => {
                  unsubscribe(s.listId, true);
                  unsubbing = null;
                }}>{t('class.removeOpen')}</button
              >
            {:else}
              <button class="btn ghost sm" onclick={() => (unsubbing = s.listId)}>{t('class.unsubscribe')}</button>
            {/if}
          </div>
        </li>
      {/each}
    </ul>
    {#if classes.subs.filter((s) => s.url).length > 1}<button class="btn sm" onclick={() => refreshAll()} disabled={!!classes.busy}>{t('class.refreshAll')}</button>{/if}
  {/if}
</section>

<section class="card" aria-label={t('class.pubTitle')}>
  <h2>{t('class.pubTitle')} <span class="muted">{t('class.forTeachers')}</span></h2>
  <p class="help">
    {t('class.pubHelp')}
  </p>
  {#if !store.activeCourses.length}
    <p class="muted">{t('class.addCourse')}</p>
  {:else}
    <div class="grid2">
      <label
        >{t('inbox.course')}
        <select class="select" bind:value={courseId} aria-label={t('class.coursePub')}>
          {#each store.activeCourses as c (c.id)}<option value={c.id}>{c.emoji ?? ''} {c.name}</option>{/each}
        </select>
      </label>
      <label>{t('class.teacher')} <input class="input" bind:value={teacher} maxlength="60" placeholder={t('class.teacherPh')} /></label>
      <label class="check"><input type="checkbox" bind:checked={includeNotes} /> {t('class.notes')}</label>
      <label class="check"><input type="checkbox" bind:checked={upcomingOnly} /> {t('class.upcoming')}</label>
    </div>
    <p class="muted">{t('class.willPublish', { count: list?.items.length ?? 0 })}</p>
    <div class="row">
      <button class="btn primary" onclick={downloadJson} disabled={!list?.items.length}>{t('class.dlJson')}</button>
      <button class="btn" onclick={downloadIcs} disabled={!list?.items.length}>{t('class.dlIcs')}</button>
      {#if canPublishGist()}
        <button class="btn" onclick={toGist} disabled={!list?.items.length || publishing}
          >{publishing ? t('class.publishing') : pub?.gistId ? t('class.updateGist') : t('class.publishGist')}</button
        >
      {/if}
    </div>
    {#if !canPublishGist()}
      <p class="muted">
        {t('class.noToken')}
      </p>
    {/if}
    {#if pub?.rawUrl}
      <div class="links">
        <p class="muted">
          {t('class.publishedAt', { when: when(pub.publishedAt) })}
        </p>
        <label>{t('class.studentLink')} <input class="input" readonly value={classLink(pub.rawUrl, location.href)} aria-label={t('class.studentLink')} /></label>
        <button class="btn sm" onclick={() => copy(classLink(pub.rawUrl!, location.href), t('class.studentLinkWhat'))}>{t('class.copyStudent')}</button>
        <label>{t('class.feed')} <input class="input" readonly value={pub.icsUrl} aria-label={t('class.feedLabel')} /></label>
        <button class="btn sm" onclick={() => copy(pub.icsUrl ?? '', t('class.calLinkWhat'))}>{t('class.copyCal')}</button>
        {#if pub.htmlUrl}<a class="muted" href={pub.htmlUrl} target="_blank" rel="noopener noreferrer">{t('class.openGist')}</a>{/if}
      </div>
    {/if}
    <details class="hosted">
      <summary>{t('class.selfHost')}</summary>
      <p class="muted">
        {t('class.selfHostHelp')}
      </p>
      <input class="input" bind:value={hostedUrl} placeholder="https://…/class-list.json" aria-label={t('class.hostedAddr')} />
      {#if hostedLink}<input class="input" readonly value={hostedLink} aria-label={t('class.hostedLink')} />{/if}
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
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
    font-weight: 800;
    letter-spacing: -0.01em;
    margin: 0;
  }
  h2::before {
    content: '';
    width: 4px;
    height: 15px;
    border-radius: 2px;
    background: var(--grad-accent);
    box-shadow: 0 0 8px color-mix(in srgb, var(--accent) 50%, transparent);
    flex-shrink: 0;
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
    background: color-mix(in srgb, var(--accent) 8%, var(--bg-elev-2));
    border: 1px solid color-mix(in srgb, var(--accent) 25%, var(--border));
    box-shadow: inset 0 1px 0 var(--sheen);
    font-size: 13px;
    animation: rise-in var(--dur-slow) var(--ease) backwards;
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
    background: var(--bg-elev-2);
    box-shadow: inset 0 1px 0 var(--sheen);
    animation: rise-in 300ms var(--ease) backwards;
    transition:
      border-color var(--dur),
      transform var(--dur) var(--spring),
      box-shadow var(--dur-slow) var(--ease);
  }
  .subs li:hover {
    transform: translateY(-1px);
    border-color: color-mix(in srgb, var(--accent) 40%, var(--border));
    box-shadow:
      inset 0 1px 0 var(--sheen),
      0 0 20px -10px color-mix(in srgb, var(--accent) 60%, transparent);
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
