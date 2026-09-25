import { describe, expect, it } from 'vitest';
import { acceptedAnswers, addAttempt, gradeTest, isCorrect, normalize, shortAnswerCorrect, summaryOf, testable } from './practicetest';
import type { Question } from './quizmaker';

const mc: Question = { id: 'a', type: 'mc', prompt: 'Powerhouse?', options: ['Nucleus', 'Mitochondria', 'Ribosome'], correct: [1] };
const multi: Question = { id: 'b', type: 'mc', prompt: 'Primes?', options: ['2', '4', '5'], correct: [0, 2], points: 2 };
const tf: Question = { id: 'c', type: 'tf', prompt: 'Sky is blue', options: ['True', 'False'], correct: [0] };
const short: Question = { id: 'd', type: 'short', prompt: 'Process?', options: [], correct: [], answer: 'Photosynthesis / photo-synthesis' };
const num: Question = { id: 'e', type: 'fill', prompt: '2+2 = ___', options: [], correct: [], answer: '4' };

describe('practice tests', () => {
  it('normalizes answers', () => {
    expect(normalize('  The Mitochondría!! ')).toBe('mitochondria');
    expect(acceptedAnswers('Paris; paris, France | Paree')).toEqual(['paris', 'paris france', 'paree']);
  });
  it('grades short answers forgivingly but not loosely', () => {
    expect(shortAnswerCorrect('photosynthesis', short.answer!)).toBe(true);
    expect(shortAnswerCorrect('Photosynthisis', short.answer!)).toBe(true); // one typo on a long word
    expect(shortAnswerCorrect('respiration', short.answer!)).toBe(false);
    expect(shortAnswerCorrect('4.0', '4')).toBe(true);
    expect(shortAnswerCorrect('5', '4')).toBe(false);
    expect(shortAnswerCorrect('cat', 'bat')).toBe(false); // short words need to be exact
    expect(shortAnswerCorrect('', '4')).toBe(false);
  });
  it('grades choice questions exactly, including several right options', () => {
    expect(isCorrect(mc, [1])).toBe(true);
    expect(isCorrect(mc, [0])).toBe(false);
    expect(isCorrect(multi, [2, 0])).toBe(true);
    expect(isCorrect(multi, [0])).toBe(false);
    expect(isCorrect(tf, undefined)).toBe(false);
  });
  it('totals points with overrides', () => {
    const g = gradeTest([mc, multi, tf, short, num], { a: [1], b: [0], c: [0], d: 'fotosynthesis', e: '4' });
    expect(g.results.map((r) => r.correct)).toEqual([true, false, true, true, true]);
    expect([g.earned, g.total, g.pct]).toEqual([4, 6, 66.7]);
    expect(gradeTest([short], { d: 'sunlight to sugar' }, { d: true }).pct).toBe(100);
  });
  it('keeps only testable questions and tracks attempts', () => {
    expect(testable({ questions: [mc, { ...short, answer: '' }, { ...mc, id: 'x', prompt: ' ' }] }).map((q) => q.id)).toEqual(['a']);
    let all = addAttempt({}, 's', { at: '1', pct: 60, earned: 3, total: 5, ms: 1000, missed: [] });
    all = addAttempt(all, 's', { at: '2', pct: 80, earned: 4, total: 5, ms: 900, missed: [] });
    expect(summaryOf(all.s)).toEqual({ last: 80, best: 80, count: 2, trend: 20 });
    expect(summaryOf(undefined)).toEqual({ count: 0 });
  });
});
