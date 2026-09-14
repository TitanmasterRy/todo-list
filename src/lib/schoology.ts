// Map events from a Schoology personal iCal feed to assignments, and compute
// what needs creating/updating against the tasks we already have.
import type { TaskType } from './types';
import type { ParsedEvent } from './ics-parse';

export interface ExternalAssignment {
  externalId: string; // stable id: 'assignment:123456' from the URL, else UID
  title: string; // cleaned title without the course suffix/prefix
  courseName?: string;
  dueAt?: string; // 'YYYY-MM-DD' or ISO
  notes?: string; // cleaned description + URL on its own line
  url?: string;
  type?: TaskType;
  updatedAt?: string;
  kind: 'assignment' | 'event';
}

export interface SyncDiff {
  create: ExternalAssignment[];
  update: { externalId: string; patch: { title?: string; dueAt?: string; notes?: string; url?: string } }[];
  unchanged: number;
}

const MAX_NOTES = 2000;

export function isSchoologyFeedUrl(s: string): boolean {
  const t = s.trim();
  let u: URL;
  try {
    u = new URL(t);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:' && u.protocol !== 'webcal:') return false;
  const host = u.hostname.toLowerCase();
  if (!(host === 'schoology.com' || host.endsWith('.schoology.com'))) return false;
  const path = u.pathname.toLowerCase();
  return /\/calendar\/feed\/ical\//.test(path) || /ical/.test(path) || path.endsWith('.ics');
}

export function inferType(title: string): TaskType {
  const t = title.toLowerCase();
  if (/\bquiz(zes)?\b/.test(t)) return 'quiz';
  if (/\b(test|tests|exam|exams|midterm|midterms)\b/.test(t)) return 'exam';
  // "final" alone means an exam, but "final draft" / "final paper" are written work
  if (/\b(final|finals)\b/.test(t) && !/\bfinal\s+(draft|drafts|version|copy|submission|revision|reflection|portfolio|paper|essay|project|presentation)\b/.test(t)) return 'exam';
  if (/\b(read|reading|readings|chapter|chapters|ch\.?|pages|pp\.?)\b/.test(t)) return 'reading';
  if (/\b(project|projects|presentation|presentations|essay|essays|paper|papers|draft|drafts)\b/.test(t)) return 'project';
  return 'homework';
}

/** Lowercase, strip punctuation, collapse whitespace. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/\./g, '') // "U.S. History" -> "us history"
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function matchCourseName(name: string | undefined, courses: { id: string; name: string }[]): string | undefined {
  if (!name) return undefined;
  const n = norm(name);
  if (!n) return undefined;
  const normed = courses.map((c) => ({ id: c.id, n: norm(c.name) })).filter((c) => c.n);
  const exact = normed.filter((c) => c.n === n);
  if (exact.length === 1) return exact[0].id;
  if (exact.length > 1) return undefined;
  const prefix = normed.filter((c) => c.n.startsWith(n) || n.startsWith(c.n));
  if (prefix.length === 1) return prefix[0].id;
  if (prefix.length > 1) return undefined;
  const contains = normed.filter((c) => c.n.includes(n) || n.includes(c.n));
  if (contains.length === 1) return contains[0].id;
  return undefined;
}

/** Extract a stable numeric id and kind from a Schoology URL or UID. */
function identify(ev: ParsedEvent): { externalId: string; kind: 'assignment' | 'event' } {
  const url = ev.url ?? '';
  const m = /\/(assignment|assessment|event|discussion|assignments|events)\/(\d+)/i.exec(url);
  if (m) {
    const k = m[1].toLowerCase().replace(/s$/, '');
    const kind: 'assignment' | 'event' = k === 'event' ? 'event' : 'assignment';
    return { externalId: `${k}:${m[2]}`, kind };
  }
  const uid = ev.uid;
  const um = /^(?:(assignment|event|assessment|discussion)[-_:])?(\d+)(?:@|$)/i.exec(uid);
  if (um) {
    const k = um[1]?.toLowerCase() ?? 'assignment';
    return { externalId: `${k}:${um[2]}`, kind: k === 'event' ? 'event' : 'assignment' };
  }
  return { externalId: uid, kind: 'assignment' };
}

/** Split "Title (Course)" or "Course: Title" into parts. */
export function splitTitle(summary: string): { title: string; courseName?: string } {
  let s = summary.trim();
  // Title (Course Name) — only treat a trailing parenthetical as a course if it looks like one (not a page range, etc.)
  const paren = /^(.*\S)\s*\(([^()]{2,80})\)\s*$/.exec(s);
  if (paren && !/^\d+[\d\s\-–,.]*$/.test(paren[2]) && !/^(due|late|optional|extra credit|draft)\b/i.test(paren[2])) {
    return { title: paren[1].trim(), courseName: paren[2].trim() };
  }
  // Course Name: Title (avoid "Chapter 3: Title" style headings and times like "3:00")
  const colon = /^([^:]{2,60}?)\s*:\s+(.+)$/.exec(s);
  if (colon && !/^(chapter|ch|unit|week|lesson|part|section|day|module|hw|homework|quiz|test|exam|lab|reading|due|project)\b/i.test(colon[1]) && !/\d$/.test(colon[1])) {
    return { title: colon[2].trim(), courseName: colon[1].trim() };
  }
  return { title: s };
}

function courseFromDescription(desc: string | undefined): { courseName?: string; rest?: string } {
  if (!desc) return {};
  const lines = desc.split('\n');
  let courseName: string | undefined;
  const kept: string[] = [];
  for (const line of lines) {
    const m = /^\s*(?:course|class|section)\s*:\s*(.+?)\s*$/i.exec(line);
    if (m && !courseName) courseName = m[1];
    else kept.push(line);
  }
  return { courseName, rest: kept.join('\n').replace(/\n{3,}/g, '\n\n').trim() };
}

function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + '…';
}

export function eventToAssignment(ev: ParsedEvent): ExternalAssignment {
  const { externalId, kind: idKind } = identify(ev);
  const split = splitTitle(ev.summary || '(untitled)');
  const fromDesc = courseFromDescription(ev.description);
  const courseName = split.courseName ?? fromDesc.courseName ?? ev.categories?.[0];
  const title = split.title || ev.summary || '(untitled)';
  const dueAt = ev.start;
  const kind: 'assignment' | 'event' = idKind === 'event' || !dueAt ? 'event' : 'assignment';
  let notes: string | undefined;
  const body = (fromDesc.rest ?? '').trim();
  const parts: string[] = [];
  if (body) parts.push(clip(body, MAX_NOTES));
  if (ev.url && !body.includes(ev.url)) parts.push(ev.url);
  if (parts.length) notes = parts.join('\n\n');
  const out: ExternalAssignment = { externalId, title, kind, type: inferType(title) };
  if (courseName) out.courseName = courseName;
  if (dueAt) out.dueAt = dueAt;
  if (notes) out.notes = notes;
  if (ev.url) out.url = ev.url;
  if (ev.lastModified) out.updatedAt = ev.lastModified;
  return out;
}

export function eventsToAssignments(events: ParsedEvent[], opts: { includeEvents?: boolean } = {}): ExternalAssignment[] {
  const out: ExternalAssignment[] = [];
  const seen = new Set<string>();
  for (const ev of events) {
    if (ev.status === 'CANCELLED') continue;
    const a = eventToAssignment(ev);
    if (a.kind === 'event' && !opts.includeEvents) continue;
    if (seen.has(a.externalId)) {
      const i = out.findIndex((x) => x.externalId === a.externalId);
      if (i >= 0) out[i] = a;
      continue;
    }
    seen.add(a.externalId);
    out.push(a);
  }
  return out;
}

export function diffAssignments(
  existing: { externalId: string; title: string; dueAt?: string; notes?: string; completedAt?: string }[],
  incoming: ExternalAssignment[],
  ignoredIds: string[],
): SyncDiff {
  const ignored = new Set(ignoredIds);
  const byId = new Map(existing.map((e) => [e.externalId, e]));
  const diff: SyncDiff = { create: [], update: [], unchanged: 0 };
  for (const a of incoming) {
    const cur = byId.get(a.externalId);
    if (!cur) {
      if (!ignored.has(a.externalId)) diff.create.push(a);
      continue;
    }
    if (cur.completedAt) {
      diff.unchanged++;
      continue;
    }
    const patch: SyncDiff['update'][number]['patch'] = {};
    if (a.title && a.title !== cur.title) patch.title = a.title;
    if (a.dueAt && a.dueAt !== cur.dueAt) patch.dueAt = a.dueAt;
    if (a.notes && !(cur.notes ?? '').trim()) patch.notes = a.notes;
    if (Object.keys(patch).length) diff.update.push({ externalId: a.externalId, patch });
    else diff.unchanged++;
  }
  return diff;
}
