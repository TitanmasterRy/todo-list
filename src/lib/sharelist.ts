// Group projects: share a few tasks as a link (#tasks=…). Everything travels in the URL hash, so it never reaches the
// web host, and nothing is linked afterwards: each person gets their own copy. Only titles, due dates, types,
// estimates, steps and (optionally) notes are shared, never completion, grades or time spent. Pure, so it's unit-tested.
import { cleanText, decodeJson, toB64url } from './b64url';
import { dueKey } from './dates';
import { TASK_TYPES, type Task, type TaskType } from './types';

export interface SharedItem {
  t: string; // title
  d?: string; // due (YYYY-MM-DD or ISO)
  y?: TaskType;
  e?: number; // estimate, minutes
  s?: string[]; // step titles
  n?: string; // notes
}

export interface SharedList {
  v: 1;
  name?: string; // "Bio lab group"
  from?: string; // who shared it
  items: SharedItem[];
}

export const SHARE_LIMITS = { items: 40, title: 200, notes: 600, steps: 12, step: 120, name: 60, code: 24_000 } as const;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?Z$/;

export function buildSharedList(tasks: Task[], o: { name?: string; from?: string; notes: boolean }): SharedList {
  const items = tasks.slice(0, SHARE_LIMITS.items).map((task) => {
    const it: SharedItem = { t: cleanText(task.title, SHARE_LIMITS.title) };
    if (task.dueAt) it.d = task.dueAt.length === 10 ? task.dueAt : new Date(task.dueAt).toISOString();
    if (task.type) it.y = task.type;
    if (task.estimateMin) it.e = task.estimateMin;
    const steps = task.subtasks.map((s) => cleanText(s.title, SHARE_LIMITS.step)).filter(Boolean);
    if (steps.length) it.s = steps.slice(0, SHARE_LIMITS.steps);
    const notes = o.notes ? cleanText(task.notes, SHARE_LIMITS.notes, true) : '';
    if (notes) it.n = notes;
    return it;
  });
  const list: SharedList = { v: 1, items };
  const name = cleanText(o.name, SHARE_LIMITS.name);
  if (name) list.name = name;
  const from = cleanText(o.from, SHARE_LIMITS.name);
  if (from) list.from = from;
  return list;
}

export function shareLink(list: SharedList, base: string): string {
  return `${base.replace(/#.*$/, '')}#tasks=${toB64url(JSON.stringify(list))}`;
}

/** Parse a link's code (untrusted). Returns null for anything that isn't a shared list. */
export function parseSharedList(code: string): SharedList | null {
  const raw = decodeJson(code, SHARE_LIMITS.code);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const j = raw as Record<string, unknown>;
  if (j.v !== 1 || !Array.isArray(j.items)) return null;
  const items: SharedItem[] = [];
  for (const x of j.items.slice(0, SHARE_LIMITS.items) as unknown[]) {
    if (!x || typeof x !== 'object') continue;
    const o = x as Record<string, unknown>;
    const title = cleanText(o.t, SHARE_LIMITS.title);
    if (!title) continue;
    const it: SharedItem = { t: title };
    if (typeof o.d === 'string' && (DAY.test(o.d) || ISO.test(o.d)) && Number.isFinite(Date.parse(o.d))) it.d = o.d;
    if (TASK_TYPES.includes(o.y as TaskType)) it.y = o.y as TaskType;
    if (typeof o.e === 'number' && o.e > 0 && o.e <= 1440) it.e = Math.round(o.e);
    if (Array.isArray(o.s)) {
      const s = o.s
        .map((v) => cleanText(v, SHARE_LIMITS.step))
        .filter(Boolean)
        .slice(0, SHARE_LIMITS.steps);
      if (s.length) it.s = s;
    }
    const n = cleanText(o.n, SHARE_LIMITS.notes, true);
    if (n) it.n = n;
    items.push(it);
  }
  if (!items.length) return null;
  const list: SharedList = { v: 1, items };
  const name = cleanText(j.name, SHARE_LIMITS.name);
  if (name) list.name = name;
  const from = cleanText(j.from, SHARE_LIMITS.name);
  if (from) list.from = from;
  return list;
}

/** Items already on the list (same title and due day) are skipped when adding. */
export function isDuplicate(it: SharedItem, tasks: Task[]): boolean {
  const day = it.d ? dueKey(it.d) : undefined;
  return tasks.some((x) => x.title.toLowerCase() === it.t.toLowerCase() && (x.dueAt ? dueKey(x.dueAt) : undefined) === day);
}
