import type { Recurrence, Task } from './types';
import { addDaysKey, combineDateTime, dayName, dueKey, fromKey, isDateOnly, todayKey } from './dates';
import { t } from './i18n/index.svelte';

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
      const every = Math.max(1, rec.n ?? 1);
      // weeks count from the anchor's week (Sunday start); only every n-th week is eligible
      const weekOf = (k: string) => Math.floor((fromKey(k).getTime() / 86_400_000 + 4) / 7); // epoch day 0 was a Thursday
      const anchorWeek = weekOf(anchorKey);
      let k = addDaysKey(afterKey, 1);
      for (let i = 0; i < 7 * every + 7; i++) {
        if (days.includes(fromKey(k).getDay()) && (((weekOf(k) - anchorWeek) % every) + every) % every === 0) break;
        k = addDaysKey(k, 1);
      }
      next = k;
      break;
    }
    case 'monthly': {
      // same day of the month as the anchor (clamped to short months: the 31st becomes the 30th, 28th/29th)
      const day = fromKey(anchorKey).getDate();
      const a = fromKey(afterKey);
      for (let m = 0; m < 3 && !next; m++) {
        const y = a.getFullYear();
        const mo = a.getMonth() + m;
        const last = new Date(y, mo + 1, 0).getDate();
        const cand = dateKeyOf(new Date(y, mo, Math.min(day, last)));
        if (cand > afterKey) next = cand;
      }
      break;
    }
    case 'monthlyNth': {
      const a = fromKey(afterKey);
      const wd = rec.weekday ?? fromKey(anchorKey).getDay();
      const nth = rec.nth ?? Math.ceil(fromKey(anchorKey).getDate() / 7);
      for (let m = 0; m < 3 && !next; m++) {
        const cand = nthWeekdayKey(a.getFullYear(), a.getMonth() + m, wd, nth);
        if (cand && cand > afterKey) next = cand;
      }
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

function dateKeyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Key of the n-th (1–5, or -1 = last) weekday of a month; undefined when that month has no 5th one. */
export function nthWeekdayKey(year: number, month: number, weekday: number, nth: number): string | undefined {
  const first = new Date(year, month, 1);
  const norm = new Date(first.getFullYear(), first.getMonth(), 1);
  if (nth === -1) {
    const last = new Date(norm.getFullYear(), norm.getMonth() + 1, 0);
    const back = (last.getDay() - weekday + 7) % 7;
    return dateKeyOf(new Date(last.getFullYear(), last.getMonth(), last.getDate() - back));
  }
  const offset = (weekday - norm.getDay() + 7) % 7;
  const d = new Date(norm.getFullYear(), norm.getMonth(), 1 + offset + (nth - 1) * 7);
  return d.getMonth() === norm.getMonth() ? dateKeyOf(d) : undefined;
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
    timeSpentMin: undefined,
    timerStartedAt: undefined,
    doing: undefined,
    attachments: undefined, // files belong to the one occurrence they were added to
    subtasks: task.subtasks.map((s, i) => ({ ...s, id: `${newId}_s${i}`, done: false })),
  };
}

const ORD = ['rec.nth1', 'rec.nth1', 'rec.nth2', 'rec.nth3', 'rec.nth4', 'rec.nth5'] as const;

export function describeRecurrence(rec: Recurrence | undefined): string {
  if (!rec) return '';
  let s = '';
  switch (rec.kind) {
    case 'daily':
      s = t('rec.daily');
      break;
    case 'weekdays':
      s = t('rec.weekdays');
      break;
    case 'weekly': {
      const every = (rec.n ?? 1) > 1 ? (rec.n === 2 ? t('rec.everyOtherWeek') : t('rec.everyNWeeks', { n: rec.n! })) : '';
      const days = rec.days && rec.days.length ? rec.days.map((d) => dayName(d)).join(', ') : '';
      s = every ? (days ? t('rec.everyOn', { every, days }) : every) : days ? t('rec.everyDays', { days }) : t('rec.weekly');
      break;
    }
    case 'monthly':
      s = t('rec.monthly');
      break;
    case 'monthlyNth':
      s = t('rec.monthlyNth', { nth: rec.nth === -1 ? t('rec.last') : t(ORD[rec.nth ?? 1] ?? 'rec.nth1'), day: dayName(rec.weekday ?? 1, 'long') });
      break;
    case 'everyNDays':
      s = t('rec.everyNDays', { n: rec.n ?? 1 });
      break;
  }
  if (rec.until) s = t('rec.until', { rule: s, date: rec.until });
  return s;
}
