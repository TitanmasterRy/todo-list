// Build an iCalendar file from dated tasks so due dates can be imported into Google/Apple/Outlook calendars.
import type { Course, Task } from './types';
import { isDateOnly, addDaysKey } from './dates';

function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

function fold(line: string): string {
  // RFC 5545: lines longer than 75 octets are folded with CRLF + space.
  const out: string[] = [];
  let cur = '';
  let bytes = 0;
  for (const ch of line) {
    const b = new TextEncoder().encode(ch).length;
    if (bytes + b > 74) {
      out.push(cur);
      cur = ' ';
      bytes = 1;
    }
    cur += ch;
    bytes += b;
  }
  out.push(cur);
  return out.join('\r\n');
}

function utcStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

export function buildICS(tasks: Task[], courses: Course[], now: Date = new Date()): string {
  const byId = new Map(courses.map((c) => [c.id, c]));
  const lines: string[] = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Homework To-Do//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Homework To-Do'];
  const stamp = utcStamp(now);
  for (const t of tasks) {
    if (!t.dueAt) continue;
    const course = byId.get(t.courseId ?? '');
    const summary = `${course ? `[${course.name}] ` : ''}${t.title}${t.completedAt ? ' ✓' : ''}`;
    const descParts: string[] = [];
    if (t.type) descParts.push(`Type: ${t.type}`);
    if (t.priority !== 'normal') descParts.push(`Priority: ${t.priority}`);
    if (t.estimateMin) descParts.push(`Estimate: ${t.estimateMin} min`);
    if (t.weight) descParts.push(`Weight: ${t.weight}%`);
    if (t.subtasks.length) descParts.push('Subtasks:\n' + t.subtasks.map((s) => `${s.done ? '[x]' : '[ ]'} ${s.title}`).join('\n'));
    if (t.notes) descParts.push(t.notes);
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${t.id}@homework-todo`);
    lines.push(`DTSTAMP:${stamp}`);
    if (isDateOnly(t.dueAt)) {
      lines.push(`DTSTART;VALUE=DATE:${t.dueAt.replace(/-/g, '')}`);
      lines.push(`DTEND;VALUE=DATE:${addDaysKey(t.dueAt, 1).replace(/-/g, '')}`);
    } else {
      const d = new Date(t.dueAt);
      lines.push(`DTSTART:${utcStamp(d)}`);
      lines.push(`DTEND:${utcStamp(new Date(d.getTime() + Math.max(15, t.estimateMin ?? 30) * 60000))}`);
    }
    lines.push(`SUMMARY:${esc(summary)}`);
    if (descParts.length) lines.push(`DESCRIPTION:${esc(descParts.join('\n'))}`);
    if (course) lines.push(`CATEGORIES:${esc(course.name)}`);
    if (t.completedAt) lines.push('STATUS:COMPLETED');
    if (t.type === 'exam' || t.type === 'quiz') {
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(summary)} tomorrow`, 'TRIGGER:-P1D', 'END:VALARM');
    }
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
