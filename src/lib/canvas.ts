// Canvas LMS calendar feed (Calendar → Calendar Feed in Canvas): an iCal feed of assignments and events.
// Summaries look like "Essay 1 [ENGL 101 - Fall 2026]"; ids come from the assignment URL or the UID.
import type { ParsedEvent } from './ics-parse';
import { inferType, type ExternalAssignment } from './schoology';

export function isCanvasFeedUrl(s: string): boolean {
  let u: URL;
  try {
    u = new URL(s.trim().replace(/^webcal:\/\//i, 'https://'));
  } catch {
    return false;
  }
  return (u.protocol === 'https:' || u.protocol === 'http:') && /^\/feeds\/calendars\/[\w.-]+\.ics$/i.test(u.pathname);
}

/** "Essay 1 [ENGL 101 - Fall 2026]" → title + course. */
export function splitCanvasTitle(summary: string): { title: string; courseName?: string } {
  const m = /^(.*\S)\s*\[([^[\]]{2,120})\]\s*$/.exec(summary.trim());
  return m ? { title: m[1].trim(), courseName: m[2].trim() } : { title: summary.trim() };
}

function identify(ev: ParsedEvent): { externalId: string; kind: 'assignment' | 'event' } {
  const url = ev.url ?? '';
  const m = /\/(assignments|quizzes|discussion_topics)\/(\d+)/.exec(url) ?? /#assignment_(\d+)/.exec(url);
  if (m) return { externalId: `canvas:assignment:${m[2] ?? m[1]}`, kind: 'assignment' };
  const u = /event-assignment-(?:override-)?(\d+)/.exec(ev.uid);
  if (u) return { externalId: `canvas:assignment:${u[1]}`, kind: 'assignment' };
  const e = /event-calendar-event-(\d+)/.exec(ev.uid) ?? /calendar_events\/(\d+)/.exec(url);
  if (e) return { externalId: `canvas:event:${e[1]}`, kind: 'event' };
  return { externalId: `canvas:${ev.uid}`, kind: 'event' };
}

export function canvasEventToAssignment(ev: ParsedEvent): ExternalAssignment {
  const { externalId, kind } = identify(ev);
  const { title, courseName } = splitCanvasTitle(ev.summary || '(untitled)');
  const out: ExternalAssignment = { externalId, title: title.slice(0, 200), kind, type: inferType(title) };
  if (courseName) out.courseName = courseName;
  if (ev.start) out.dueAt = ev.start;
  const body = (ev.description ?? '').trim();
  const parts = [body.length > 2000 ? body.slice(0, 1999) + '…' : body, ev.url && !body.includes(ev.url) ? ev.url : ''].filter(Boolean);
  if (parts.length) out.notes = parts.join('\n\n');
  if (ev.url) out.url = ev.url;
  if (ev.lastModified) out.updatedAt = ev.lastModified;
  return out;
}

/** Assignments from a Canvas feed (calendar events like "Field trip" too, when asked). */
export function canvasAssignments(events: ParsedEvent[], opts: { includeEvents?: boolean } = {}): ExternalAssignment[] {
  const seen = new Set<string>();
  const out: ExternalAssignment[] = [];
  for (const ev of events) {
    const a = canvasEventToAssignment(ev);
    if (a.kind === 'event' && !opts.includeEvents) continue;
    if (seen.has(a.externalId)) continue;
    seen.add(a.externalId);
    out.push(a);
  }
  return out;
}
