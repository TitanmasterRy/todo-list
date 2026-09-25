import { describe, expect, it } from 'vitest';
import { formatScale, gradeTimeline, letterGrade, letterOn, neededOnRemaining, nextLetter, parseScale, scaleFor, summarize, whatIf } from './grades';

describe('grades', () => {
  const items = [
    { weight: 20, score: 85 },
    { weight: 30, score: 70 },
    { weight: 50 }, // final, not yet graded
  ];
  it('summarizes graded work', () => {
    const s = summarize(items);
    expect(s.totalWeight).toBe(100);
    expect(s.gradedWeight).toBe(50);
    expect(s.earned).toBeCloseTo(17 + 21);
    expect(s.current).toBeCloseTo(76);
    expect(s.floor).toBeCloseTo(38);
    expect(s.ceiling).toBeCloseTo(88);
  });
  it('computes what is needed on the rest', () => {
    expect(neededOnRemaining(items, 80)).toBeCloseTo(84);
    expect(neededOnRemaining(items, 90)).toBeCloseTo(104); // not possible
    expect(neededOnRemaining([{ weight: 100, score: 95 }], 90)).toBeNull();
  });
  it('treats missing weight as remaining', () => {
    const s = summarize([{ weight: 30, score: 100 }]);
    expect(s.remainingWeight).toBe(70);
    expect(neededOnRemaining([{ weight: 30, score: 100 }], 90)).toBeCloseTo(600 / 7);
  });
  it('handles weights over 100', () => {
    expect(summarize([{ weight: 60, score: 50 }, { weight: 60 }]).totalWeight).toBe(120);
  });
  it('letters', () => {
    expect(letterGrade(95)).toBe('A');
    expect(letterGrade(90)).toBe('A−');
    expect(letterGrade(59)).toBe('F');
  });
});

describe('letter scales', () => {
  it('maps percents on presets and custom scales', () => {
    const ten = scaleFor({ gradeScale: 'ten' });
    expect(letterOn(89.9, ten)).toBe('B');
    expect(letterOn(90, ten)).toBe('A');
    expect(letterOn(12, ten)).toBe('F');
    expect(letterOn(91, scaleFor(undefined))).toBe('A−');
    expect(letterOn(69, scaleFor({ gradeScale: 'passfail' }))).toBe('Fail');
    const custom = parseScale('A 94, B: 85\nC=75%, D 65, F 0')!;
    expect(custom.map((s) => s.letter)).toEqual(['A', 'B', 'C', 'D', 'F']);
    expect(letterOn(93.9, scaleFor({ gradeScale: 'custom', customScale: custom }))).toBe('B');
    expect(formatScale(custom)).toBe('A 94, B 85, C 75, D 65, F 0');
    expect(parseScale('nonsense here')).toBeNull();
    expect(parseScale('')).toBeNull();
    // custom without steps falls back to the default
    expect(scaleFor({ gradeScale: 'custom' })).toBe(scaleFor(undefined));
  });
  it('says what the next letter needs', () => {
    expect(nextLetter(88, scaleFor({ gradeScale: 'ten' }))).toEqual({ letter: 'A', min: 90 });
    expect(nextLetter(95, scaleFor({ gradeScale: 'ten' }))).toBeNull();
  });
});

describe('grade trend and what-if', () => {
  it('builds a running weighted average in date order', () => {
    const t = gradeTimeline([
      { id: 'b', title: 'Quiz 2', date: '2026-10-10', weight: 10, score: 70 },
      { id: 'a', title: 'Quiz 1', date: '2026-10-01', weight: 10, score: 90 },
      { id: 'c', title: 'Test', date: '2026-10-20', weight: 20, score: 100 },
    ]);
    expect(t.map((x) => x.id)).toEqual(['a', 'b', 'c']);
    expect(t.map((x) => x.average)).toEqual([90, 80, 90]);
  });
  it('projects imagined scores and items', () => {
    const items = [{ weight: 40, score: 80 }, { weight: 60 }];
    expect(whatIf(items, {}).current).toBe(80);
    const s = whatIf(items, { 1: 95 });
    expect(s.remainingWeight).toBe(0);
    expect(s.floor).toBeCloseTo(89);
    const extra = whatIf([{ weight: 50, score: 80 }], {}, [{ weight: 50, score: 100 }]);
    expect(extra.floor).toBe(90);
  });
});
