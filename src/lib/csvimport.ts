// Import tasks from CSV: this app's own export, Todoist's CSV export, or any spreadsheet with a header row.
import type { Priority, TaskType } from './types';

/** RFC 4180 CSV parser (quotes, escaped quotes, newlines inside quotes). Also handles ; and tab separated files. */
export function parseCSV(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] ?? '';
  const sep = [',', ';', '\t'].map((c) => ({ c, n: firstLine.split(c).length })).sort((a, b) => b.n - a.n)[0].c;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else q = false;
      } else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}

export interface ImportedTask {
  title: string;
  notes?: string;
  dueAt?: string;
  priority: Priority;
  course?: string;
  tags: string[];
  type?: TaskType;
  estimateMin?: number;
  done: boolean;
  subtasks: string[];
}

const COLS: Record<keyof Omit<ImportedTask, 'subtasks'> | 'subtasks', string[]> = {
  title: ['title', 'task', 'name', 'content', 'subject', 'assignment', 'item', 'to do', 'todo'],
  notes: ['notes', 'description', 'details', 'note', 'body'],
  dueAt: ['due', 'due date', 'date', 'deadline', 'due_date', 'duedate', 'due at'],
  priority: ['priority', 'importance'],
  course: ['course', 'class', 'project', 'list', 'section', 'folder', 'category'],
  tags: ['tags', 'labels', 'label', 'tag'],
  type: ['type', 'kind'],
  estimateMin: ['estimate_min', 'estimate', 'duration', 'minutes', 'time'],
  done: ['status', 'done', 'completed', 'complete', 'state'],
  subtasks: ['subtasks', 'checklist', 'steps'],
};

function normDate(v: string): string | undefined {
  const s = v.trim();
  if (!s) return undefined;
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(s);
  if (iso) return iso[4] ? new Date(`${iso[1]}-${iso[2]}-${iso[3]}T${iso[4]}:${iso[5]}:00`).toISOString() : `${iso[1]}-${iso[2]}-${iso[3]}`;
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(s);
  if (us) {
    const y = us[3].length === 2 ? `20${us[3]}` : us[3];
    return `${y}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function normPriority(v: string, todoist: boolean): Priority {
  const s = v.trim().toLowerCase();
  // Todoist's CSV uses 1 (highest) … 4 (none)
  if (todoist && /^[1-4]$/.test(s)) return (['urgent', 'high', 'normal', 'low'] as Priority[])[Number(s) - 1];
  if (/^(p1|urgent|critical|!!!)$/.test(s)) return 'urgent';
  if (/^(p2|high|important|!!)$/.test(s)) return 'high';
  if (/^(p4|low|someday)$/.test(s)) return 'low';
  return 'normal';
}

const TYPES: TaskType[] = ['homework', 'reading', 'exam', 'project', 'quiz', 'other'];

export function importCSV(text: string): { tasks: ImportedTask[]; columns: Record<string, string>; skipped: number } {
  const rows = parseCSV(text);
  if (!rows.length) return { tasks: [], columns: {}, skipped: 0 };
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const todoist = header.includes('content') && header.includes('type') && header.includes('indent');
  const idx: Partial<Record<keyof typeof COLS, number>> = {};
  const columns: Record<string, string> = {};
  for (const [field, names] of Object.entries(COLS) as [keyof typeof COLS, string[]][]) {
    const i = header.findIndex((h) => names.includes(h));
    if (i >= 0) {
      idx[field] = i;
      columns[field] = rows[0][i];
    }
  }
  // no recognizable header: treat the first column as titles and keep the first row
  const body = idx.title === undefined ? rows : rows.slice(1);
  if (idx.title === undefined) idx.title = 0;
  const get = (r: string[], f: keyof typeof COLS) => (idx[f] === undefined ? '' : (r[idx[f]!] ?? '').trim());
  const tasks: ImportedTask[] = [];
  let skipped = 0;
  let last: ImportedTask | undefined;
  for (const r of body) {
    // Todoist: only "task" rows; indent 2+ rows are subtasks of the previous task
    if (todoist) {
      const kind = (r[header.indexOf('type')] ?? '').toLowerCase();
      if (kind !== 'task') {
        skipped++;
        continue;
      }
      const indent = Number(r[header.indexOf('indent')] ?? 1);
      if (indent > 1 && last) {
        last.subtasks.push(get(r, 'title'));
        continue;
      }
    }
    const title = get(r, 'title');
    if (!title) {
      skipped++;
      continue;
    }
    const status = get(r, 'done').toLowerCase();
    const type = get(r, 'type').toLowerCase() as TaskType;
    const est = Number(get(r, 'estimateMin').replace(/[^\d.]/g, ''));
    const t: ImportedTask = {
      title: title.slice(0, 300),
      notes: get(r, 'notes') || undefined,
      dueAt: normDate(get(r, 'dueAt')),
      priority: normPriority(get(r, 'priority'), todoist),
      course: get(r, 'course') || undefined,
      tags: get(r, 'tags')
        .split(/[\s,;@]+/)
        .map((x) => x.replace(/^#/, '').trim())
        .filter(Boolean),
      type: TYPES.includes(type) ? type : undefined,
      estimateMin: est > 0 && est < 10000 ? Math.round(est) : undefined,
      done: /^(done|true|yes|x|1|completed|complete|finished)$/.test(status),
      subtasks: get(r, 'subtasks')
        .split(/;\s*/)
        .map((s) => s.replace(/^\[[ x]\]\s*/i, '').trim())
        .filter(Boolean),
    };
    tasks.push(t);
    last = t;
  }
  return { tasks, columns, skipped };
}
