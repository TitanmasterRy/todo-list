// Task filters shared by the Inbox and saved lists ("smart lists").
import { addDaysKey, dueKey } from './dates';
import type { Priority, Task, TaskType } from './types';
import { isBlocked } from './deps';

export type FilterStatus = 'open' | 'done' | 'all';
export type FilterSort = 'due' | 'manual' | 'priority' | 'created';

export interface TaskFilter {
  status: FilterStatus;
  courseId: string; // '' any, 'none' no course
  tag: string;
  type: '' | TaskType;
  from: string; // YYYY-MM-DD (fixed range)
  to: string;
  withinDays?: number; // relative: due from today through today + N (saved lists stay current)
  overdue?: boolean;
  priorities?: Priority[];
  blocked?: '' | 'hide' | 'only';
  q: string;
  sort: FilterSort;
}

export const EMPTY_FILTER: TaskFilter = { status: 'open', courseId: '', tag: '', type: '', from: '', to: '', q: '', sort: 'due' };

const PRIO_RANK: Record<Priority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

export function isFiltered(f: TaskFilter): boolean {
  return !!(f.courseId || f.tag || f.type || f.from || f.to || f.q || f.status !== 'open' || f.withinDays !== undefined || f.overdue || f.priorities?.length || f.blocked);
}

export function applyFilter(tasks: Task[], f: TaskFilter, ctx: { today: string; courseName: (id?: string) => string; lingering?: Set<string>; byId?: Map<string, Task> }): Task[] {
  const live = (t: Task) => !t.completedAt || !!ctx.lingering?.has(t.id);
  const byId = ctx.byId ?? new Map(tasks.map((t) => [t.id, t]));
  let list = tasks.filter((t) => !t.archived);
  if (f.status === 'open') list = list.filter(live);
  else if (f.status === 'done') list = list.filter((t) => t.completedAt);
  if (f.courseId === 'none') list = list.filter((t) => !t.courseId);
  else if (f.courseId) list = list.filter((t) => t.courseId === f.courseId);
  if (f.tag) list = list.filter((t) => t.tags.includes(f.tag));
  if (f.type) list = list.filter((t) => t.type === f.type);
  if (f.from) list = list.filter((t) => t.dueAt && dueKey(t.dueAt) >= f.from);
  if (f.to) list = list.filter((t) => t.dueAt && dueKey(t.dueAt) <= f.to);
  if (f.withinDays !== undefined) {
    const end = addDaysKey(ctx.today, f.withinDays);
    list = list.filter((t) => t.dueAt && dueKey(t.dueAt) >= ctx.today && dueKey(t.dueAt) <= end);
  }
  if (f.overdue) list = list.filter((t) => !t.completedAt && t.dueAt && dueKey(t.dueAt) < ctx.today);
  if (f.priorities?.length) list = list.filter((t) => f.priorities!.includes(t.priority));
  if (f.blocked === 'hide') list = list.filter((t) => !isBlocked(t, byId));
  else if (f.blocked === 'only') list = list.filter((t) => isBlocked(t, byId));
  const q = f.q.trim().toLowerCase();
  if (q) {
    list = list.filter((t) => {
      const hay = `${t.title} ${t.notes ?? ''} ${t.tags.map((x) => '#' + x).join(' ')} ${ctx.courseName(t.courseId)} ${t.subtasks.map((s) => s.title).join(' ')}`.toLowerCase();
      return q.split(/\s+/).every((w) => hay.includes(w));
    });
  }
  const byDue = (a: Task, b: Task) => (a.dueAt ?? '').localeCompare(b.dueAt ?? '') || a.order - b.order;
  switch (f.sort) {
    case 'manual':
      return list.sort((a, b) => a.order - b.order);
    case 'priority':
      return list.sort((a, b) => PRIO_RANK[a.priority] - PRIO_RANK[b.priority] || byDue(a, b));
    case 'created':
      return list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    default:
      return list.sort((a, b) => (!!a.dueAt !== !!b.dueAt ? (a.dueAt ? -1 : 1) : byDue(a, b)));
  }
}

export interface SavedList {
  id: string;
  name: string;
  emoji: string;
  filter: TaskFilter;
}

/** Built-in suggestions offered when creating a saved list. */
export const LIST_PRESETS: { name: string; emoji: string; filter: Partial<TaskFilter> }[] = [
  { name: 'Exams in the next 14 days', emoji: '📝', filter: { type: 'exam', withinDays: 14 } },
  { name: 'Due this week', emoji: '📅', filter: { withinDays: 7 } },
  { name: 'Overdue', emoji: '⏰', filter: { overdue: true } },
  { name: 'High priority', emoji: '❗', filter: { priorities: ['urgent', 'high'] } },
  { name: 'Ready to start', emoji: '🟢', filter: { blocked: 'hide', withinDays: 30 } },
  { name: 'Readings', emoji: '📖', filter: { type: 'reading' } },
];
