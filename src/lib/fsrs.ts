// FSRS (Free Spaced Repetition Scheduler, v4.5 default parameters): models each card's memory with a
// stability (days until recall drops to 90%) and a difficulty (1–10), and schedules the next review for
// a target recall probability. https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm
import { addDaysKey, diffDays } from './dates';
import type { Card } from './types';

export type Rating = 1 | 2 | 3 | 4; // Again, Hard, Good, Easy
export const RATING_LABEL: Record<Rating, string> = { 1: 'Again', 2: 'Hard', 3: 'Good', 4: 'Easy' };

const W = [0.4072, 1.1829, 3.1262, 15.4722, 7.2102, 0.5316, 1.0651, 0.0234, 1.616, 0.1544, 1.0824, 1.9813, 0.0953, 0.2975, 2.2042, 0.2407, 2.9466];
const DECAY = -0.5;
const FACTOR = 19 / 81; // 0.9^(1/DECAY) - 1
export const DEFAULT_RETENTION = 0.9;
const MAX_INTERVAL = 365;

const clampD = (d: number) => Math.min(10, Math.max(1, d));

/** Probability of recalling a card `days` after the last review. */
export function retrievability(days: number, stability: number): number {
  return Math.pow(1 + (FACTOR * Math.max(0, days)) / Math.max(0.01, stability), DECAY);
}

/** Days until recall probability falls to `retention`. */
export function intervalFor(stability: number, retention = DEFAULT_RETENTION): number {
  return (stability / FACTOR) * (Math.pow(retention, 1 / DECAY) - 1);
}

const initStability = (g: Rating) => W[g - 1];
const initDifficulty = (g: Rating) => clampD(W[4] - (g - 3) * W[5]);

function nextDifficulty(d: number, g: Rating): number {
  const d1 = d - W[6] * (g - 3);
  return clampD(W[7] * initDifficulty(3) + (1 - W[7]) * d1); // mean reversion toward a "Good" card
}

function recallStability(d: number, s: number, r: number, g: Rating): number {
  const hard = g === 2 ? W[15] : 1;
  const easy = g === 4 ? W[16] : 1;
  return s * (Math.exp(W[8]) * (11 - d) * Math.pow(s, -W[9]) * (Math.exp(W[10] * (1 - r)) - 1) * hard * easy + 1);
}

function forgetStability(d: number, s: number, r: number): number {
  return Math.min(s, W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp(W[14] * (1 - r)));
}

/** Memory state for cards made before FSRS: approximate stability from the Leitner box. */
export function legacyState(card: Card): { stability: number; difficulty: number } {
  const byBox = [0.5, 1.5, 4, 8, 16];
  return { stability: byBox[Math.min(5, Math.max(1, card.box)) - 1], difficulty: 5 };
}

export function boxFor(stability: number): number {
  return stability < 1 ? 1 : stability < 4 ? 2 : stability < 10 ? 3 : stability < 30 ? 4 : 5;
}

/** Schedule a review. "Again" keeps the card due today so it comes back in the session. */
export function schedule(card: Card, rating: Rating, today: string, retention = DEFAULT_RETENTION): Card {
  const isNew = card.stability === undefined && card.reps === 0;
  const prev = card.stability === undefined ? (isNew ? undefined : legacyState(card)) : { stability: card.stability, difficulty: card.difficulty ?? 5 };
  let stability: number;
  let difficulty: number;
  if (!prev) {
    stability = initStability(rating);
    difficulty = initDifficulty(rating);
  } else {
    const elapsed = card.lastReview ? Math.max(0, diffDays(card.lastReview, today)) : Math.max(0, intervalFor(prev.stability));
    const r = retrievability(elapsed, prev.stability);
    difficulty = nextDifficulty(prev.difficulty, rating);
    stability = rating === 1 ? forgetStability(prev.difficulty, prev.stability, r) : recallStability(prev.difficulty, prev.stability, r, rating);
    // same-day re-reviews shouldn't inflate stability much
    if (elapsed === 0 && rating > 1) stability = Math.max(prev.stability, Math.min(stability, prev.stability * 1.3 + 0.2));
  }
  stability = Math.max(0.1, Math.round(stability * 100) / 100);
  const days = rating === 1 ? 0 : Math.min(MAX_INTERVAL, Math.max(1, Math.round(intervalFor(stability, retention))));
  return {
    ...card,
    stability,
    difficulty: Math.round(difficulty * 100) / 100,
    lastReview: today,
    due: addDaysKey(today, days),
    box: boxFor(stability),
    reps: card.reps + 1,
    lapses: card.lapses + (rating === 1 ? 1 : 0),
  };
}

/** What each button would do, for the "Good · 4d" labels. */
export function preview(card: Card, today: string, retention = DEFAULT_RETENTION): Record<Rating, number> {
  const out = {} as Record<Rating, number>;
  for (const g of [1, 2, 3, 4] as Rating[]) out[g] = diffDays(today, schedule(card, g, today, retention).due);
  return out;
}

export function formatInterval(days: number): string {
  if (days <= 0) return 'now';
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${Math.round((days / 365) * 10) / 10}y`;
}
