import { randInt, type Rng, cryptoRng } from './rng';

// European single-zero wheel.
export const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
export const WHEEL_ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];

export type RouletteBet =
  { kind: 'straight'; n: number } | { kind: 'red' | 'black' | 'odd' | 'even' | 'low' | 'high' } | { kind: 'dozen'; d: 1 | 2 | 3 } | { kind: 'column'; c: 1 | 2 | 3 };

export function color(n: number): 'green' | 'red' | 'black' {
  return n === 0 ? 'green' : RED.has(n) ? 'red' : 'black';
}

/** Payout ratio (x:1) of a bet. */
export function payoutRatio(b: RouletteBet): number {
  switch (b.kind) {
    case 'straight':
      return 35;
    case 'dozen':
    case 'column':
      return 2;
    default:
      return 1;
  }
}

export function wins(b: RouletteBet, n: number): boolean {
  if (b.kind === 'straight') return b.n === n;
  if (n === 0) return false;
  switch (b.kind) {
    case 'red':
      return RED.has(n);
    case 'black':
      return !RED.has(n);
    case 'odd':
      return n % 2 === 1;
    case 'even':
      return n % 2 === 0;
    case 'low':
      return n <= 18;
    case 'high':
      return n >= 19;
    case 'dozen':
      return Math.ceil(n / 12) === b.d;
    case 'column':
      return ((n - 1) % 3) + 1 === b.c;
  }
}

export function betKey(b: RouletteBet): string {
  if (b.kind === 'straight') return `n${b.n}`;
  if (b.kind === 'dozen') return `d${b.d}`;
  if (b.kind === 'column') return `c${b.c}`;
  return b.kind;
}

export function betLabel(b: RouletteBet): string {
  if (b.kind === 'straight') return String(b.n);
  if (b.kind === 'dozen') return ['1st 12', '2nd 12', '3rd 12'][b.d - 1];
  if (b.kind === 'column') return `Column ${b.c}`;
  return { red: 'Red', black: 'Black', odd: 'Odd', even: 'Even', low: '1–18', high: '19–36' }[b.kind];
}

export function spinRoulette(rng: Rng = cryptoRng): number {
  return randInt(37, rng);
}

/** Total returned (stake + winnings) for a set of bets on a result. */
export function settleRoulette(bets: { bet: RouletteBet; amount: number }[], n: number): number {
  return bets.reduce((sum, { bet, amount }) => sum + (wins(bet, n) ? amount * (payoutRatio(bet) + 1) : 0), 0);
}
