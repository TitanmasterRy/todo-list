// Kanban board (To do / Doing / Done) for a course.
import type { Task } from './types';
import { addDaysKey, dueKey } from './dates';
import { t } from './i18n/index.svelte';

export type Column = 'todo' | 'doing' | 'done';
// labels follow the app language
const column = (id: Column, emoji: string) => ({
  id,
  emoji,
  get label() {
    return t(`board.${id}`);
  },
});
export const COLUMNS: { id: Column; label: string; emoji: string }[] = [column('todo', '📝'), column('doing', '🚧'), column('done', '✅')];

/** Where a task sits: done when completed, doing when marked (or its timer runs), else to do. */
export function columnOf(t: Task): Column {
  if (t.completedAt) return 'done';
  return t.doing || t.timerStartedAt ? 'doing' : 'todo';
}

const byDue = (a: Task, b: Task) => (a.dueAt ?? '9999').localeCompare(b.dueAt ?? '9999') || a.order - b.order;

/** Tasks split into columns. Done shows the last `doneDays` days of completions, newest first. */
export function boardColumns(tasks: Task[], today: string, doneDays = 14): Record<Column, Task[]> {
  const since = addDaysKey(today, -doneDays);
  const out: Record<Column, Task[]> = { todo: [], doing: [], done: [] };
  for (const t of tasks) {
    if (t.archived) continue;
    const c = columnOf(t);
    if (c === 'done' && dueKey(t.completedAt!) < since) continue;
    out[c].push(t);
  }
  out.todo.sort(byDue);
  out.doing.sort(byDue);
  out.done.sort((a, b) => (a.completedAt! < b.completedAt! ? 1 : -1));
  return out;
}

/** The column to the left/right, for keyboard moves. */
export function neighbor(c: Column, dir: -1 | 1): Column | undefined {
  return COLUMNS[COLUMNS.findIndex((x) => x.id === c) + dir]?.id;
}
