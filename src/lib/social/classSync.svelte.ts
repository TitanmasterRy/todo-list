// Class mode on this device: the class lists you subscribe to (fetched on load and on demand, then applied with the
// same diff and task creation as Schoology, marked source 'class'), and the lists you publish as a teacher.
import { store } from '../store.svelte';
import { applySyncDiff } from '../syncImport.svelte';
import { toasts } from '../toast.svelte';
import { cspHint } from '../csp';
import { randomId } from '../b64url';
import { hasSecret, useSecret } from '../secrets.svelte';
import { matchCourseName } from '../schoology';
import { COURSE_COLORS, COURSE_EMOJIS } from '../colors';
import {
  buildClassICS,
  CLASS_FILE,
  CLASS_ICS_FILE,
  CLASS_LIMITS,
  classExternalId,
  ClassListError,
  classSourceUrl,
  diffClass,
  gistRawUrl,
  parseClassList,
  serializeClassList,
  type ClassList,
} from '../classlist';
import { CLASS_SUBS_KEY } from './links';
import { t as tr } from '../i18n/index.svelte';

const PUBLISHED_KEY = 'homework-todo:class-published';
const FETCH_TIMEOUT_MS = 15_000;

export interface ClassSub {
  listId: string;
  url: string; // '' for a list imported from a file (update it by importing again)
  course: string;
  courseId?: string;
  teacher?: string;
  items: number;
  updatedAt: string; // the list's own date
  lastSync?: string;
  lastError?: string;
  removed?: number; // open tasks whose item is no longer on the list
}

export interface Published {
  id: string; // class list id
  teacher?: string;
  includeNotes: boolean;
  upcomingOnly: boolean;
  gistId?: string;
  htmlUrl?: string;
  rawUrl?: string;
  icsUrl?: string;
  publishedAt?: string;
}

function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, v: unknown): void {
  try {
    if (v === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* ignore */
  }
}

class ClassState {
  subs = $state<ClassSub[]>(read<ClassSub[]>(CLASS_SUBS_KEY, []).filter((s) => s && typeof s.listId === 'string'));
  busy = $state<string | null>(null); // listId being refreshed, or 'new'
  published = $state<Record<string, Published>>(read(PUBLISHED_KEY, {}));
}
export const classes = new ClassState();

function saveSubs(): void {
  write(CLASS_SUBS_KEY, classes.subs.length ? classes.subs : null);
}

/** Fetch a class list: https only, no cookies, no referrer, a size cap and a timeout. */
export async function fetchClassText(url: string): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    let res: Response;
    try {
      res = await fetch(url, { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', signal: ctrl.signal });
    } catch (e) {
      if (ctrl.signal.aborted) throw new Error(tr('class.slow'));
      throw new Error(`${e instanceof Error && /fetch|network|load failed/i.test(e.message) ? tr('cl.blocked') : tr('cl.couldNot')}${cspHint(url)}`);
    }
    if (!res.ok) throw new Error(tr('class.http', { status: res.status }));
    if (Number(res.headers.get('content-length') ?? 0) > CLASS_LIMITS.bytes) throw new ClassListError(tr('cl.tooBig'));
    // read at most the size limit, even if the server lied about the length
    const reader = res.body?.getReader();
    if (!reader) return await res.text();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > CLASS_LIMITS.bytes) {
        void reader.cancel();
        throw new ClassListError(tr('cl.tooBig'));
      }
      chunks.push(value);
    }
    const all = new Uint8Array(size);
    let o = 0;
    for (const c of chunks) {
      all.set(c, o);
      o += c.length;
    }
    return new TextDecoder().decode(all);
  } finally {
    clearTimeout(t);
  }
}

function courseFor(list: ClassList, sub: ClassSub | undefined): string {
  const kept = sub?.courseId && store.courseById(sub.courseId);
  if (kept) return kept.id;
  const matched = matchCourseName(
    list.course,
    store.activeCourses.map((c) => ({ id: c.id, name: c.name })),
  );
  if (matched) return matched;
  const i = store.courses.length;
  return store.addCourse({
    name: list.course.slice(0, 40),
    color: list.color ?? COURSE_COLORS[(i * 3) % COURSE_COLORS.length],
    emoji: list.emoji ?? COURSE_EMOJIS[i % COURSE_EMOJIS.length],
  }).id;
}

/** Apply a parsed list: create the course if needed, then create and update its tasks. */
function applyList(list: ClassList, url: string): { created: number; updated: number; sub: ClassSub } {
  const prev = classes.subs.find((s) => s.listId === list.id);
  const courseId = courseFor(list, prev);
  const existing = store.tasks.filter((t) => t.externalId).map((t) => ({ externalId: t.externalId!, title: t.title, dueAt: t.dueAt, notes: t.notes, completedAt: t.completedAt }));
  const { diff, removed } = diffClass(existing, list, store.settings.schoologyIgnored); // deleted tasks' external ids land there, whatever the source
  const r = applySyncDiff(store, diff, () => courseId, undefined, 'class');
  const sub: ClassSub = {
    listId: list.id,
    url: url || prev?.url || '',
    course: list.course,
    courseId,
    teacher: list.teacher,
    items: list.items.length,
    updatedAt: list.updatedAt,
    lastSync: new Date().toISOString(),
    removed: removed.length || undefined,
  };
  classes.subs = prev ? classes.subs.map((s) => (s.listId === list.id ? sub : s)) : [...classes.subs, sub];
  saveSubs();
  return { ...r, sub };
}

function report(r: { created: number; updated: number; sub: ClassSub }, quiet: boolean): void {
  if (quiet && !r.created) return;
  toasts.push({
    message: r.created ? tr('class.newFrom', { count: r.created, course: r.sub.course }) : tr('class.courseUpToDate', { course: r.sub.course }),
    detail: [r.updated ? tr('class.nUpdated', { n: r.updated }) : '', tr('class.onList', { n: r.sub.items })].filter(Boolean).join(' · '),
    kind: r.created ? 'success' : 'info',
    emoji: '🧑‍🏫',
  });
}

/** Subscribe to a class list link (or refresh it if already subscribed). */
export async function subscribe(input: string): Promise<ClassSub> {
  const url = classSourceUrl(input);
  if (!url) throw new Error(tr('class.pasteLink'));
  classes.busy = 'new';
  try {
    const { list, skipped } = parseClassList(await fetchClassText(url));
    const r = applyList(list, url);
    report(r, false);
    if (skipped) toasts.push({ message: tr('class.skipped', { count: skipped }), kind: 'warn' });
    return r.sub;
  } finally {
    classes.busy = null;
  }
}

/** Import a class list file (no link, so it updates only when a newer file is imported). */
export function importFile(text: string): ClassSub {
  const { list } = parseClassList(text);
  const r = applyList(list, '');
  report(r, false);
  return r.sub;
}

export async function refresh(listId: string, opts: { quiet?: boolean } = {}): Promise<void> {
  const sub = classes.subs.find((s) => s.listId === listId);
  if (!sub?.url) return;
  classes.busy = listId;
  try {
    const { list } = parseClassList(await fetchClassText(sub.url));
    if (list.id !== sub.listId) throw new ClassListError(tr('cl.different'));
    report(applyList(list, sub.url), !!opts.quiet);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    classes.subs = classes.subs.map((s) => (s.listId === listId ? { ...s, lastError: msg } : s));
    saveSubs();
    if (!opts.quiet) toasts.push({ message: tr('class.refreshFailed', { course: sub.course }), detail: msg, kind: 'warn', timeout: 10000 });
  } finally {
    classes.busy = null;
  }
}

export async function refreshAll(opts: { quiet?: boolean } = {}): Promise<void> {
  for (const s of classes.subs) if (s.url) await refresh(s.listId, opts);
}

/** Stop following a list. Its tasks stay unless `removeOpen`, which deletes the ones not done yet (undoable). */
export function unsubscribe(listId: string, removeOpen = false): void {
  if (removeOpen) {
    const prefix = classExternalId(listId, '');
    const ids = store.tasks.filter((t) => t.source === 'class' && t.externalId?.startsWith(prefix) && !t.completedAt).map((t) => t.id);
    if (ids.length) store.bulkDelete(ids);
  }
  classes.subs = classes.subs.filter((s) => s.listId !== listId);
  saveSubs();
}

// ---------- publishing (teachers) ----------

export function publishedFor(courseId: string): Published {
  return classes.published[courseId] ?? { id: randomId(12), includeNotes: true, upcomingOnly: true };
}

export function savePublished(courseId: string, p: Published): void {
  classes.published = { ...classes.published, [courseId]: p };
  write(PUBLISHED_KEY, classes.published);
}

export function canPublishGist(): boolean {
  return hasSecret('gistToken');
}

/** Publish (or update) the list as a public gist with the Gist sync token; returns the stable raw links. */
export async function publishGist(courseId: string, list: ClassList): Promise<Published> {
  const token = await useSecret('gistToken', { interactive: true, reason: tr('unlock.github') });
  if (!token) throw new Error(tr('class.needToken'));
  const p = { ...publishedFor(courseId), id: list.id };
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' };
  const body = JSON.stringify({
    description: `${list.course}: class list (Homework To-Do)`,
    public: true,
    files: { [CLASS_FILE]: { content: serializeClassList(list) }, [CLASS_ICS_FILE]: { content: buildClassICS(list) } },
  });
  let res = p.gistId ? await fetch(`https://api.github.com/gists/${encodeURIComponent(p.gistId)}`, { method: 'PATCH', headers, body }) : null;
  // first publish, or the old gist was deleted: make a new one
  if (!res || res.status === 404) res = await fetch('https://api.github.com/gists', { method: 'POST', headers, body });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      msg = ((await res.json()) as { message?: string }).message ?? msg;
    } catch {
      /* keep the status text */
    }
    throw new Error(`GitHub ${res.status}: ${msg}`);
  }
  const j = (await res.json()) as { id?: string; html_url?: string; owner?: { login?: string } };
  if (!j.id || !j.owner?.login) throw new Error('GitHub did not return the gist.');
  const next: Published = {
    ...p,
    gistId: j.id,
    htmlUrl: j.html_url,
    rawUrl: gistRawUrl(j.owner.login, j.id, CLASS_FILE),
    icsUrl: gistRawUrl(j.owner.login, j.id, CLASS_ICS_FILE),
    publishedAt: new Date().toISOString(),
  };
  savePublished(courseId, next);
  return next;
}
