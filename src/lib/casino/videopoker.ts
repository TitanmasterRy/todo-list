import { shuffledDeck, type PlayingCard } from './cards';
import { type Rng, cryptoRng } from './rng';

export type PokerHand =
  | 'royal'
  | 'straightFlush'
  | 'four'
  | 'fullHouse'
  | 'flush'
  | 'straight'
  | 'three'
  | 'twoPair'
  | 'jacksOrBetter'
  | 'nothing';

/** Jacks or Better, full-pay 9/6 (≈99.5% return with perfect play). Multipliers × bet, stake included. */
export const VP_PAYTABLE: Record<PokerHand, number> = {
  royal: 250,
  straightFlush: 50,
  four: 25,
  fullHouse: 9,
  flush: 6,
  straight: 4,
  three: 3,
  twoPair: 2,
  jacksOrBetter: 1,
  nothing: 0,
};

export const VP_LABEL: Record<PokerHand, string> = {
  royal: 'Royal flush',
  straightFlush: 'Straight flush',
  four: 'Four of a kind',
  fullHouse: 'Full house',
  flush: 'Flush',
  straight: 'Straight',
  three: 'Three of a kind',
  twoPair: 'Two pair',
  jacksOrBetter: 'Jacks or better',
  nothing: 'No win',
};

export function evaluatePoker(hand: PlayingCard[]): PokerHand {
  const ranks = hand.map((c) => c.rank).sort((a, b) => a - b);
  const counts = new Map<number, number>();
  for (const r of ranks) counts.set(r, (counts.get(r) ?? 0) + 1);
  const groups = [...counts.values()].sort((a, b) => b - a);
  const flush = hand.every((c) => c.suit === hand[0].suit);
  const unique = [...counts.keys()].sort((a, b) => a - b);
  const wheel = unique.length === 5 && unique.join() === '2,3,4,5,14';
  const straight = unique.length === 5 && (unique[4] - unique[0] === 4 || wheel);
  if (straight && flush) return ranks[0] === 10 ? 'royal' : 'straightFlush';
  if (groups[0] === 4) return 'four';
  if (groups[0] === 3 && groups[1] === 2) return 'fullHouse';
  if (flush) return 'flush';
  if (straight) return 'straight';
  if (groups[0] === 3) return 'three';
  if (groups[0] === 2 && groups[1] === 2) return 'twoPair';
  if (groups[0] === 2) {
    const pair = [...counts.entries()].find(([, n]) => n === 2)![0];
    if (pair >= 11) return 'jacksOrBetter';
  }
  return 'nothing';
}

export interface VpState {
  deck: PlayingCard[];
  hand: PlayingCard[];
  held: boolean[];
  phase: 'hold' | 'done';
  result?: PokerHand;
  payout: number;
}

export function vpDeal(rng: Rng = cryptoRng): VpState {
  const deck = shuffledDeck(1, rng);
  const hand = deck.splice(0, 5);
  return { deck, hand, held: [false, false, false, false, false], phase: 'hold', payout: 0 };
}

export function vpDraw(s: VpState, bet: number): VpState {
  const deck = [...s.deck];
  const hand = s.hand.map((c, i) => (s.held[i] ? c : deck.shift()!));
  const result = evaluatePoker(hand);
  return { ...s, deck, hand, phase: 'done', result, payout: bet * VP_PAYTABLE[result] };
}
