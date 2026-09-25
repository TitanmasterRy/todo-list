import { describe, expect, it } from 'vitest';
import type { Card } from './types';
import type { Question } from './quizmaker';
import { seeded } from './casino/rng';
import { beats, canRaceDeck, canRaceQuiz, gapText, ghostProgress, quizQuestions, raceFromCards, raceFromQuiz, recordRun, type Ghost } from './quizrace';

const card = (id: string, front: string, back: string): Card => ({ id, deckId: 'd', front, back, box: 1, due: '2026-01-01', reps: 0, lapses: 0, createdAt: '', updatedAt: '' });
const deck = (n: number) => Array.from({ length: n }, (_, i) => card(`c${i}`, `term ${i}`, `definition ${i}`));
const ghost = (hits: number[], total: number): Ghost => ({ hits, total, n: 10, at: '2026-09-01T00:00:00Z' });

describe('race questions', () => {
  it('asks up to ten cards from a deck, each with one right answer among four', () => {
    expect(canRaceDeck(deck(3))).toBe(false);
    expect(canRaceDeck(deck(4))).toBe(true);
    const qs = raceFromCards(deck(25), seeded(3));
    expect(qs).toHaveLength(10);
    expect(new Set(qs.map((q) => q.id)).size).toBe(10);
    for (const q of qs) {
      expect(q.choices).toHaveLength(4);
      expect(q.choices.filter((c) => c.correct).map((c) => c.text)).toEqual([q.prompt.replace('term', 'definition')]);
    }
    expect(raceFromCards(deck(5), seeded(1))).toHaveLength(5);
  });
  it('uses quiz-maker sets: options as given, short answers get other answers as distractors, incomplete ones are skipped', () => {
    const q = (id: string, extra: Partial<Question>): Question => ({ id, type: 'mc', prompt: `Q ${id}`, options: [], correct: [], ...extra });
    const set = {
      questions: [
        q('mc', { options: ['4', '', '5', '22'], correct: [0] }),
        q('tf', { type: 'tf', options: ['True', 'False'], correct: [1] }),
        q('s1', { type: 'short', answer: 'Paris' }),
        q('s2', { type: 'fill', answer: 'Rome' }),
        q('s3', { type: 'short', answer: 'Madrid' }),
        q('empty', { prompt: '' }),
      ],
    };
    const got = quizQuestions(set, seeded(2));
    expect(got.map((x) => x.id)).toEqual(['mc', 'tf', 's1', 's2', 's3']);
    const mc = got[0];
    expect(mc.choices.map((c) => c.text).sort()).toEqual(['22', '4', '5']);
    expect(mc.choices.find((c) => c.correct)!.text).toBe('4');
    expect(got[1].choices.map((c) => [c.text, c.correct])).toEqual([
      ['True', false],
      ['False', true],
    ]);
    expect(got[2].choices.find((c) => c.correct)!.text).toBe('Paris');
    expect(got[2].choices.map((c) => c.text).sort()).toEqual(['Madrid', 'Paris', 'Rome']);
    expect(canRaceQuiz(set)).toBe(true);
    expect(canRaceQuiz({ questions: set.questions.slice(0, 2) })).toBe(false);
    expect(raceFromQuiz(set, seeded(1), 2)).toHaveLength(2);
  });
});

describe('ghosts', () => {
  it('counts the ghost’s right answers up to a moment', () => {
    const g = ghost([1000, 2500, 2500, 6000], 9000);
    expect(ghostProgress(g, 0)).toBe(0);
    expect(ghostProgress(g, 999)).toBe(0);
    expect(ghostProgress(g, 1000)).toBe(1);
    expect(ghostProgress(g, 3000)).toBe(3);
    expect(ghostProgress(g, 60_000)).toBe(4);
    expect(ghostProgress(undefined, 5000)).toBe(0);
  });
  it('more right answers beats the ghost; a tie goes to the faster finish', () => {
    const g = ghost([1000, 2000, 3000], 10_000);
    expect(beats(ghost([1, 2, 3, 4], 20_000), g)).toBe(true);
    expect(beats(ghost([1, 2, 3], 9_000), g)).toBe(true);
    expect(beats(ghost([1, 2, 3], 10_000), g)).toBe(false);
    expect(beats(ghost([1, 2], 1_000), g)).toBe(false);
    expect(beats(ghost([], 5_000), undefined)).toBe(true);
  });
  it('keeps only a better run, per deck', () => {
    const first = recordRun({}, 'deck:a', ghost([3000, 1000], 8000));
    expect(first.saved).toBe(true);
    expect(first.ghosts['deck:a'].hits).toEqual([1000, 3000]);
    const worse = recordRun(first.ghosts, 'deck:a', ghost([500], 4000));
    expect(worse.saved).toBe(false);
    expect(worse.ghosts).toBe(first.ghosts);
    const other = recordRun(first.ghosts, 'quiz:b', ghost([500], 4000));
    expect(Object.keys(other.ghosts)).toEqual(['deck:a', 'quiz:b']);
    const better = recordRun(other.ghosts, 'deck:a', ghost([900, 1800], 7000));
    expect(better.saved).toBe(true);
    expect(better.ghosts['deck:a'].total).toBe(7000);
  });
  it('describes the gap', () => {
    expect(gapText(3, 3)).toBe('neck and neck');
    expect(gapText(5, 2)).toBe('3 ahead');
    expect(gapText(1, 2)).toBe('1 behind');
  });
});
