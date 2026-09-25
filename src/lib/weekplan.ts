// Plan my week: spread open work over the next days by estimate and daily capacity, earliest deadline first,
// never after a task's due day and never before the tasks it waits on.
import { addDaysKey, dueKey } from './dates';
import type { Priority, Task } from './types';

export const DEFAULT_ESTIMATE = 30;
const PRIORITY_RANK: Record<Priority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

export interface PlannedItem {
  task: Task;
  min: number;
  guessed: boolean; // no estimate on the task; DEFAULT_ESTIMATE was used
  late: boolean; // didn't fit on or before its due day (put on the least-full allowed day)
}
export interface PlanDay {
  key: string;
  capacity: number;
  used: number;
  items: PlannedItem[];
}
export interface WeekPlan {
  days: PlanDay[];
  unplaced: Task[]; // undated work that didn't fit
}

export function planWeek(tasks: Task[], opts: { today: string; days?: number; capacity: (key: string) => number; includeUndated?: boolean }): WeekPlan {
  const n = opts.days ?? 7;
  const days: PlanDay[] = Array.from({ length: n }, (_, i) => {
    const key = addDaysKey(opts.today, i);
    return { key, capacity: Math.max(0, opts.capacity(key)), used: 0, items: [] };
  });
  const last = days[n - 1].key;
  const open = tasks.filter((t) => !t.completedAt && !t.archived);
  const dated = open.filter((t) => t.dueAt && dueKey(t.dueAt) <= last);
  const undated = opts.includeUndated ? open.filter((t) => !t.dueAt) : [];
  const rank = (t: Task) => [t.dueAt ? dueKey(t.dueAt) : '9999', PRIORITY_RANK[t.priority], t.order] as const;
  const cmp = (a: Task, b: Task) => {
    const [x, y] = [rank(a), rank(b)];
    return x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : x[1] - y[1] || x[2] - y[2];
  };
  const dayOf = new Map<string, number>(); // task id → planned day index
  const placeable = [...dated.sort(cmp), ...undated.sort(cmp)];

  // blockers first: a task waiting on another comes after it in the queue
  const queue: Task[] = [];
  const seen = new Set<string>();
  const ids = new Set(placeable.map((t) => t.id));
  const visit = (t: Task, depth = 0) => {
    if (seen.has(t.id) || depth > 20) return;
    seen.add(t.id);
    for (const b of t.blockedBy ?? []) {
      const bt = placeable.find((x) => x.id === b);
      if (bt && ids.has(b)) visit(bt, depth + 1);
    }
    queue.push(t);
  };
  for (const t of placeable) visit(t);

  const unplaced: Task[] = [];
  for (const t of queue) {
    const min = t.estimateMin && t.estimateMin > 0 ? t.estimateMin : DEFAULT_ESTIMATE;
    const due = t.dueAt ? dueKey(t.dueAt) : undefined;
    const latest = due
      ? Math.max(
          0,
          days.findIndex((d) => d.key === (due < opts.today ? opts.today : due)),
        )
      : n - 1;
    const earliest = Math.min(latest, Math.max(0, ...(t.blockedBy ?? []).map((b) => dayOf.get(b) ?? 0)));
    let pick = -1;
    for (let i = earliest; i <= latest; i++) {
      if (days[i].capacity - days[i].used >= min) {
        pick = i;
        break;
      }
    }
    let late = false;
    if (pick < 0) {
      if (!due) {
        unplaced.push(t);
        continue;
      }
      // doesn't fit: the least-full day it's still allowed on
      pick = earliest;
      for (let i = earliest; i <= latest; i++) if (days[i].capacity - days[i].used > days[pick].capacity - days[pick].used) pick = i;
      late = true;
    }
    days[pick].items.push({ task: t, min, guessed: !(t.estimateMin && t.estimateMin > 0), late });
    days[pick].used += min;
    dayOf.set(t.id, pick);
  }
  return { days, unplaced };
}

/** The pinnedDay each task should get: the planned day when it's before the due day, otherwise none. */
export function pinsFor(plan: WeekPlan): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const d of plan.days) for (const it of d.items) out[it.task.id] = it.task.dueAt && dueKey(it.task.dueAt) <= d.key ? undefined : d.key;
  return out;
}
