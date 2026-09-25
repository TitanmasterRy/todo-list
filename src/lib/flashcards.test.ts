import { describe, expect, it } from 'vitest';
import { dueCards, mastery, parseCards, parseCloze, review, shuffle } from './flashcards';
import { formatInterval, preview, retrievability } from './fsrs';
import type { Card } from './types';

const card: Card = { id: 'c', deckId: 'd', front: 'f', back: 'b', box: 1, due: '2026-09-14', reps: 0, lapses: 0, createdAt: '', updatedAt: '' };

describe('flashcards', () => {
  it('schedules a new card with FSRS', () => {
    const good = review(card, true, '2026-09-14');
    expect(good.due).toBe('2026-09-17'); // initial stability for Good ≈ 3.1 days
    expect(good.stability).toBeCloseTo(3.13, 1);
    const again = review(card, false, '2026-09-14');
    expect(again.due).toBe('2026-09-14');
    expect(again.lapses).toBe(1);
    const easy = review(card, 4, '2026-09-14');
    const hard = review(card, 2, '2026-09-14');
    expect(easy.stability!).toBeGreaterThan(good.stability!);
    expect(hard.stability!).toBeLessThan(good.stability!);
  });
  it('grows intervals with successful reviews and shrinks them on a lapse', () => {
    let c = review(card, true, '2026-09-14');
    const i1 = c.stability!;
    c = review(c, true, c.due);
    expect(c.stability!).toBeGreaterThan(i1 * 1.5);
    const before = c.stability!;
    const lapse = review(c, false, c.due);
    expect(lapse.stability!).toBeLessThan(before);
    expect(lapse.difficulty!).toBeGreaterThan(c.difficulty!);
  });
  it('carries over Leitner progress for older cards', () => {
    const old = review({ ...card, box: 5, reps: 6 }, true, '2026-09-14');
    expect(old.stability!).toBeGreaterThan(16);
    expect(old.box).toBe(5);
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

describe('cloze and FSRS helpers', () => {
  it('makes one card per cloze number', () => {
    const cards = parseCloze('The {{c1::mitochondria}} makes {{c2::ATP}} for the {{c1::cell}}.');
    expect(cards).toHaveLength(2);
    expect(cards[0].front).toBe('The […] makes ATP for the […].');
    expect(cards[0].back.split('\n')[0]).toBe('mitochondria, cell');
    expect(cards[1].front).toBe('The mitochondria makes […] for the cell.');
    expect(parseCloze('{{Paris::capital}} is in France')[0].front).toBe('[capital] is in France');
    expect(parseCloze('no blanks here')).toEqual([]);
  });
  it('previews and formats intervals', () => {
    const p = preview(card, '2026-09-14');
    expect(p[1]).toBe(0);
    expect(p[4]).toBeGreaterThan(p[3]);
    expect(formatInterval(0)).toBe('now');
    expect(formatInterval(45)).toBe('2mo');
    expect(retrievability(0, 5)).toBe(1);
    expect(retrievability(5, 5)).toBeCloseTo(0.9, 2);
  });
});
