// Small "instant" games: Hi-Lo, Plinko, Keno, Mines, Dice, Big Six wheel, Scratch cards.
import { randInt, shuffle, weighted, type Rng, cryptoRng } from './rng';

/** House edge applied to the probability-priced games (Hi-Lo, Mines, Dice). */
export const EDGE = 0.03;

// ---------- Hi-Lo ----------
/** Chance the next card (infinite deck, ranks 2–14) is strictly higher / lower. Ties lose. */
export function hiloChance(rank: number, dir: 'higher' | 'lower'): number {
  return dir === 'higher' ? (14 - rank) / 13 : (rank - 2) / 13;
}
export function hiloMultiplier(rank: number, dir: 'higher' | 'lower'): number {
  const p = hiloChance(rank, dir);
  return p <= 0 ? 0 : Math.floor(((1 - EDGE) / p) * 100) / 100;
}
export function drawRank(rng: Rng = cryptoRng): number {
  return randInt(13, rng) + 2;
}

// ---------- Plinko ----------
export type PlinkoRisk = 'low' | 'medium' | 'high';
export const PLINKO_ROWS = 12;
export const PLINKO_TABLE: Record<PlinkoRisk, number[]> = {
  low: [10, 3, 1.6, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 1.6, 3, 10],
  medium: [33, 11, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 11, 33],
  high: [170, 24, 8.1, 2, 0.7, 0.2, 0.2, 0.2, 0.7, 2, 8.1, 24, 170],
};
/** Returns the path (0 = left, 1 = right per row) and the bucket index. */
export function dropPlinko(rng: Rng = cryptoRng): { path: number[]; bucket: number } {
  const path = Array.from({ length: PLINKO_ROWS }, () => (rng() < 0.5 ? 0 : 1));
  return { path, bucket: path.reduce<number>((a, b) => a + b, 0) };
}

// ---------- Keno ----------
export const KENO_NUMBERS = 40;
export const KENO_DRAWN = 10;
/** Paytable: picks → hits → multiplier (× bet, stake included). About 94% return at every pick count. */
export const KENO_PAYS: Record<number, Record<number, number>> = {
  1: { 1: 3.8 },
  2: { 1: 1.2, 2: 8.6 },
  3: { 2: 3.9, 3: 33 },
  4: { 2: 2.1, 3: 8.4, 4: 70 },
  5: { 2: 1.3, 3: 3.9, 4: 20, 5: 197 },
  6: { 3: 3.8, 4: 11, 5: 76, 6: 756 },
  7: { 3: 2, 4: 6, 5: 40, 6: 199, 7: 1994 },
  8: { 3: 1.7, 4: 3.4, 5: 14, 6: 85, 7: 510, 8: 3399 },
  9: { 4: 4.4, 5: 11, 6: 44, 7: 218, 8: 1746, 9: 8730 },
  10: { 4: 3.1, 5: 6.2, 6: 21, 7: 104, 8: 624, 9: 4159, 10: 16636 },
};
export function drawKeno(rng: Rng = cryptoRng): number[] {
  return shuffle(Array.from({ length: KENO_NUMBERS }, (_, i) => i + 1), rng).slice(0, KENO_DRAWN);
}
export function kenoMultiplier(picks: number[], drawn: number[]): { hits: number; multiplier: number } {
  const set = new Set(drawn);
  const hits = picks.filter((p) => set.has(p)).length;
  return { hits, multiplier: KENO_PAYS[picks.length]?.[hits] ?? 0 };
}

// ---------- Mines ----------
export const MINES_TILES = 25;
export function placeMines(count: number, rng: Rng = cryptoRng): Set<number> {
  return new Set(shuffle(Array.from({ length: MINES_TILES }, (_, i) => i), rng).slice(0, count));
}
function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
  return r;
}
/** Cash-out multiplier after `safe` safe picks with `mines` mines on the board. */
export function minesMultiplier(mines: number, safe: number): number {
  if (safe === 0) return 1;
  const p = choose(MINES_TILES - mines, safe) / choose(MINES_TILES, safe);
  return Math.floor(((1 - EDGE) / p) * 100) / 100;
}

// ---------- Dice ----------
/** Roll 0.00–99.99. Win when the roll is under (or over) the target. */
export function rollPercent(rng: Rng = cryptoRng): number {
  return randInt(10000, rng) / 100;
}
export function diceChance(target: number, mode: 'under' | 'over'): number {
  return mode === 'under' ? target / 100 : (100 - target) / 100;
}
export function diceMultiplier(target: number, mode: 'under' | 'over'): number {
  const p = diceChance(target, mode);
  return p <= 0 ? 0 : Math.floor(((1 - EDGE) / p) * 10000) / 10000;
}
export function diceWins(roll: number, target: number, mode: 'under' | 'over'): boolean {
  return mode === 'under' ? roll < target : roll >= target;
}

// ---------- Big Six wheel ----------
export interface WheelSegment {
  id: string;
  label: string;
  pays: number; // x:1
  count: number;
}
export const WHEEL_SEGMENTS: WheelSegment[] = [
  { id: '1', label: '1', pays: 1, count: 24 },
  { id: '2', label: '2', pays: 2, count: 15 },
  { id: '5', label: '5', pays: 5, count: 7 },
  { id: '10', label: '10', pays: 10, count: 4 },
  { id: '20', label: '20', pays: 20, count: 2 },
  { id: 'joker', label: '🃏', pays: 40, count: 1 },
  { id: 'star', label: '⭐', pays: 40, count: 1 },
];
/** Wheel layout (54 slots) spreading segments out like a real Big Six wheel. */
export const WHEEL_LAYOUT: string[] = (() => {
  const out: string[] = [];
  const left = new Map(WHEEL_SEGMENTS.map((s) => [s.id, s.count]));
  const total = WHEEL_SEGMENTS.reduce((a, s) => a + s.count, 0);
  for (let i = 0; i < total; i++) {
    // pick the segment most "behind" its ideal share so far
    let best = WHEEL_SEGMENTS[0].id;
    let score = -Infinity;
    for (const s of WHEEL_SEGMENTS) {
      if ((left.get(s.id) ?? 0) <= 0) continue;
      const placed = s.count - left.get(s.id)!;
      const sc = ((i + 1) * s.count) / total - placed;
      if (sc > score) {
        score = sc;
        best = s.id;
      }
    }
    out.push(best);
    left.set(best, left.get(best)! - 1);
  }
  return out;
})();
export function spinWheel(rng: Rng = cryptoRng): number {
  return randInt(WHEEL_LAYOUT.length, rng);
}

// ---------- Scratch cards ----------
export const SCRATCH_PRIZES = [
  { mult: 0, weight: 706 },
  { mult: 1, weight: 150 },
  { mult: 2, weight: 90 },
  { mult: 5, weight: 36 },
  { mult: 10, weight: 14 },
  { mult: 50, weight: 3 },
  { mult: 100, weight: 1 },
];
export const SCRATCH_SYMBOLS = ['🍀', '💎', '⭐', '🔔', '🍒', '👑', '🎁'];
/** A 3×3 card: three matching symbols win that symbol's prize. Losing cards never show three of a kind. */
export function makeScratchCard(rng: Rng = cryptoRng): { cells: string[]; mult: number } {
  const tier = weighted(SCRATCH_PRIZES.map((p) => p.weight), rng);
  const mult = SCRATCH_PRIZES[tier].mult;
  const cells: string[] = [];
  if (mult > 0) {
    const sym = SCRATCH_SYMBOLS[tier - 1];
    cells.push(sym, sym, sym);
    // fill the rest with at most two of any other symbol
    const others = SCRATCH_SYMBOLS.filter((s) => s !== sym);
    const pool = shuffle([...others, ...others], rng).slice(0, 6);
    cells.push(...pool);
  } else {
    const pool = shuffle([...SCRATCH_SYMBOLS, ...SCRATCH_SYMBOLS], rng).slice(0, 9);
    cells.push(...pool);
  }
  return { cells: shuffle(cells, rng), mult };
}
export function scratchPrizeFor(symbol: string): number {
  const i = SCRATCH_SYMBOLS.indexOf(symbol);
  return i >= 0 ? SCRATCH_PRIZES[i + 1]?.mult ?? 0 : 0;
}
