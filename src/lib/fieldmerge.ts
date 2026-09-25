// Field-level merge for tasks: each task remembers when each field last changed (`fieldAt`), so two devices
// that edit different fields of the same task both keep their edit. Fields changed before tracking began
// count as of `fieldBase`; tasks from older versions (no fieldBase) fall back to whole-task last-write-wins.
import type { Task } from './types';

/** Bookkeeping, not content: never compared or merged field by field. */
const META = new Set<keyof Task>(['id', 'updatedAt', 'fieldAt', 'fieldBase', 'createdAt']);

function same(a: unknown, b: unknown): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}

/** Record which fields changed between the last saved copy and the new one. */
export function stampChanges(prev: Task | undefined, next: Task, now: string = new Date().toISOString()): Task {
  if (!prev) return next.fieldBase ? next : { ...next, fieldBase: next.createdAt || now };
  const fieldAt: Record<string, string> = { ...(prev.fieldAt ?? {}), ...(next.fieldAt ?? {}) };
  let changed = false;
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)] as (keyof Task)[]);
  for (const k of keys) {
    if (META.has(k) || same(prev[k], next[k])) continue;
    fieldAt[k] = now;
    changed = true;
  }
  // a task from before field tracking: everything it already had dates from its last save
  const fieldBase = next.fieldBase ?? prev.fieldBase ?? prev.updatedAt;
  if (!changed && next.fieldBase === fieldBase && same(next.fieldAt, prev.fieldAt)) return next;
  return { ...next, fieldAt, fieldBase };
}

function timeOf(t: Task, k: string): string {
  return t.fieldAt?.[k] ?? t.fieldBase ?? t.updatedAt;
}

/**
 * Merge two versions of one task field by field (newest change wins per field). Returns the merged task and
 * whether both sides changed the same field to different values within the same second (a real conflict).
 */
export function mergeTask(l: Task, r: Task): { task: Task; conflict: boolean } {
  if (l.updatedAt === r.updatedAt && same(l, r)) return { task: l, conflict: false };
  // no field history on either side: plain last-write-wins, like before
  if (!l.fieldBase && !r.fieldBase && !l.fieldAt && !r.fieldAt) return { task: r.updatedAt > l.updatedAt ? r : l, conflict: false };
  const newer = r.updatedAt > l.updatedAt ? r : l;
  const out: Record<string, unknown> = { ...newer };
  const fieldAt: Record<string, string> = {};
  let conflict = false;
  const keys = new Set([...Object.keys(l), ...Object.keys(r)]);
  for (const k of keys) {
    if (META.has(k as keyof Task)) continue;
    const lv = (l as unknown as Record<string, unknown>)[k];
    const rv = (r as unknown as Record<string, unknown>)[k];
    const lt = timeOf(l, k);
    const rt = timeOf(r, k);
    const pickR = rt > lt || (rt === lt && newer === r);
    out[k] = pickR ? rv : lv;
    if (out[k] === undefined) delete out[k];
    const stamp = pickR ? rt : lt;
    if (l.fieldAt?.[k] || r.fieldAt?.[k]) fieldAt[k] = stamp;
    if (!same(lv, rv) && l.fieldAt?.[k] && r.fieldAt?.[k] && lt.slice(0, 19) === rt.slice(0, 19)) conflict = true;
  }
  const bases = [l.fieldBase, r.fieldBase].filter((x): x is string => !!x).sort();
  return {
    task: { ...(out as unknown as Task), fieldAt, fieldBase: bases[0], updatedAt: l.updatedAt > r.updatedAt ? l.updatedAt : r.updatedAt },
    conflict,
  };
}
