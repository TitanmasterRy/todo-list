import type { ExportBundle, Task, Course, Template, Stats, DayNote } from './types';
import { DEFAULT_STATS } from './types';

export function buildBundle(data: { tasks: Task[]; courses: Course[]; templates: Template[]; stats: Stats; dayNotes: DayNote[] }): ExportBundle {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    tasks: data.tasks,
    courses: data.courses,
    templates: data.templates,
    stats: data.stats,
    dayNotes: data.dayNotes,
  };
}

export function downloadJSON(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function backupFilename(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `homework-todo-backup-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.json`;
}

/** Validate and normalize an imported bundle. Throws with a readable message on bad input. */
export function parseBundle(raw: unknown): ExportBundle {
  if (!raw || typeof raw !== 'object') throw new Error('Not a JSON object');
  const b = raw as Partial<ExportBundle>;
  if (!Array.isArray(b.tasks) || !Array.isArray(b.courses)) throw new Error('Missing tasks or courses');
  const tasks: Task[] = b.tasks.map((t) => normalizeTask(t as Partial<Task>));
  const courses: Course[] = b.courses
    .filter((c): c is Course => !!c && typeof (c as Course).id === 'string' && typeof (c as Course).name === 'string')
    .map((c) => ({ id: c.id, name: c.name, color: c.color ?? '#6c5ce7', emoji: c.emoji, archived: !!c.archived }));
  const templates: Template[] = Array.isArray(b.templates) ? (b.templates as Template[]).filter((t) => t && t.id && t.name && t.task) : [];
  const stats: Stats = { ...structuredClone(DEFAULT_STATS), ...((b.stats as Partial<Stats>) ?? {}) };
  const dayNotes: DayNote[] = Array.isArray(b.dayNotes) ? (b.dayNotes as DayNote[]).filter((n) => n && n.date) : [];
  return { version: 1, exportedAt: b.exportedAt ?? new Date().toISOString(), tasks, courses, templates, stats, dayNotes, settings: b.settings };
}

export function normalizeTask(t: Partial<Task>): Task {
  if (!t || typeof t.id !== 'string' || typeof t.title !== 'string') throw new Error('Task missing id or title');
  const now = new Date().toISOString();
  return {
    id: t.id,
    title: t.title,
    notes: t.notes,
    courseId: t.courseId,
    tags: Array.isArray(t.tags) ? t.tags.map(String) : [],
    priority: t.priority ?? 'normal',
    dueAt: t.dueAt,
    estimateMin: t.estimateMin,
    type: t.type,
    weight: t.weight,
    score: t.score,
    subtasks: Array.isArray(t.subtasks) ? t.subtasks.map((s, i) => ({ id: s.id ?? `${t.id}_s${i}`, title: String(s.title ?? ''), done: !!s.done })) : [],
    recurrence: t.recurrence,
    createdAt: t.createdAt ?? now,
    completedAt: t.completedAt,
    updatedAt: t.updatedAt ?? t.createdAt ?? now,
    order: typeof t.order === 'number' ? t.order : 0,
    deferredCount: typeof t.deferredCount === 'number' ? t.deferredCount : 0,
    pinnedDay: t.pinnedDay,
    frog: t.frog,
    frogDate: t.frogDate,
    archived: t.archived,
    templateId: t.templateId,
  };
}

/** Merge two datasets, last-write-wins per task by updatedAt. Returns merged data and ids whose timestamps clashed within the same second. */
export function mergeBundles(local: ExportBundle, remote: ExportBundle): { merged: ExportBundle; conflicts: string[] } {
  const conflicts: string[] = [];
  const tasks = new Map<string, Task>();
  for (const t of local.tasks) tasks.set(t.id, t);
  for (const r of remote.tasks) {
    const l = tasks.get(r.id);
    if (!l) {
      tasks.set(r.id, r);
      continue;
    }
    if (l.updatedAt === r.updatedAt) continue;
    const ls = Math.floor(new Date(l.updatedAt).getTime() / 1000);
    const rs = Math.floor(new Date(r.updatedAt).getTime() / 1000);
    if (ls === rs && JSON.stringify(l) !== JSON.stringify(r)) conflicts.push(r.id);
    if (r.updatedAt > l.updatedAt) tasks.set(r.id, r);
  }
  const courses = new Map<string, Course>();
  for (const c of [...remote.courses, ...local.courses]) courses.set(c.id, c); // local wins for courses
  const templates = new Map<string, Template>();
  for (const t of [...remote.templates, ...local.templates]) templates.set(t.id, t);
  const notes = new Map<string, DayNote>();
  for (const n of [...remote.dayNotes, ...local.dayNotes]) notes.set(n.date, n);
  // stats: take the one with more XP (completions are monotonic), merge completion days by max
  const stats: Stats = local.stats.xp >= remote.stats.xp ? structuredClone(local.stats) : structuredClone(remote.stats);
  const days = { ...remote.stats.completionsByDay };
  for (const [k, v] of Object.entries(local.stats.completionsByDay)) days[k] = Math.max(days[k] ?? 0, v);
  stats.completionsByDay = days;
  stats.badges = Array.from(new Set([...local.stats.badges, ...remote.stats.badges]));
  return {
    merged: {
      version: 1,
      exportedAt: new Date().toISOString(),
      tasks: [...tasks.values()],
      courses: [...courses.values()],
      templates: [...templates.values()],
      stats,
      dayNotes: [...notes.values()],
    },
    conflicts,
  };
}
