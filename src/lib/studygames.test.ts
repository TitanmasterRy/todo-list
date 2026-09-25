import { describe, expect, it } from 'vitest';
import type { Card } from './types';
import { seeded } from './casino/rng';
import {
  answerBattle,
  answerKey,
  answerText,
  battleScore,
  bossPhase,
  buildRound,
  canBattle,
  canMatch,
  formatTime,
  isMatch,
  matchRounds,
  newBattle,
  pickChoices,
  playableCards,
  BOSS_PHASES,
  CRIT,
  HIT,
  PLAYER_HP,
} from './studygames';

const card = (id: string, front: string, back: string, extra: Partial<Card> = {}): Card => ({
  id,
  deckId: 'd',
  front,
  back,
  box: 1,
  due: '2026-01-01',
  reps: 0,
  lapses: 0,
  createdAt: '',
  updatedAt: '',
  ...extra,
});
const deck = (n: number) => Array.from({ length: n }, (_, i) => card(`c${i}`, `term ${i}`, `definition ${i}`));

describe('answers', () => {
  it('uses the first paragraph of cloze backs', () => {
    expect(answerText(card('a', 'The [...] holds DNA.', 'nucleus\n\nThe nucleus holds DNA.'))).toBe('nucleus');
    expect(answerKey(card('a', 'x', '  Energy   Currency '))).toBe('energy currency');
  });
  it('skips cards missing a side, keeps picture cards', () => {
    const cards = [card('a', 'x', ''), card('b', '', 'y'), card('c', '', 'y', { frontImage: 'data:img' }), card('d', 'x', '', { backImage: 'data:img' })];
    expect(playableCards(cards).map((c) => c.id)).toEqual(['c', 'd']);
  });
});

describe('boss battle choices', () => {
  it('needs four cards with different answers', () => {
    expect(canBattle(deck(3))).toBe(false);
    expect(canBattle([...deck(3), card('dup', 'again', 'definition 0')])).toBe(false);
    expect(canBattle(deck(4))).toBe(true);
  });
  it('gives the right answer and three distinct distractors from the deck', () => {
    const cards = [...deck(10), card('dup', 'other term', 'Definition 3')];
    for (let seed = 1; seed < 30; seed++) {
      const ch = pickChoices(cards[3], cards, seeded(seed));
      expect(ch).toHaveLength(4);
      expect(ch.filter((c) => c.correct).map((c) => c.id)).toEqual(['c3']);
      const texts = ch.map((c) => c.text.toLowerCase());
      expect(new Set(texts).size).toBe(4); // the duplicate answer never shows up as a distractor
      expect(ch.every((c) => cards.some((k) => k.id === c.id))).toBe(true);
    }
  });
  it('prefers distractors of a similar length', () => {
    const cards = [
      card('q', 'q', 'mitosis'),
      card('a', 'a', 'meiosis'),
      card('b', 'b', 'osmosis'),
      card('c', 'c', 'enzyme'),
      ...Array.from({ length: 8 }, (_, i) => card(`l${i}`, `l${i}`, `a very long definition number ${i} that goes on`)),
    ];
    let short = 0;
    for (let seed = 1; seed <= 40; seed++) short += pickChoices(cards[0], cards, seeded(seed)).filter((c) => ['a', 'b', 'c'].includes(c.id)).length;
    // 3 of the 11 candidates are short: picking at random would average under one per question
    expect(short / 40).toBeGreaterThan(1.3);
  });
});

describe('boss battle', () => {
  it('right answers hit the boss, three in a row crit, the boss falls before the deck runs out', () => {
    let b = newBattle(deck(10), seeded(1));
    expect(b.queue).toHaveLength(10);
    expect(b.bossMax).toBe(80);
    b = answerBattle(b, true);
    b = answerBattle(b, true);
    expect(b.bossHp).toBe(80 - 2 * HIT);
    b = answerBattle(b, true);
    expect(b.bossHp).toBe(80 - 2 * HIT - CRIT);
    while (b.result === 'playing') b = answerBattle(b, true);
    expect(b.result).toBe('won');
    expect(b.right).toBeLessThan(10);
    expect(b.bestStreak).toBe(b.right);
    expect(battleScore(b)).toBe(b.right * 100 + b.bestStreak * 25 + 500 + PLAYER_HP * 100);
  });
  it('wrong answers cost hearts, send the card to the back, and the last phase bites twice', () => {
    let b = newBattle(deck(6), seeded(2));
    const first = b.queue[0];
    b = answerBattle(b, false);
    expect(b.hp).toBe(PLAYER_HP - 1);
    expect(b.queue[b.queue.length - 1]).toBe(first);
    expect(b.missed).toEqual([first]);
    expect(b.streak).toBe(0);
    b = { ...b, bossHp: 5 };
    expect(bossPhase(b)).toBe(2);
    expect(BOSS_PHASES[2].bite).toBe(2);
    b = answerBattle(b, false);
    expect(b.hp).toBe(PLAYER_HP - 3);
    b = answerBattle(answerBattle(b, false), false);
    expect(b.result).toBe('lost');
    expect(answerBattle(b, true)).toBe(b);
  });
  it('caps big decks at 20 turns', () => {
    expect(newBattle(deck(50)).queue).toHaveLength(20);
  });
});

describe('match rush', () => {
  it('splits the deck into even rounds of at most six', () => {
    expect(matchRounds(deck(13), seeded(1)).map((r) => r.length)).toEqual([5, 4, 4]);
    expect(matchRounds(deck(6), seeded(1)).map((r) => r.length)).toEqual([6]);
    const all = matchRounds(deck(20), seeded(4)).flat();
    expect(new Set(all.map((c) => c.id)).size).toBe(20);
    expect(canMatch(deck(2))).toBe(false);
    expect(canMatch(deck(3))).toBe(true);
  });
  it('builds shuffled definitions that match their terms by answer', () => {
    for (let seed = 1; seed < 20; seed++) {
      const { terms, defs } = buildRound(deck(4), seeded(seed));
      expect(defs.map((d) => d.id).sort()).toEqual(terms.map((t) => t.id).sort());
      expect(defs.some((d, i) => d.id !== terms[i].id)).toBe(true);
      for (const t of terms) expect(defs.filter((d) => isMatch(t, d)).map((d) => d.id)).toEqual([t.id]);
    }
    // two cards with the same answer: either definition tile counts
    const { terms, defs } = buildRound([card('a', 'big', 'large'), card('b', 'huge', 'Large'), card('c', 'tiny', 'small')], seeded(1));
    expect(
      defs
        .filter((d) => isMatch(terms[0], d))
        .map((d) => d.id)
        .sort(),
    ).toEqual(['a', 'b']);
  });
  it('formats times', () => {
    expect(formatTime(83_400)).toBe('1:23.4');
    expect(formatTime(5_060)).toBe('0:05.0');
  });
});
