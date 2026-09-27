// Per-task edit history: what changed and when ("Due: Fri → Mon"). Kept on the task (last 25 changes) so it syncs;
// two devices' histories are merged by time. Typing bursts on the same field within 2 minutes count as one change.
import type { Task } from './types';

export interface HistoryEntry {
  at: string; // ISO time
  f: string; // field name
  from?: string; // short display value before
  to?: string; // and after
}

export const HISTORY_MAX = 25;
const COALESCE_MS = 2 * 60_000;

/** Fields worth showing. Bookkeeping, sort order and timer ticks are left out. */
export const TRACKED: (keyof Task)[] = [
  'title',
  'notes',
  'courseId',
  'tags',
  'priority',
  'dueAt',
  'estimateMin',
  'type',
  'weight',
  'score',
  'subtasks',
  'recurrence',
  'completedAt',
  'pinnedDay',
  'archived',
  'blockedBy',
  'reminders',
  'doing',
  'deckId',
  'attachments',
];

function display(k: keyof Task, v: unknown): string | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  if (k === 'subtasks' && Array.isArray(v)) return `${v.filter((s: { done?: boolean }) => s?.done).length}/${v.length}`;
  if ((k === 'blockedBy' || k === 'reminders' || k === 'attachments') && Array.isArray(v)) return String(v.length);
  if (k === 'tags' && Array.isArray(v)) return v.map((t) => `#${t}`).join(' ');
  if (k === 'notes') return String(v).replace(/\s+/g, ' ').slice(0, 60);
  if (k === 'recurrence' && typeof v === 'object') return (v as { kind?: string }).kind ?? 'on';
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 60);
  return String(v).slice(0, 60);
}

function same(a: unknown, b: unknown): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}

/** The task's history after a save that turned `prev` into `next`. Returns the same array when nothing tracked changed. */
export function recordHistory(prev: Task, next: Task, now: string): HistoryEntry[] | undefined {
  let list = next.history ?? prev.history;
  const added: HistoryEntry[] = [];
  for (const k of TRACKED) {
    if (same(prev[k], next[k])) continue;
    added.push({ at: now, f: k, from: display(k, prev[k]), to: display(k, next[k]) });
  }
  if (!added.length) return list;
  list = [...(list ?? [])];
  for (const e of added) {
    const last = list.findLast((x) => x.f === e.f);
    if (last && list[list.length - 1] === last && Date.parse(e.at) - Date.parse(last.at) < COALESCE_MS && e.f !== 'completedAt') {
      list[list.length - 1] = { ...last, at: e.at, to: e.to };
      if (same(last.from, e.to)) list.pop(); // changed and changed back
    } else list.push(e);
  }
  return list.slice(-HISTORY_MAX);
}

/** Union of two devices' histories, oldest first, capped. */
export function mergeHistory(a: HistoryEntry[] | undefined, b: HistoryEntry[] | undefined): HistoryEntry[] | undefined {
  if (!a?.length) return b?.length ? b : a;
  if (!b?.length) return a;
  const seen = new Map<string, HistoryEntry>();
  for (const e of [...a, ...b]) seen.set(`${e.at}|${e.f}`, e);
  return [...seen.values()].sort((x, y) => x.at.localeCompare(y.at)).slice(-HISTORY_MAX);
}

/** Keep only well-formed entries (for imports and sync). */
export function normalizeHistory(v: unknown): HistoryEntry[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v
    .filter((e) => e && typeof e === 'object' && typeof e.at === 'string' && typeof e.f === 'string')
    .map((e) => ({
      at: e.at as string,
      f: (e.f as string).slice(0, 30),
      from: typeof e.from === 'string' ? e.from.slice(0, 60) : undefined,
      to: typeof e.to === 'string' ? e.to.slice(0, 60) : undefined,
    }));
  return out.length ? out.slice(-HISTORY_MAX) : undefined;
}
