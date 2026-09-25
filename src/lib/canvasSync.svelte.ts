// Canvas assignment sync from the personal calendar feed. Runs on load, every 30 minutes while open, and on demand.
import { store } from './store.svelte';
import { toasts } from './toast.svelte';
import { parseICS } from './ics-parse';
import { diffAssignments, matchCourseName, type ExternalAssignment } from './schoology';
import { canvasAssignments } from './canvas';
import { fetchFeed, shortenCourseName } from './schoologySync.svelte';
import { COURSE_COLORS, COURSE_EMOJIS } from './colors';
import { hasSecret, isLocked, useSecret } from './secrets.svelte';
import { on } from './events';

const INTERVAL_MS = 30 * 60 * 1000;

class CanvasState {
  status = $state<'off' | 'idle' | 'syncing' | 'ok' | 'error'>('off');
  lastError = $state<string | null>(null);
  lastResult = $state<{ created: number; updated: number; total: number } | null>(null);
}
export const canvas = new CanvasState();

/** Match a Canvas course name to one of ours (or make it), remembering the Canvas name as an alias. */
function courseFor(a: ExternalAssignment, made: Map<string, string>): string | undefined {
  const name = a.courseName?.trim();
  if (!name) return undefined;
  const key = name.toLowerCase();
  const alias = store.courses.find((c) => c.schoologyName?.toLowerCase() === key);
  if (alias) return alias.id;
  const matched = matchCourseName(
    name,
    store.activeCourses.map((c) => ({ id: c.id, name: c.name })),
  );
  if (matched) return matched;
  if (made.has(key)) return made.get(key);
  const i = store.courses.length + made.size;
  const c = store.addCourse({ name: shortenCourseName(name), color: COURSE_COLORS[(i * 3) % COURSE_COLORS.length], emoji: COURSE_EMOJIS[i % COURSE_EMOJIS.length] });
  store.updateCourse(c.id, { schoologyName: name });
  made.set(key, c.id);
  return c.id;
}

/** Apply a Canvas feed's text (fetched, or an uploaded .ics file). */
export function applyCanvasText(text: string): { created: number; updated: number; total: number } {
  if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error('That isn’t a calendar feed (.ics).');
  const assignments = canvasAssignments(parseICS(text), { includeEvents: !!store.settings.canvasIncludeEvents });
  const existing = store.tasks
    .filter((t) => t.externalId?.startsWith('canvas:'))
    .map((t) => ({ externalId: t.externalId!, title: t.title, dueAt: t.dueAt, notes: t.notes, completedAt: t.completedAt }));
  const made = new Map<string, string>();
  const r = store.applySyncDiff(diffAssignments(existing, assignments, store.settings.schoologyIgnored ?? []), (a) => courseFor(a, made), undefined, 'canvas');
  const out = { ...r, total: assignments.length };
  canvas.lastResult = out;
  canvas.status = 'ok';
  canvas.lastError = null;
  store.updateSettings({ lastCanvasSync: new Date().toISOString() });
  return out;
}

export async function syncCanvas(opts: { quiet?: boolean } = {}): Promise<void> {
  if (!hasSecret('canvasFeedUrl')) return;
  if (opts.quiet && isLocked('canvasFeedUrl')) return; // picked up after unlocking
  canvas.status = 'syncing';
  try {
    const url = await useSecret('canvasFeedUrl', { interactive: !opts.quiet, reason: 'Canvas sync' });
    const r = applyCanvasText(await fetchFeed(url, store.settings.schoologyProxy));
    if (!opts.quiet || r.created) toasts.push({ message: `Canvas: ${r.created} new, ${r.updated} updated`, kind: 'success', emoji: '🎨' });
  } catch (e) {
    canvas.status = 'error';
    canvas.lastError = e instanceof Error ? e.message : String(e);
    if (!opts.quiet) toasts.push({ message: 'Canvas sync failed', detail: canvas.lastError, kind: 'warn', timeout: 9000 });
  }
}

let timer: ReturnType<typeof setInterval> | undefined;
export function startCanvasSync(): void {
  if (timer || !hasSecret('canvasFeedUrl')) return;
  canvas.status = 'idle';
  on('unlocked', () => void syncCanvas({ quiet: true }));
  setTimeout(() => void syncCanvas({ quiet: true }), 4000);
  timer = setInterval(() => void syncCanvas({ quiet: true }), INTERVAL_MS);
}
