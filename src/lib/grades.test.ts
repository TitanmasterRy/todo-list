import { describe, expect, it } from 'vitest';
import { letterGrade, neededOnRemaining, summarize } from './grades';

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
