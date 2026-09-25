// Study games in Play → Study: notecard boss battle and match rush. Pure logic here; the screens are in components/play/.
// They read the player's decks but don't touch review scheduling (multiple choice and matching are easier than recall).
import type { Card } from './types';
import { shuffle, type Rng } from './casino/rng';

const rand: Rng = Math.random;

/** The answer side as a short label. Cloze backs are "answer\n\nwhole sentence", so only the first paragraph is kept. */
export function answerText(card: Pick<Card, 'back'>): string {
  return card.back.split(/\n\s*\n/)[0].trim();
}

/** Cards with the same key have the same answer (so either definition tile matches, and they never both appear as choices). */
export function answerKey(card: Pick<Card, 'back' | 'backImage'>): string {
  return answerText(card).toLowerCase().replace(/\s+/g, ' ') || `img:${card.backImage ?? ''}`;
}

/** Cards with something on both sides. */
export function playableCards(cards: Card[]): Card[] {
  return cards.filter((c) => (c.front.trim() || c.frontImage) && (answerText(c) || c.backImage));
}

function distinctAnswers(cards: Card[]): Card[] {
  const seen = new Set<string>();
  return cards.filter((c) => !seen.has(answerKey(c)) && !!seen.add(answerKey(c)));
}

// ---------- boss battle ----------

export const BOSS_MIN_CARDS = 4;
export const BOSS_MAX_TURNS = 20; // cards per battle; big decks get a random 20
export const PLAYER_HP = 5;
export const HIT = 10;
export const CRIT = 15; // from the third right answer in a row

export function canBattle(cards: Card[]): boolean {
  return distinctAnswers(playableCards(cards)).length >= BOSS_MIN_CARDS;
}

export interface Choice {
  id: string;
  text: string;
  image?: string;
  correct: boolean;
}

/** The right answer plus distractors from other cards in the deck with different answers, preferring ones of a similar length. */
export function pickChoices(card: Card, deck: Card[], rng: Rng = rand, n = 4): Choice[] {
  const key = answerKey(card);
  const len = answerText(card).length;
  const pool = shuffle(
    distinctAnswers(playableCards(deck)).filter((c) => c.id !== card.id && answerKey(c) !== key),
    rng,
  )
    .sort((a, b) => Math.abs(answerText(a).length - len) - Math.abs(answerText(b).length - len))
    .slice(0, n + 1);
  const picks = shuffle(pool, rng).slice(0, n - 1);
  return shuffle([card, ...picks], rng).map((c) => ({ id: c.id, text: answerText(c), image: c.backImage, correct: c === card }));
}

export interface BossPhase {
  name: string;
  emoji: string;
  taunt: string;
  bite: number; // hearts a wrong answer costs
}

export const BOSS_PHASES: BossPhase[] = [
  { name: 'Pop Quiz', emoji: '👾', taunt: 'Bet you didn’t study.', bite: 1 },
  { name: 'Midterm', emoji: '👹', taunt: 'Now I’m angry.', bite: 1 },
  { name: 'Final Exam', emoji: '🐉', taunt: 'Wrong answers hurt double!', bite: 2 },
];

export interface Battle {
  queue: string[]; // card ids still to answer; missed cards go to the back
  bossHp: number;
  bossMax: number;
  hp: number;
  streak: number;
  bestStreak: number;
  right: number;
  wrong: number;
  missed: string[]; // ids answered wrong at least once
  result: 'playing' | 'won' | 'lost';
}

export function newBattle(cards: Card[], rng: Rng = rand, maxTurns = BOSS_MAX_TURNS): Battle {
  const queue = shuffle(
    playableCards(cards).map((c) => c.id),
    rng,
  ).slice(0, maxTurns);
  // 80% of the cards right (fewer with crits) beats the boss; every card is eventually answered, so the boss always falls in time
  const bossMax = Math.max(3, Math.round(queue.length * 0.8)) * HIT;
  return { queue, bossHp: bossMax, bossMax, hp: PLAYER_HP, streak: 0, bestStreak: 0, right: 0, wrong: 0, missed: [], result: 'playing' };
}

export function bossPhase(b: Pick<Battle, 'bossHp' | 'bossMax'>): number {
  const f = b.bossHp / b.bossMax;
  return f > 2 / 3 ? 0 : f > 1 / 3 ? 1 : 2;
}

/** Damage a right answer deals at the given streak (the streak including this answer). */
export const hitFor = (streak: number): number => (streak >= 3 ? CRIT : HIT);

export function answerBattle(b: Battle, correct: boolean): Battle {
  if (b.result !== 'playing' || !b.queue.length) return b;
  const [id, ...rest] = b.queue;
  if (correct) {
    const streak = b.streak + 1;
    const bossHp = Math.max(0, b.bossHp - hitFor(streak));
    return { ...b, queue: rest, bossHp, streak, bestStreak: Math.max(b.bestStreak, streak), right: b.right + 1, result: bossHp <= 0 || !rest.length ? 'won' : 'playing' };
  }
  const hp = Math.max(0, b.hp - BOSS_PHASES[bossPhase(b)].bite);
  return { ...b, queue: [...rest, id], hp, streak: 0, wrong: b.wrong + 1, missed: b.missed.includes(id) ? b.missed : [...b.missed, id], result: hp <= 0 ? 'lost' : 'playing' };
}

export function battleScore(b: Battle): number {
  return b.right * 100 + b.bestStreak * 25 + (b.result === 'won' ? 500 + b.hp * 100 : 0);
}

// ---------- match rush ----------

export const MATCH_MIN_CARDS = 3;
export const ROUND_SIZE = 6;
export const MISS_PENALTY_MS = 2000;

export function canMatch(cards: Card[]): boolean {
  return playableCards(cards).length >= MATCH_MIN_CARDS;
}

/** Split a deck into rounds of at most `size` cards, as even as possible (13 cards → 5, 4, 4). */
export function matchRounds(cards: Card[], rng: Rng = rand, size = ROUND_SIZE): Card[][] {
  const pool = shuffle(playableCards(cards), rng);
  const n = Math.ceil(pool.length / size);
  const rounds: Card[][] = Array.from({ length: n }, () => []);
  pool.forEach((c, i) => rounds[i % n].push(c));
  return rounds;
}

export interface Tile {
  id: string;
  key: string;
  text: string;
  image?: string;
}

/** Term tiles and shuffled definition tiles for one round. The definitions never line up with the terms. */
export function buildRound(cards: Card[], rng: Rng = rand): { terms: Tile[]; defs: Tile[] } {
  const terms = cards.map((c) => ({ id: c.id, key: answerKey(c), text: c.front, image: c.frontImage }));
  let defs = shuffle(
    cards.map((c) => ({ id: c.id, key: answerKey(c), text: answerText(c), image: c.backImage })),
    rng,
  );
  if (defs.length > 1 && defs.every((d, i) => d.id === terms[i].id)) defs = [...defs.slice(1), defs[0]];
  return { terms, defs };
}

export const isMatch = (term: Tile, def: Tile): boolean => term.key === def.key;

/** 83_400 → "1:23.4" */
export function formatTime(ms: number): string {
  const tenths = Math.floor(Math.max(0, ms) / 100);
  const s = Math.floor(tenths / 10);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}.${tenths % 10}`;
}
