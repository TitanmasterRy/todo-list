// Printable weekly planner: one column per day with that day's tasks and room to write.
import { addDaysKey, dueKey } from './dates';
import type { Task } from './types';

export interface PlanDay {
  key: string;
  tasks: Task[];
}

/** Seven days from `startKey` with the tasks due (or pinned) on each, timed ones first by time. */
export function weekPlan(tasks: Task[], startKey: string): PlanDay[] {
  const days: PlanDay[] = Array.from({ length: 7 }, (_, i) => ({ key: addDaysKey(startKey, i), tasks: [] }));
  const byKey = new Map(days.map((d) => [d.key, d]));
  for (const t of tasks) {
    if (t.archived) continue;
    const key = t.dueAt ? dueKey(t.dueAt) : t.pinnedDay;
    const day = key ? byKey.get(key) : undefined;
    if (day) day.tasks.push(t);
  }
  // plain code-point order: a date-only due key sorts before timed ones on the same day, undated (pinned) last
  const k = (t: Task) => t.dueAt ?? '\uffff';
  for (const d of days) d.tasks.sort((a, b) => (k(a) < k(b) ? -1 : k(a) > k(b) ? 1 : a.order - b.order));
  return days;
}
