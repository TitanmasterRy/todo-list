// Schoology assignment sync via the personal iCal feed. Runs on load, every 30 minutes while open, and on demand.
import { store } from './store.svelte';
import { toasts } from './toast.svelte';
import { parseICS } from './ics-parse';
import { diffAssignments, eventsToAssignments, matchCourseName, type ExternalAssignment } from './schoology';
import { autoDescribe } from './autodescribe';
import { COURSE_COLORS, COURSE_EMOJIS } from './colors';
import { pullAll, getMe } from './schoologyApi';
import { hasSecret, isLocked, useSecret } from './secrets.svelte';
import { on } from './events';
import { cspHint } from './csp';

const intervalMs = () => Math.max(5, store.settings.schoologyIntervalMin || 30) * 60 * 1000;
const INTERVAL_MS = 30 * 60 * 1000;

class SchoologyState {
  status = $state<'off' | 'idle' | 'syncing' | 'ok' | 'error'>('off');
  lastError = $state<string | null>(null);
  lastResult = $state<{ created: number; updated: number; total: number } | null>(null);
  unmatched = $state<string[]>([]); // course names from the feed with no matching course
  pending = $state<ExternalAssignment[]>([]); // assignments waiting on a course mapping (only when auto-create is off)
}
export const schoology = new SchoologyState();

let timer: ReturnType<typeof setInterval> | undefined;
let started = false;
let offUnlocked: (() => void) | undefined;

/** Fetch the feed: direct first, then through the optional CORS proxy prefix. */
export async function fetchFeed(url: string, proxy: string): Promise<string> {
  const target = url.trim().replace(/^webcal:\/\//i, 'https://');
  const attempts: string[] = [];
  if (proxy.trim()) attempts.push(proxy.includes('{url}') ? proxy.replace('{url}', encodeURIComponent(target)) : proxy + encodeURIComponent(target));
  attempts.push(target);
  let lastErr: unknown;
  for (const u of attempts) {
    try {
      const res = await fetch(u, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error('Response is not an iCalendar feed');
      return text;
    } catch (e) {
      lastErr = e;
    }
  }
  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
  throw new Error(
    /Failed to fetch|NetworkError|Load failed/i.test(msg)
      ? `The browser blocked the request (CORS). Add a CORS proxy in the setup panel, or upload the .ics file instead.${proxy.trim() ? cspHint(proxy.trim()) : ''}`
      : msg,
  );
}

function resolveCourse(a: ExternalAssignment, autoCreate: boolean, created: Map<string, string>): string | undefined {
  const name = a.courseName?.trim();
  if (!name) return undefined;
  const norm = name.toLowerCase();
  const byAlias = store.courses.find((c) => c.schoologyName && c.schoologyName.toLowerCase() === norm);
  if (byAlias) return byAlias.id;
  const matched = matchCourseName(
    name,
    store.activeCourses.map((c) => ({ id: c.id, name: c.name })),
  );
  if (matched) return matched;
  if (created.has(norm)) return created.get(norm);
  if (autoCreate) {
    const i = store.courses.length + created.size;
    const c = store.addCourse({ name: shortenCourseName(name), color: COURSE_COLORS[(i * 3) % COURSE_COLORS.length], emoji: COURSE_EMOJIS[i % COURSE_EMOJIS.length] });
    store.updateCourse(c.id, { schoologyName: name });
    created.set(norm, c.id);
    return c.id;
  }
  return undefined;
}

/** "AP Calculus BC - Period 3 - Smith" → "AP Calculus BC" */
export function shortenCourseName(name: string): string {
  return (
    name
      .split(/\s+[-–:]\s+|\s*\(|\s+section\s+/i)[0]
      .trim()
      .slice(0, 40) || name
  );
}

/** Sync from raw iCalendar text (feed, upload, or paste). */
export async function syncFromText(text: string): Promise<{ created: number; updated: number; total: number }> {
  const events = parseICS(text);
  return applyAssignments(eventsToAssignments(events));
}

/** Apply a list of external assignments (from the feed or the API): match courses, diff, create/update. */
export function applyAssignments(assignments: ExternalAssignment[]): { created: number; updated: number; total: number } {
  const settings = store.settings;
  const createdCourses = new Map<string, string>();
  const unmatched = new Set<string>();
  const courseFor = (a: ExternalAssignment) => {
    const id = resolveCourse(a, settings.schoologyAutoCreateCourses, createdCourses);
    if (!id && a.courseName) unmatched.add(a.courseName);
    return id;
  };
  const existing = store.tasks.filter((t) => t.externalId).map((t) => ({ externalId: t.externalId!, title: t.title, dueAt: t.dueAt, notes: t.notes, completedAt: t.completedAt }));
  const diff = diffAssignments(existing, assignments, settings.schoologyIgnored);
  const describe = (a: ExternalAssignment) => {
    if (!settings.autoDescribe) return {};
    const courseName = a.courseName ?? store.courseById(courseFor(a))?.name;
    const d = autoDescribe(a.title, { courseName, type: a.type });
    return { notes: a.notes ? undefined : d.notes, subtasks: d.subtasks.map((s) => ({ id: '', title: s, done: false })), estimateMin: d.estimateMin, tags: d.tags };
  };
  const result = store.applySyncDiff(diff, courseFor, describe);
  schoology.unmatched = [...unmatched];
  const out = { ...result, total: assignments.length };
  schoology.lastResult = out;
  store.updateSettings({ lastSchoologySync: new Date().toISOString(), lastSchoologyError: undefined });
  return out;
}

/** API mode: pull sections, assignments and grades with the user's key/secret (through the proxy). */
export async function syncFromApi(opts: { interactive?: boolean } = {}): Promise<{ created: number; updated: number; total: number; graded: number }> {
  const s = store.settings;
  const key = await useSecret('schoologyKey', opts);
  const apiSecret = await useSecret('schoologySecret', opts);
  if (!key || !apiSecret) throw new Error('Add your Schoology API key and secret first.');
  if (!s.schoologyProxy) throw new Error('The Schoology API needs the CORS proxy (see Setup).');
  const creds = { key, secret: apiSecret, proxy: s.schoologyProxy };
  const data = await pullAll(creds, s.schoologyDomain, s.schoologyImportGrades);
  const out = applyAssignments(data.assignments);
  // grades → scores on the matching tasks (pays grade XP the first time)
  let graded = 0;
  if (s.schoologyImportGrades) {
    const byExt = new Map(store.tasks.filter((t) => t.externalId).map((t) => [t.externalId!, t]));
    for (const [ext, g] of data.grades) {
      const t = byExt.get(ext);
      if (!t || typeof t.score === 'number') continue;
      store.updateTask(t.id, { score: g.score, completedAt: t.completedAt ?? new Date().toISOString() });
      graded++;
    }
    for (const [name, pct] of data.finalGrades) {
      const c = store.courses.find((x) => x.schoologyName === name || x.name.toLowerCase() === name.toLowerCase());
      if (c && c.finalGrade !== pct) store.updateCourse(c.id, { finalGrade: pct });
    }
  }
  return { ...out, graded };
}

/** Verify key/secret: returns the display name on success. */
export async function testApiCredentials(key: string, secret: string, proxy: string): Promise<string> {
  const me = await getMe({ key, secret, proxy });
  return me.name_display;
}

let inFlight: Promise<void> | null = null;

export function schoologyConfigured(): boolean {
  return store.settings.schoologyMode === 'api' ? hasSecret('schoologyKey') && hasSecret('schoologySecret') : hasSecret('schoologyFeedUrl');
}

export async function syncNow(opts: { quiet?: boolean } = {}): Promise<void> {
  const { schoologyProxy: proxy, schoologyMode: mode } = store.settings;
  if (!schoologyConfigured()) {
    schoology.status = 'off';
    return;
  }
  // background refreshes skip quietly while the key lock is closed; a button press asks for the passphrase
  if (opts.quiet && isLocked(mode === 'api' ? 'schoologyKey' : 'schoologyFeedUrl')) {
    schoology.status = 'idle';
    return;
  }
  const url = mode === 'api' ? '' : await useSecret('schoologyFeedUrl');
  if (inFlight) return inFlight;
  inFlight = (async () => {
    schoology.status = 'syncing';
    schoology.lastError = null;
    try {
      let r: { created: number; updated: number; total: number; graded?: number };
      if (mode === 'api') r = await syncFromApi({ interactive: !opts.quiet });
      else r = await syncFromText(await fetchFeed(url, proxy));
      schoology.status = 'ok';
      if (!opts.quiet || r.created > 0 || (r.graded ?? 0) > 0) {
        toasts.push({
          message: r.created ? `${r.created} new assignment${r.created > 1 ? 's' : ''} from Schoology` : 'Schoology is up to date',
          detail: [
            r.updated ? `${r.updated} updated` : '',
            r.graded ? `${r.graded} new grade${r.graded > 1 ? 's' : ''}` : '',
            `${r.total} in ${mode === 'api' ? 'Schoology' : 'feed'}`,
          ]
            .filter(Boolean)
            .join(' · '),
          kind: r.created || r.graded ? 'success' : 'info',
          emoji: '🔄',
        });
      }
    } catch (e) {
      schoology.status = 'error';
      schoology.lastError = e instanceof Error ? e.message : String(e);
      store.updateSettings({ lastSchoologyError: schoology.lastError });
      if (!opts.quiet) toasts.push({ message: 'Schoology sync failed', detail: schoology.lastError, kind: 'warn', timeout: 10000 });
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

export function startSchoologySync(): void {
  if (started) return;
  started = true;
  if (schoologyConfigured()) {
    schoology.status = 'idle';
    void syncNow({ quiet: true });
  }
  const tick = () => {
    if (document.visibilityState !== 'visible' || !schoologyConfigured()) return;
    const last = store.settings.lastSchoologySync ? new Date(store.settings.lastSchoologySync).getTime() : 0;
    if (Date.now() - last > intervalMs() - 5000) void syncNow({ quiet: true });
  };
  timer = setInterval(tick, 60 * 1000);
  offUnlocked ??= on('unlocked', () => {
    if (schoologyConfigured()) void syncNow({ quiet: true });
  });
  document.addEventListener('visibilitychange', tick);
  window.addEventListener('online', tick);
  void INTERVAL_MS;
}

export function stopSchoologySync(): void {
  if (timer) clearInterval(timer);
  timer = undefined;
  started = false;
}
