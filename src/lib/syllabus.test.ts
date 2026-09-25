import { describe, expect, it } from 'vitest';
import { datesIn, extractSyllabus, guessType, isPast } from './syllabus';

const today = '2026-09-01';

describe('syllabus box', () => {
  it('finds dates in common formats and infers the school year', () => {
    const keys = (l: string) => datesIn(l, today).map((h) => h.key);
    expect(keys('Essay 1 due Sep 30')).toEqual(['2026-09-30']);
    expect(keys('Midterm: October 14th, 2026')).toEqual(['2026-10-14']);
    expect(keys('14 Oct – field trip')).toEqual(['2026-10-14']);
    expect(keys('10/14 quiz')).toEqual(['2026-10-14']);
    expect(keys('Final 1/20')).toEqual(['2027-01-20']); // January is later in the same school year
    expect(keys('Due 2026-12-03')).toEqual(['2026-12-03']);
    expect(datesIn('14/10 quiz', today, true).map((h) => h.key)).toEqual(['2026-10-14']);
    expect(keys('Scored 8/10 pts')).toEqual([]);
    expect(keys('Feb 30 nonsense')).toEqual([]);
  });

  it('turns lines into tasks with titles and types', () => {
    const found = extractSyllabus(
      `AP World History – Fall 2026
Week 3
• Mon, Sep 14: Read Chapter 4 (pp. 101–130)
• Fri Sep 18 – Quiz: Unit 1
Sept 30 — Essay 1 due
10/14 Midterm exam
Oct 26 - Group project presentation
Oct 26 - Group project presentation`,
      { today },
    );
    expect(found.map((f) => (f.kind === 'task' ? [f.dateKey, f.title, f.type] : f))).toEqual([
      ['2026-09-14', 'Read Chapter 4 (pp. 101–130)', 'reading'],
      ['2026-09-18', 'Quiz – Unit 1', 'quiz'],
      ['2026-09-30', 'Essay 1', 'homework'],
      ['2026-10-14', 'Midterm exam', 'exam'],
      ['2026-10-26', 'Group project presentation', 'project'],
    ]);
  });

  it('spots breaks and days off', () => {
    const found = extractSyllabus('Nov 23 – Nov 27: Thanksgiving break\nOct 12 No school (teacher workday)\nDec 3 Quiz 4 (no class after)', { today });
    expect(found[0]).toMatchObject({ kind: 'break', from: '2026-11-23', to: '2026-11-27' });
    expect(found[1]).toMatchObject({ kind: 'break', from: '2026-10-12', to: '2026-10-12' });
    expect(found[2]).toMatchObject({ kind: 'task', type: 'quiz', dateKey: '2026-12-03' });
  });

  it('guesses types and flags past items', () => {
    expect(guessType('Unit 2 test')).toBe('exam');
    expect(guessType('Lab write-up')).toBe('homework');
    expect(isPast({ kind: 'task', title: 'x', dateKey: '2026-08-20', type: 'homework', line: '' }, today)).toBe(true);
  });
});
