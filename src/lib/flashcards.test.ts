import { describe, expect, it } from 'vitest';
import { dueCards, mastery, parseCards, review, shuffle } from './flashcards';
import type { Card } from './types';

const card: Card = { id: 'c', deckId: 'd', front: 'f', back: 'b', box: 1, due: '2026-09-14', reps: 0, lapses: 0, createdAt: '', updatedAt: '' };

describe('flashcards', () => {
  it('promotes on correct and resets on miss', () => {
    const ok = review(card, true, '2026-09-14');
    expect(ok.box).toBe(2);
    expect(ok.due).toBe('2026-09-15');
    const ok2 = review(ok, true, '2026-09-15');
    expect(ok2.box).toBe(3);
    expect(ok2.due).toBe('2026-09-18');
    const miss = review(ok2, false, '2026-09-18');
    expect(miss.box).toBe(1);
    expect(miss.due).toBe('2026-09-18');
    expect(miss.lapses).toBe(1);
    expect(miss.reps).toBe(3);
  });
  it('caps at box 5', () => {
    const c = review({ ...card, box: 5 }, true, '2026-09-14');
    expect(c.box).toBe(5);
    expect(c.due).toBe('2026-09-28');
  });
  it('finds due cards', () => {
    expect(dueCards([card, { ...card, id: 'x', due: '2026-09-20' }], '2026-09-14').map((c) => c.id)).toEqual(['c']);
  });
  it('shuffles deterministically', () => {
    expect(shuffle([1, 2, 3, 4, 5], 7)).toEqual(shuffle([1, 2, 3, 4, 5], 7));
    expect(shuffle([1, 2, 3, 4, 5], 7).sort()).toEqual([1, 2, 3, 4, 5]);
  });
  it('parses pasted cards in several formats', () => {
    const cards = parseCards('mitosis :: cell division\nosmosis - water diffusion\nQ: What is 2+2?\nA: 4\nATP: energy currency\nphotosynthesis\tlight to sugar');
    expect(cards).toEqual([
      { front: 'mitosis', back: 'cell division' },
      { front: 'osmosis', back: 'water diffusion' },
      { front: 'What is 2+2?', back: '4' },
      { front: 'ATP', back: 'energy currency' },
      { front: 'photosynthesis', back: 'light to sugar' },
    ]);
  });
  it('computes mastery', () => {
    expect(mastery([])).toBe(0);
    expect(
      mastery([
        { ...card, box: 1 },
        { ...card, box: 5 },
      ]),
    ).toBe(0.5);
  });
});
