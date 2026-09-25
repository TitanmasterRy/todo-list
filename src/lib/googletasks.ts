// Import from Google Tasks: the Tasks.json in a Google Takeout export (takeout.google.com → Tasks).
// Each list becomes a tag; child tasks become subtasks of their parent; due dates keep the day.
import type { ImportedTask } from './csvimport';

interface GTask {
  id?: string;
  title?: string;
  notes?: string;
  status?: string;
  due?: string;
  parent?: string;
  deleted?: boolean;
  hidden?: boolean;
}
interface GList {
  title?: string;
  items?: GTask[];
}

const tagOf = (listTitle: string) =>
  listTitle
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30);

/** Returns null when the text isn't a Google Tasks export. */
export function importGoogleTasks(text: string): { tasks: ImportedTask[]; lists: string[]; skipped: number } | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  const root = data as { kind?: string; items?: GList[] };
  if (!root || typeof root !== 'object' || !Array.isArray(root.items) || (root.kind && !String(root.kind).startsWith('tasks#'))) return null;
  const tasks: ImportedTask[] = [];
  const lists: string[] = [];
  let skipped = 0;
  for (const list of root.items) {
    const items = Array.isArray(list?.items) ? list.items : [];
    const listTitle = String(list?.title ?? '').trim();
    if (listTitle) lists.push(listTitle);
    const tag = listTitle && !/^my tasks$/i.test(listTitle) ? tagOf(listTitle) : '';
    const children = new Map<string, GTask[]>();
    for (const t of items) if (t?.parent) children.set(t.parent, [...(children.get(t.parent) ?? []), t]);
    for (const t of items) {
      if (!t || t.parent) continue;
      const title = String(t.title ?? '').trim();
      if (!title || t.deleted) {
        skipped++;
        continue;
      }
      const due = typeof t.due === 'string' && /^\d{4}-\d{2}-\d{2}/.test(t.due) ? t.due.slice(0, 10) : undefined; // Google stores the day at midnight UTC
      tasks.push({
        title: title.slice(0, 300),
        notes: typeof t.notes === 'string' && t.notes.trim() ? t.notes.trim().slice(0, 5000) : undefined,
        dueAt: due,
        priority: 'normal',
        tags: tag ? [tag] : [],
        done: t.status === 'completed',
        subtasks: (children.get(t.id ?? '') ?? [])
          .map((c) => String(c.title ?? '').trim())
          .filter(Boolean)
          .slice(0, 50),
      });
    }
  }
  return { tasks, lists, skipped };
}
