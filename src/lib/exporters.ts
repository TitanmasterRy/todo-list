// Plain-text exports: CSV (spreadsheets, other to-do apps) and Markdown (notes apps, printing).
import type { Course, Task } from './types';

export function csvCell(v: unknown): string {
  const s = v === undefined || v === null ? '' : String(v);
  // quote when needed; neutralize spreadsheet formulas (=, +, -, @ at the start)
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export const CSV_COLUMNS = [
  'title',
  'status',
  'due',
  'course',
  'priority',
  'type',
  'estimate_min',
  'tags',
  'weight',
  'score',
  'subtasks',
  'notes',
  'completed_at',
  'created_at',
  'id',
];

export function tasksToCSV(tasks: Task[], courses: Course[]): string {
  const name = new Map(courses.map((c) => [c.id, c.name]));
  const rows = tasks.map((t) =>
    [
      t.title,
      t.completedAt ? 'done' : 'open',
      t.dueAt ?? '',
      name.get(t.courseId ?? '') ?? '',
      t.priority,
      t.type ?? '',
      t.estimateMin ?? '',
      t.tags.join(' '),
      t.weight ?? '',
      t.score ?? '',
      t.subtasks.map((s) => `${s.done ? '[x]' : '[ ]'} ${s.title}`).join('; '),
      t.notes ?? '',
      t.completedAt ?? '',
      t.createdAt,
      t.id,
    ]
      .map(csvCell)
      .join(','),
  );
  return [CSV_COLUMNS.join(','), ...rows].join('\r\n') + '\r\n';
}

/** Markdown checklist grouped by course, open tasks first (by due date), then done. */
export function tasksToMarkdown(tasks: Task[], courses: Course[], title = 'Homework To-Do'): string {
  const byCourse = new Map<string, Task[]>();
  for (const t of tasks) {
    const k = t.courseId && courses.some((c) => c.id === t.courseId) ? t.courseId : '';
    byCourse.set(k, [...(byCourse.get(k) ?? []), t]);
  }
  const order = [...courses.filter((c) => byCourse.has(c.id)).map((c) => c.id), ...(byCourse.has('') ? [''] : [])];
  const lines = [`# ${title}`, '', `_Exported ${new Date().toLocaleString()}_`, ''];
  for (const id of order) {
    const c = courses.find((x) => x.id === id);
    lines.push(`## ${c ? `${c.emoji ? c.emoji + ' ' : ''}${c.name}` : 'No course'}`, '');
    const list = byCourse
      .get(id)!
      .slice()
      .sort((a, b) => Number(!!a.completedAt) - Number(!!b.completedAt) || (a.dueAt ?? '9').localeCompare(b.dueAt ?? '9'));
    for (const t of list) {
      const bits = [
        t.dueAt ? `due ${t.dueAt.slice(0, 10)}` : '',
        t.priority !== 'normal' ? t.priority : '',
        t.estimateMin ? `~${t.estimateMin}m` : '',
        ...t.tags.map((g) => `#${g}`),
      ].filter(Boolean);
      lines.push(`- [${t.completedAt ? 'x' : ' '}] ${t.title}${bits.length ? ` (${bits.join(', ')})` : ''}`);
      for (const s of t.subtasks) lines.push(`  - [${s.done ? 'x' : ' '}] ${s.title}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}
