// "Spread over the week": instead of rolling every overdue task onto today, hand them out over the next few days,
// most important first, keeping each day inside the planner's capacity. Pure: the store applies the plan.
import type { Priority, Task } from './types';
import { addDaysKey, fromKey } from './dates';

export interface SpreadOpts {
  days?: number; // how many days from today to use (default 5)
  budgetMin?: number; // minutes per day (the planner's daily capacity)
  weekdayBudget?: Record<number, number>; // per weekday (0 = Sunday) overrides
  usedMin?: Record<string, number>; // minutes already due on each day
  defaultEstimateMin?: number; // for tasks with no estimate
}

export interface Placement {
  id: string;
  day: string; // YYYY-MM-DD
}

type Candidate = Pick<Task, 'id' | 'priority' | 'dueAt' | 'estimateMin' | 'type' | 'weight'>;

const RANK: Record<Priority, number> = { urgent: 3, high: 2, normal: 1, low: 0 };

/** Order to place: priority, then graded work (exams, big weights), then whatever has waited longest. */
export function spreadOrder(a: Candidate, b: Candidate): number {
  const pr = RANK[b.priority] - RANK[a.priority];
  if (pr) return pr;
  const ga = a.type === 'exam' || a.type === 'quiz' || (a.weight ?? 0) >= 10 ? 1 : 0;
  const gb = b.type === 'exam' || b.type === 'quiz' || (b.weight ?? 0) >= 10 ? 1 : 0;
  if (ga !== gb) return gb - ga;
  return (a.dueAt ?? '').localeCompare(b.dueAt ?? '');
}

/** Which day each task lands on. A task that fits nowhere still gets a day: the first with room, else the last. */
export function spreadPlan(tasks: Candidate[], today: string, opts: SpreadOpts = {}): Placement[] {
  const days = Math.max(1, opts.days ?? 5);
  const budget = opts.budgetMin ?? 180;
  const est = (t: Candidate) => t.estimateMin ?? opts.defaultEstimateMin ?? 30;
  const keys = Array.from({ length: days }, (_, i) => addDaysKey(today, i));
  const cap = (k: string) => opts.weekdayBudget?.[fromKey(k).getDay()] ?? budget;
  const used = keys.map((k) => opts.usedMin?.[k] ?? 0);
  const placed = keys.map(() => 0);
  const out: Placement[] = [];
  for (const t of [...tasks].sort(spreadOrder)) {
    const need = est(t);
    let at = keys.findIndex((k, i) => used[i] + need <= cap(k));
    // nothing has room: the emptiest day of the ones that are still free of spread work, else the last day
    if (at < 0) at = placed.indexOf(0) >= 0 ? placed.indexOf(0) : days - 1;
    used[at] += need;
    placed[at]++;
    out.push({ id: t.id, day: keys[at] });
  }
  return out;
}

/** How many distinct days a plan uses. */
export function spreadDays(plan: Placement[]): number {
  return new Set(plan.map((p) => p.day)).size;
}
