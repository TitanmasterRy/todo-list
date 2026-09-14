import { describe, expect, it } from 'vitest';
import { matchCourse, parseQuickAdd } from './parser';

// Monday 2026-09-14, 10:00 local
const now = new Date(2026, 8, 14, 10, 0, 0);
const courses = [
  { id: 'c1', name: 'Calc II' },
  { id: 'c2', name: 'Chem' },
  { id: 'c3', name: 'History' },
];

describe('parseQuickAdd', () => {
  it('parses the canonical example', () => {
    const p = parseQuickAdd('Read ch 4 tomorrow 8pm #calc !high ~45m', { now, courses });
    expect(p.title).toBe('Read ch 4');
    expect(p.dueKey).toBe('2026-09-15');
    expect(p.hasTime).toBe(true);
    expect(new Date(p.dueAt!).getHours()).toBe(20);
    expect(p.courseId).toBe('c1');
    expect(p.priority).toBe('high');
    expect(p.estimateMin).toBe(45);
    expect(p.tags).toEqual([]);
    expect(p.chips.map((c) => c.kind).sort()).toEqual(['course', 'due', 'estimate', 'priority']);
  });

  it('keeps plain numbers in the title', () => {
    const p = parseQuickAdd('Problems 1 to 20 ch 4', { now, courses });
    expect(p.title).toBe('Problems 1 to 20 ch 4');
    expect(p.dueAt).toBeUndefined();
  });

  it('parses relative dates', () => {
    expect(parseQuickAdd('x today', { now }).dueKey).toBe('2026-09-14');
    expect(parseQuickAdd('x tomorrow', { now }).dueKey).toBe('2026-09-15');
    expect(parseQuickAdd('x in 3 days', { now }).dueKey).toBe('2026-09-17');
    expect(parseQuickAdd('x in 2 weeks', { now }).dueKey).toBe('2026-09-28');
    expect(parseQuickAdd('x next week', { now }).dueKey).toBe('2026-09-21');
  });

  it('parses weekdays', () => {
    expect(parseQuickAdd('x fri', { now }).dueKey).toBe('2026-09-18');
    expect(parseQuickAdd('x friday', { now }).dueKey).toBe('2026-09-18');
    expect(parseQuickAdd('x mon', { now }).dueKey).toBe('2026-09-14'); // today is Monday
    expect(parseQuickAdd('x next fri', { now }).dueKey).toBe('2026-09-25');
    expect(parseQuickAdd('x on wed', { now }).title).toBe('x');
  });

  it('parses explicit dates', () => {
    expect(parseQuickAdd('x 9/21', { now }).dueKey).toBe('2026-09-21');
    expect(parseQuickAdd('x sep 21', { now }).dueKey).toBe('2026-09-21');
    expect(parseQuickAdd('x Sept 21st', { now }).dueKey).toBe('2026-09-21');
    expect(parseQuickAdd('x 21 sep', { now }).dueKey).toBe('2026-09-21');
    expect(parseQuickAdd('x 2026-10-02', { now }).dueKey).toBe('2026-10-02');
    expect(parseQuickAdd('x 1/5', { now }).dueKey).toBe('2027-01-05'); // rolls to next year when far in the past
  });

  it('parses times', () => {
    const p = parseQuickAdd('x 8pm', { now });
    expect(p.dueKey).toBe('2026-09-14');
    expect(new Date(p.dueAt!).getHours()).toBe(20);
    const q = parseQuickAdd('x 8am', { now }); // already passed today -> tomorrow
    expect(q.dueKey).toBe('2026-09-15');
    const r = parseQuickAdd('x fri at 11:30pm', { now });
    expect(r.dueKey).toBe('2026-09-18');
    expect(new Date(r.dueAt!).getMinutes()).toBe(30);
    expect(new Date(r.dueAt!).getHours()).toBe(23);
    const s = parseQuickAdd('x tomorrow 14:00', { now });
    expect(new Date(s.dueAt!).getHours()).toBe(14);
    expect(parseQuickAdd('x noon', { now }).hasTime).toBe(true);
  });

  it('matches courses and tags', () => {
    const p = parseQuickAdd('x #chem #lab', { now, courses });
    expect(p.courseId).toBe('c2');
    expect(p.tags).toEqual(['lab']);
    const q = parseQuickAdd('x #calcii', { now, courses });
    expect(q.courseId).toBe('c1');
    const r = parseQuickAdd('x #hist', { now, courses });
    expect(r.courseId).toBe('c3');
    const s = parseQuickAdd('x #reading', { now, courses });
    expect(s.courseId).toBeUndefined();
    expect(s.tags).toEqual(['reading']);
  });

  it('matchCourse prefers exact then prefix', () => {
    expect(matchCourse('Chem', courses)?.id).toBe('c2');
    expect(matchCourse('ch', courses)).toBeUndefined();
    expect(matchCourse('calc', courses)?.id).toBe('c1');
  });

  it('parses priorities and estimates', () => {
    expect(parseQuickAdd('x !low', { now }).priority).toBe('low');
    expect(parseQuickAdd('x !urgent', { now }).priority).toBe('urgent');
    expect(parseQuickAdd('x !p1', { now }).priority).toBe('urgent');
    expect(parseQuickAdd('x ~30m', { now }).estimateMin).toBe(30);
    expect(parseQuickAdd('x ~2h', { now }).estimateMin).toBe(120);
    expect(parseQuickAdd('x ~1h30m', { now }).estimateMin).toBe(90);
    expect(parseQuickAdd('x ~1.5h', { now }).estimateMin).toBe(90);
    expect(parseQuickAdd('x ~90', { now }).estimateMin).toBe(90);
  });

  it('parses recurrence', () => {
    expect(parseQuickAdd('x every day', { now }).recurrence).toEqual({ kind: 'daily' });
    expect(parseQuickAdd('x every mon wed', { now }).recurrence).toEqual({ kind: 'weekly', days: [1, 3] });
    expect(parseQuickAdd('x every mon, wed, fri', { now }).recurrence).toEqual({ kind: 'weekly', days: [1, 3, 5] });
    expect(parseQuickAdd('x every 3 days', { now }).recurrence).toEqual({ kind: 'everyNDays', n: 3 });
    expect(parseQuickAdd('x weekdays', { now }).recurrence).toEqual({ kind: 'weekdays' });
    const p = parseQuickAdd('Gym every mon wed 7am', { now });
    expect(p.title).toBe('Gym');
    expect(p.recurrence?.kind).toBe('weekly');
    expect(p.hasTime).toBe(true);
  });

  it('parses templates and types', () => {
    const p = parseQuickAdd('@lab-report tomorrow', { now });
    expect(p.template).toBe('lab-report');
    expect(p.title).toBe('');
    expect(parseQuickAdd('Final type:exam', { now }).type).toBe('exam');
  });

  it('collapses whitespace in the title', () => {
    expect(parseQuickAdd('  Write   essay  tomorrow  !high ', { now }).title).toBe('Write essay');
  });
});
