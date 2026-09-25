// Class mode: a teacher publishes one course's assignments as a read-only "class list" (JSON, plus an .ics
// calendar), and students subscribe to its URL. Only title, due date, type, notes and link are published: never
// grades, completion or stats. Everything fetched is untrusted, so parseClassList checks sizes, types and lengths.
// Pure, so it's unit-tested.
import type { Course, Task, TaskType } from './types';
import { TASK_TYPES } from './types';
import { cleanText } from './b64url';
import { dueKey } from './dates';
import { esc, fold, utcStamp } from './ics';
import { diffAssignments, inferType, type ExternalAssignment, type SyncDiff } from './schoology';

export interface ClassItem {
  id: string;
  title: string;
  due?: string; // YYYY-MM-DD or an ISO datetime
  type?: TaskType;
  notes?: string; // markdown (the app renders its own safe subset)
  url?: string; // http(s) only
}

export interface ClassList {
  hwtodoClass: 1;
  id: string; // random, stable per published course
  course: string;
  color?: string;
  emoji?: string;
  teacher?: string;
  updatedAt: string; // ISO
  items: ClassItem[];
}

export const CLASS_LIMITS = { bytes: 512 * 1024, items: 500, title: 200, notes: 5000, url: 2000, course: 60, teacher: 60 } as const;
export const CLASS_FILE = 'homework-todo-class.json';
export const CLASS_ICS_FILE = 'homework-todo-class.ics';
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:?\d{2})?$/;

export class ClassListError extends Error {}

/** The teacher's side: a course's tasks as a class list. `fromDay` keeps only items due that day or later (and undated ones). */
export function buildClassList(course: Course, tasks: Task[], o: { id: string; teacher?: string; includeNotes: boolean; fromDay?: string; now?: Date }): ClassList {
  const items: ClassItem[] = tasks
    .filter((t) => t.courseId === course.id && !t.archived && !t.parentId && t.title.trim())
    .filter((t) => !o.fromDay || !t.dueAt || dueKey(t.dueAt) >= o.fromDay)
    .sort((a, b) => (a.dueAt ?? '￿').localeCompare(b.dueAt ?? '￿') || a.order - b.order)
    .slice(0, CLASS_LIMITS.items)
    .map((t) => {
      const title = cleanText(t.title, CLASS_LIMITS.title);
      const item: ClassItem = { id: t.id.slice(0, 64).replace(/[^A-Za-z0-9_-]/g, '_'), title };
      if (t.dueAt) item.due = t.dueAt;
      item.type = t.type ?? inferType(title);
      const notes = o.includeNotes ? cleanText(t.notes, CLASS_LIMITS.notes, true) : '';
      if (notes) item.notes = notes;
      if (t.url && safeUrl(t.url)) item.url = t.url;
      return item;
    });
  const list: ClassList = { hwtodoClass: 1, id: o.id, course: cleanText(course.name, CLASS_LIMITS.course) || 'Class', updatedAt: (o.now ?? new Date()).toISOString(), items };
  if (/^#[0-9a-f]{6}$/i.test(course.color)) list.color = course.color;
  if (course.emoji) list.emoji = cleanText(course.emoji, 8);
  const teacher = cleanText(o.teacher, CLASS_LIMITS.teacher);
  if (teacher) list.teacher = teacher;
  return list;
}

export function serializeClassList(list: ClassList): string {
  return JSON.stringify(list, null, 2) + '\n';
}

function safeUrl(v: unknown): string | undefined {
  if (typeof v !== 'string' || v.length > CLASS_LIMITS.url) return undefined;
  try {
    const u = new URL(v.trim());
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : undefined;
  } catch {
    return undefined;
  }
}

function safeDue(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.trim();
  if (DATE_RE.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return y >= 2000 && y <= 2100 && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? s : undefined;
  }
  if (!DATETIME_RE.test(s)) return undefined;
  const t = Date.parse(s);
  if (!Number.isFinite(t)) return undefined;
  const y = new Date(t).getUTCFullYear();
  return y >= 2000 && y <= 2100 ? new Date(t).toISOString() : undefined;
}

/** Parse and validate a class list from untrusted text. Invalid items are skipped (and counted); a bad file throws. */
export function parseClassList(text: string): { list: ClassList; skipped: number } {
  if (typeof text !== 'string' || !text.trim()) throw new ClassListError('The class list is empty.');
  if (text.length > CLASS_LIMITS.bytes) throw new ClassListError('The class list is too big (over 512 kB).');
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ClassListError(/^\s*</.test(text) ? 'That link opened a web page, not a class list. Use the raw file link.' : 'That is not a class list (not JSON).');
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new ClassListError('That is not a class list.');
  const j = raw as Record<string, unknown>;
  if (j.hwtodoClass !== 1)
    throw new ClassListError(typeof j.hwtodoClass === 'number' ? 'This class list is from a newer version of the app. Update the app first.' : 'That is not a class list.');
  if (typeof j.id !== 'string' || !ID_RE.test(j.id)) throw new ClassListError('The class list has no valid id.');
  const course = cleanText(j.course, CLASS_LIMITS.course);
  if (!course) throw new ClassListError('The class list has no course name.');
  if (!Array.isArray(j.items)) throw new ClassListError('The class list has no assignments.');
  if (j.items.length > CLASS_LIMITS.items) throw new ClassListError(`The class list has more than ${CLASS_LIMITS.items} assignments.`);
  const seen = new Set<string>();
  const items: ClassItem[] = [];
  let skipped = 0;
  for (const it of j.items as unknown[]) {
    const o = it && typeof it === 'object' && !Array.isArray(it) ? (it as Record<string, unknown>) : null;
    const id = typeof o?.id === 'string' && ID_RE.test(o.id) ? o.id : '';
    const title = cleanText(o?.title, CLASS_LIMITS.title);
    if (!o || !id || !title || seen.has(id)) {
      skipped++;
      continue;
    }
    seen.add(id);
    const item: ClassItem = { id, title };
    const due = safeDue(o.due);
    if (due) item.due = due;
    item.type = TASK_TYPES.includes(o.type as TaskType) ? (o.type as TaskType) : inferType(title);
    const notes = cleanText(o.notes, CLASS_LIMITS.notes, true);
    if (notes) item.notes = notes;
    const url = safeUrl(o.url);
    if (url) item.url = url;
    items.push(item);
  }
  const updatedAt = typeof j.updatedAt === 'string' && Number.isFinite(Date.parse(j.updatedAt)) ? new Date(Date.parse(j.updatedAt)).toISOString() : new Date(0).toISOString();
  const list: ClassList = { hwtodoClass: 1, id: j.id, course, updatedAt, items };
  if (typeof j.color === 'string' && /^#[0-9a-f]{6}$/i.test(j.color)) list.color = j.color;
  const emoji = cleanText(j.emoji, 8);
  if (emoji) list.emoji = emoji;
  const teacher = cleanText(j.teacher, CLASS_LIMITS.teacher);
  if (teacher) list.teacher = teacher;
  return { list, skipped };
}

export function classExternalId(listId: string, itemId: string): string {
  return `class:${listId}:${itemId}`;
}

/** Class items as external assignments, so they go through the same diff and task creation as Schoology. */
export function classToAssignments(list: ClassList): ExternalAssignment[] {
  return list.items.map((it) => {
    const a: ExternalAssignment = { externalId: classExternalId(list.id, it.id), title: it.title, courseName: list.course, kind: 'assignment', type: it.type };
    if (it.due) a.dueAt = it.due;
    const notes = [it.notes, it.url && !(it.notes ?? '').includes(it.url) ? it.url : ''].filter(Boolean).join('\n\n');
    if (notes) a.notes = notes;
    if (it.url) a.url = it.url;
    return a;
  });
}

/** What a refresh changes: new items, changed titles/due dates (same rules as Schoology), and open items no longer listed. */
export function diffClass(
  existing: { externalId: string; title: string; dueAt?: string; notes?: string; completedAt?: string }[],
  list: ClassList,
  ignored: string[],
): { diff: SyncDiff; removed: string[] } {
  const prefix = classExternalId(list.id, '');
  const mine = existing.filter((e) => e.externalId.startsWith(prefix));
  const incoming = classToAssignments(list);
  const ids = new Set(incoming.map((a) => a.externalId));
  return { diff: diffAssignments(mine, incoming, ignored), removed: mine.filter((e) => !e.completedAt && !ids.has(e.externalId)).map((e) => e.externalId) };
}

/** An .ics calendar of the class list (students can subscribe to it in any calendar app). */
export function buildClassICS(list: ClassList, now: Date = new Date()): string {
  const addDay = (key: string) => {
    const [y, m, d] = key.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + 1));
    return dt.toISOString().slice(0, 10).replace(/-/g, '');
  };
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Homework To-Do//Class list//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${esc(list.course)}`];
  const stamp = utcStamp(now);
  for (const it of list.items) {
    if (!it.due) continue;
    lines.push('BEGIN:VEVENT', `UID:${it.id}.${list.id}@homework-todo-class`, `DTSTAMP:${stamp}`);
    if (DATE_RE.test(it.due)) lines.push(`DTSTART;VALUE=DATE:${it.due.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${addDay(it.due)}`);
    else {
      const d = new Date(it.due);
      lines.push(`DTSTART:${utcStamp(d)}`, `DTEND:${utcStamp(new Date(d.getTime() + 30 * 60_000))}`);
    }
    lines.push(`SUMMARY:${esc(`[${list.course}] ${it.title}`)}`);
    const desc = [it.type ? `Type: ${it.type}` : '', it.notes ?? '', it.url ?? ''].filter(Boolean).join('\n');
    if (desc) lines.push(`DESCRIPTION:${esc(desc)}`);
    if (it.url) lines.push(`URL:${it.url}`);
    lines.push(`CATEGORIES:${esc(list.course)}`, 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

/**
 * The URL to fetch for what a student pasted: an app link (`#class=<url>`), a gist page (→ its raw class file),
 * or a raw https URL. Null for anything else (http is allowed only for localhost).
 */
export function classSourceUrl(input: string): string | null {
  let s = input.trim();
  const m = /[#?&]class=([^&#\s]+)/.exec(s);
  if (m) {
    try {
      s = decodeURIComponent(m[1]);
    } catch {
      return null;
    }
  }
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (u.username || u.password) return null;
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && /^(localhost|127\.0\.0\.1)$/.test(u.hostname))) return null;
  const gist = /^\/([A-Za-z0-9-]+)\/([0-9a-f]{20,40})\/?$/i.exec(u.pathname);
  if (u.hostname === 'gist.github.com' && gist) return gistRawUrl(gist[1], gist[2], CLASS_FILE);
  return u.href;
}

/** The raw URL of a gist file without the revision, so it always serves the latest version. */
export function gistRawUrl(login: string, gistId: string, file: string): string {
  return `https://gist.githubusercontent.com/${encodeURIComponent(login)}/${encodeURIComponent(gistId)}/raw/${encodeURIComponent(file)}`;
}

/** The app link a teacher hands out: opens Class mode with the list's URL filled in. */
export function classLink(url: string, base: string): string {
  return `${base.replace(/#.*$/, '')}#class=${encodeURIComponent(url)}`;
}
