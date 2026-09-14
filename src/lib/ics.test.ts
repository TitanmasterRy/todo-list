import { describe, expect, it } from 'vitest';
import { buildICS } from './ics';
import type { Task } from './types';

const base: Task = { id: 't1', title: 'Essay, draft; final', tags: [], priority: 'high', subtasks: [], createdAt: '', updatedAt: '', order: 0, deferredCount: 0 };

describe('buildICS', () => {
  it('emits all-day events for date-only tasks and escapes text', () => {
    const ics = buildICS([{ ...base, dueAt: '2026-09-21', courseId: 'c1' }], [{ id: 'c1', name: 'History', color: '#000', archived: false }], new Date(Date.UTC(2026, 8, 14)));
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('DTSTART;VALUE=DATE:20260921');
    expect(ics).toContain('DTEND;VALUE=DATE:20260922');
    expect(ics).toContain('SUMMARY:[History] Essay\\, draft\; final');
    expect(ics).toContain('CATEGORIES:History');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });
  it('emits timed events in UTC and alarms for exams', () => {
    const ics = buildICS([{ ...base, dueAt: '2026-09-21T14:00:00.000Z', type: 'exam', estimateMin: 90 }], []);
    expect(ics).toContain('DTSTART:20260921T140000Z');
    expect(ics).toContain('DTEND:20260921T153000Z');
    expect(ics).toContain('TRIGGER:-P1D');
  });
  it('skips undated tasks and folds long lines', () => {
    const ics = buildICS([base, { ...base, id: 't2', dueAt: '2026-09-21', title: 'x'.repeat(200) }], []);
    expect(ics.match(/BEGIN:VEVENT/g)?.length).toBe(1);
    expect(ics.split('\r\n').every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
  });
});
