// Poker hand evaluation shared by Let It Ride and Texas Hold'em: the best five-card hand out of 5–7 cards,
// as a single comparable score (higher wins, equal scores split). Pure and exhaustively tested.
import type { PlayingCard } from './cards';

/** Hand categories, weakest first. */
export const HAND_CATS = ['high', 'pair', 'twoPair', 'three', 'straight', 'flush', 'fullHouse', 'four', 'straightFlush'] as const;
export type HandCat = (typeof HAND_CATS)[number];

export const HAND_LABEL: Record<HandCat, string> = {
  high: 'High card',
  pair: 'Pair',
  twoPair: 'Two pair',
  three: 'Three of a kind',
  straight: 'Straight',
  flush: 'Flush',
  fullHouse: 'Full house',
  four: 'Four of a kind',
  straightFlush: 'Straight flush',
};

export interface HandValue {
  cat: HandCat;
  /** comparable: category first, then the deciding ranks */
  score: number;
  /** the deciding ranks, most important first (e.g. pair rank, then kickers) */
  ranks: number[];
}

/** Highest card of a straight in a rank bitmask (bit r set for rank r; the ace also plays low), or 0. */
export function straightHigh(mask: number): number {
  const m = mask & (1 << 14) ? mask | 2 : mask; // ace low = bit 1
  for (let hi = 14; hi >= 5; hi--) {
    const run = 0b11111 << (hi - 4);
    if ((m & run) === run) return hi;
  }
  return 0;
}

function score(catIdx: number, ranks: number[]): number {
  let s = catIdx;
  for (let i = 0; i < 5; i++) s = s * 16 + (ranks[i] ?? 0);
  return s;
}

function value(cat: HandCat, ranks: number[]): HandValue {
  return { cat, ranks, score: score(HAND_CATS.indexOf(cat), ranks) };
}

/** Best five-card poker hand out of 5 to 7 cards. */
export function evalHand(cards: PlayingCard[]): HandValue {
  const counts = new Array<number>(15).fill(0);
  const suitMasks: Record<string, number> = {};
  const suitCounts: Record<string, number> = {};
  let mask = 0;
  for (const c of cards) {
    counts[c.rank]++;
    mask |= 1 << c.rank;
    suitMasks[c.suit] = (suitMasks[c.suit] ?? 0) | (1 << c.rank);
    suitCounts[c.suit] = (suitCounts[c.suit] ?? 0) + 1;
  }
  const flushSuit = Object.keys(suitCounts).find((s) => suitCounts[s] >= 5);
  if (flushSuit) {
    const sf = straightHigh(suitMasks[flushSuit]);
    if (sf) return value('straightFlush', [sf]);
  }
  // ranks grouped by count, high first
  const quads: number[] = [];
  const trips: number[] = [];
  const pairs: number[] = [];
  const singles: number[] = [];
  for (let r = 14; r >= 2; r--) {
    if (counts[r] === 4) quads.push(r);
    else if (counts[r] === 3) trips.push(r);
    else if (counts[r] === 2) pairs.push(r);
    else if (counts[r] === 1) singles.push(r);
  }
  const highest = (exclude: number[], n: number): number[] => {
    const out: number[] = [];
    for (let r = 14; r >= 2 && out.length < n; r--) if (counts[r] > 0 && !exclude.includes(r)) out.push(r);
    return out;
  };
  if (quads.length) return value('four', [quads[0], ...highest([quads[0]], 1)]);
  if (trips.length && (trips.length > 1 || pairs.length)) {
    const t = trips[0];
    const p = Math.max(trips[1] ?? 0, pairs[0] ?? 0);
    return value('fullHouse', [t, p]);
  }
  if (flushSuit) {
    const out: number[] = [];
    for (let r = 14; r >= 2 && out.length < 5; r--) if (suitMasks[flushSuit] & (1 << r)) out.push(r);
    return value('flush', out);
  }
  const st = straightHigh(mask);
  if (st) return value('straight', [st]);
  if (trips.length) return value('three', [trips[0], ...highest([trips[0]], 2)]);
  if (pairs.length >= 2) return value('twoPair', [pairs[0], pairs[1], ...highest([pairs[0], pairs[1]], 1)]);
  if (pairs.length) return value('pair', [pairs[0], ...highest([pairs[0]], 3)]);
  return value('high', highest([], 5));
}

/** Compare two hands: positive when `a` wins, negative when `b` wins, 0 for a split. */
export function compareHands(a: PlayingCard[], b: PlayingCard[]): number {
  return evalHand(a).score - evalHand(b).score;
}

/** "Pair of kings", "Flush, ace high", "Straight to the 9". */
export function describeHand(v: HandValue): string {
  const n = (r: number) =>
    ({ 14: 'aces', 13: 'kings', 12: 'queens', 11: 'jacks', 10: 'tens', 9: 'nines', 8: 'eights', 7: 'sevens', 6: 'sixes', 5: 'fives', 4: 'fours', 3: 'threes', 2: 'twos' })[r];
  const one = (r: number) => ({ 14: 'ace', 13: 'king', 12: 'queen', 11: 'jack' })[r] ?? String(r);
  switch (v.cat) {
    case 'straightFlush':
      return v.ranks[0] === 14 ? 'Royal flush' : `Straight flush to the ${one(v.ranks[0])}`;
    case 'four':
      return `Four ${n(v.ranks[0])}`;
    case 'fullHouse':
      return `Full house, ${n(v.ranks[0])} over ${n(v.ranks[1])}`;
    case 'flush':
      return `Flush, ${one(v.ranks[0])} high`;
    case 'straight':
      return `Straight to the ${one(v.ranks[0])}`;
    case 'three':
      return `Three ${n(v.ranks[0])}`;
    case 'twoPair':
      return `Two pair, ${n(v.ranks[0])} and ${n(v.ranks[1])}`;
    case 'pair':
      return `Pair of ${n(v.ranks[0])}`;
    default:
      return `${one(v.ranks[0])[0].toUpperCase()}${one(v.ranks[0]).slice(1)} high`;
  }
}
