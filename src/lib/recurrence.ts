import type { Recurrence, Task } from './types';
import { addDaysKey, combineDateTime, dueKey, fromKey, isDateOnly, todayKey } from './dates';

/** Compute the next due day key strictly after `afterKey` for a recurrence. Returns undefined if past `until`. */
export function nextOccurrenceKey(rec: Recurrence, anchorKey: string, afterKey: string): string | undefined {
  let next: string | undefined;
  switch (rec.kind) {
    case 'daily': {
      next = addDaysKey(afterKey, 1);
      break;
    }
    case 'weekdays': {
      let k = addDaysKey(afterKey, 1);
      for (let i = 0; i < 8; i++) {
        const dow = fromKey(k).getDay();
        if (dow >= 1 && dow <= 5) break;
        k = addDaysKey(k, 1);
      }
      next = k;
      break;
    }
    case 'weekly': {
      const days = rec.days && rec.days.length ? [...rec.days].sort() : [fromKey(anchorKey).getDay()];
      let k = addDaysKey(afterKey, 1);
      for (let i = 0; i < 8; i++) {
        if (days.includes(fromKey(k).getDay())) break;
        k = addDaysKey(k, 1);
      }
      next = k;
      break;
    }
    case 'everyNDays': {
      const n = Math.max(1, rec.n ?? 1);
      // step from the anchor in multiples of n until strictly after afterKey
      let k = anchorKey;
      let guard = 0;
      while (k <= afterKey && guard++ < 5000) k = addDaysKey(k, n);
      next = k;
      break;
    }
  }
  if (next && rec.until && next > rec.until) return undefined;
  return next;
}

/** Build the next instance of a recurring task when `task` is completed. Returns undefined if the series has ended. */
export function spawnNextInstance(task: Task, now: Date = new Date(), newId: string): Task | undefined {
  if (!task.recurrence) return undefined;
  const anchor = task.dueAt ? dueKey(task.dueAt) : todayKey(now);
  const after = anchor > todayKey(now) ? anchor : todayKey(now);
  const nextKey = nextOccurrenceKey(task.recurrence, anchor, after);
  if (!nextKey) return undefined;
  let dueAt: string = nextKey;
  if (task.dueAt && !isDateOnly(task.dueAt)) {
    const d = new Date(task.dueAt);
    dueAt = combineDateTime(nextKey, d.getHours(), d.getMinutes());
  }
  const iso = now.toISOString();
  return {
    ...structuredClone(task),
    id: newId,
    dueAt,
    completedAt: undefined,
    createdAt: iso,
    updatedAt: iso,
    deferredCount: 0,
    frog: false,
    frogDate: undefined,
    archived: false,
    subtasks: task.subtasks.map((s, i) => ({ ...s, id: `${newId}_s${i}`, done: false })),
  };
}

export function describeRecurrence(rec: Recurrence | undefined): string {
  if (!rec) return '';
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  let s = '';
  switch (rec.kind) {
    case 'daily':
      s = 'Every day';
      break;
    case 'weekdays':
      s = 'Weekdays';
      break;
    case 'weekly':
      s = rec.days && rec.days.length ? `Every ${rec.days.map((d) => names[d]).join(', ')}` : 'Weekly';
      break;
    case 'everyNDays':
      s = `Every ${rec.n ?? 1} days`;
      break;
  }
  if (rec.until) s += ` until ${rec.until}`;
  return s;
}
