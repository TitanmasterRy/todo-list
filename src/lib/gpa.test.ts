import { describe, expect, it } from 'vitest';
import { gpa, groupByTerm, pointsFor, transcriptCSV, type TranscriptRow } from './gpa';

const row = (o: Partial<TranscriptRow>): TranscriptRow => ({ courseId: 'c', name: 'X', term: 'Fall', credits: 1, grade: null, letter: null, points: null, ...o });

describe('gpa', () => {
  it('maps percents to points', () => {
    expect(pointsFor(95)).toBe(4);
    expect(pointsFor(91)).toBe(3.7);
    expect(pointsFor(85)).toBe(3);
    expect(pointsFor(50)).toBe(0);
  });
  it('weights by credits and skips ungraded', () => {
    const rows = [row({ credits: 4, points: 4, grade: 95, letter: 'A' }), row({ credits: 2, points: 3, grade: 85, letter: 'B' }), row({ credits: 3 })];
    const g = gpa(rows);
    expect(g.gpa).toBeCloseTo(3.67, 2);
    expect(g.credits).toBe(9);
    expect(g.gradedCredits).toBe(6);
    expect(gpa([row({})]).gpa).toBeNull();
  });
  it('groups by term keeping order', () => {
    const g = groupByTerm([row({ term: 'Fall' }), row({ term: 'Spring' }), row({ term: 'Fall' })]);
    expect(g.map((x) => x.term)).toEqual(['Fall', 'Spring']);
    expect(g[0].rows.length).toBe(2);
  });
  it('exports csv', () => {
    const csv = transcriptCSV([row({ name: 'Calc "II"', grade: 91.25, letter: 'A−', points: 3.7 })]);
    expect(csv).toContain('"Calc ""II"""');
    expect(csv).toContain('91.3');
  });
});
