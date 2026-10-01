// Priority matrix (Eisenhower): every open task sorted into one of four boxes by how soon it's due and how much it
// counts. Students don't delegate, so the "urgent, not important" box is "quick wins" and the last one is "later".
import type { Task } from './types';
import { diffDays, dueKey } from './dates';

export type Quadrant = 'do' | 'plan' | 'quick' | 'later';
export const QUADRANTS: Quadrant[] = ['do', 'plan', 'quick', 'later'];

export interface MatrixOpts {
  urgentDays?: number; // due within this many days counts as urgent (default 2)
}

type Candidate = Pick<Task, 'priority' | 'dueAt' | 'type' | 'weight' | 'frog' | 'frogDate' | 'pinnedDay' | 'estimateMin'>;

/** Important: a high priority, graded work (exams, quizzes, projects), or anything worth 10% or more. */
export function isImportant(t: Candidate): boolean {
  if (t.priority === 'high' || t.priority === 'urgent') return true;
  if (t.type === 'exam' || t.type === 'quiz' || t.type === 'project') return true;
  return (t.weight ?? 0) >= 10;
}

/** Urgent: overdue or due within a couple of days, today's frog, or pinned into today. */
export function isUrgent(t: Candidate, today: string, urgentDays = 2): boolean {
  if (t.frog && t.frogDate === today) return true;
  if (t.pinnedDay === today) return true;
  if (!t.dueAt) return false;
  return diffDays(today, dueKey(t.dueAt)) <= urgentDays;
}

export function classify(t: Candidate, today: string, opts: MatrixOpts = {}): Quadrant {
  const urgent = isUrgent(t, today, opts.urgentDays);
  const important = isImportant(t);
  if (urgent && important) return 'do';
  if (important) return 'plan';
  if (urgent) return 'quick';
  return 'later';
}

/** Inside a box: soonest due first, undated last, then by priority. */
const RANK = { urgent: 3, high: 2, normal: 1, low: 0 } as const;
export function matrixOrder<T extends Candidate>(a: T, b: T): number {
  const da = a.dueAt ? dueKey(a.dueAt) : '9999';
  const db = b.dueAt ? dueKey(b.dueAt) : '9999';
  if (da !== db) return da.localeCompare(db);
  return RANK[b.priority] - RANK[a.priority];
}

export function buildMatrix<T extends Candidate>(tasks: T[], today: string, opts: MatrixOpts = {}): Record<Quadrant, T[]> {
  const out: Record<Quadrant, T[]> = { do: [], plan: [], quick: [], later: [] };
  for (const t of tasks) out[classify(t, today, opts)].push(t);
  for (const q of QUADRANTS) out[q].sort(matrixOrder);
  return out;
}

/** Minutes of estimated work in a box (tasks without an estimate count as 30). */
export function quadrantMinutes(tasks: Candidate[]): number {
  return tasks.reduce((a, t) => a + (t.estimateMin ?? 30), 0);
}
