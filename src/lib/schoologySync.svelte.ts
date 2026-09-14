// Schoology assignment sync via the personal iCal feed. Runs on load, every 30 minutes while open, and on demand.
import { store } from './store.svelte';
import { toasts } from './toast.svelte';
import { parseICS } from './ics-parse';
import { diffAssignments, eventsToAssignments, matchCourseName, type ExternalAssignment } from './schoology';
import { autoDescribe } from './autodescribe';
import { COURSE_COLORS, COURSE_EMOJIS } from './colors';

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
      ? 'The browser blocked the request (CORS). Add a CORS proxy in the setup panel, or upload the .ics file instead.'
      : msg,
  );
}

function resolveCourse(a: ExternalAssignment, autoCreate: boolean, created: Map<string, string>): string | undefined {
  const name = a.courseName?.trim();
  if (!name) return undefined;
  const norm = name.toLowerCase();
  const byAlias = store.courses.find((c) => c.schoologyName && c.schoologyName.toLowerCase() === norm);
  if (byAlias) return byAlias.id;
  const matched = matchCourseName(name, store.activeCourses.map((c) => ({ id: c.id, name: c.name })));
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
  return name.split(/\s+[-–:]\s+|\s*\(|\s+section\s+/i)[0].trim().slice(0, 40) || name;
}

/** Sync from raw iCalendar text (feed, upload, or paste). */
export async function syncFromText(text: string): Promise<{ created: number; updated: number; total: number }> {
  const events = parseICS(text);
  const assignments = eventsToAssignments(events);
  const settings = store.settings;
  const createdCourses = new Map<string, string>();
  const unmatched = new Set<string>();
  const courseFor = (a: ExternalAssignment) => {
    const id = resolveCourse(a, settings.schoologyAutoCreateCourses, createdCourses);
    if (!id && a.courseName) unmatched.add(a.courseName);
    return id;
  };
  const existing = store.tasks
    .filter((t) => t.externalId)
    .map((t) => ({ externalId: t.externalId!, title: t.title, dueAt: t.dueAt, notes: t.notes, completedAt: t.completedAt }));
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

let inFlight: Promise<void> | null = null;

export async function syncNow(opts: { quiet?: boolean } = {}): Promise<void> {
  const { schoologyFeedUrl: url, schoologyProxy: proxy } = store.settings;
  if (!url) {
    schoology.status = 'off';
    return;
  }
  if (inFlight) return inFlight;
  inFlight = (async () => {
    schoology.status = 'syncing';
    schoology.lastError = null;
    try {
      const text = await fetchFeed(url, proxy);
      const r = await syncFromText(text);
      schoology.status = 'ok';
      if (!opts.quiet || r.created > 0) {
        toasts.push({
          message: r.created ? `${r.created} new assignment${r.created > 1 ? 's' : ''} from Schoology` : 'Schoology is up to date',
          detail: r.updated ? `${r.updated} updated · ${r.total} in feed` : `${r.total} in feed`,
          kind: r.created ? 'success' : 'info',
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
  if (store.settings.schoologyFeedUrl) {
    schoology.status = 'idle';
    void syncNow({ quiet: true });
  }
  timer = setInterval(() => {
    if (document.visibilityState === 'visible' && store.settings.schoologyFeedUrl) void syncNow({ quiet: true });
  }, INTERVAL_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !store.settings.schoologyFeedUrl) return;
    const last = store.settings.lastSchoologySync ? new Date(store.settings.lastSchoologySync).getTime() : 0;
    if (Date.now() - last > INTERVAL_MS) void syncNow({ quiet: true });
  });
}

export function stopSchoologySync(): void {
  if (timer) clearInterval(timer);
  timer = undefined;
  started = false;
}
