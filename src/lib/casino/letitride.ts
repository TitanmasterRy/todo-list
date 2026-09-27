// Let It Ride: three equal bets, three cards each plus two community cards. After seeing your three cards you may
// pull back bet 1; after the first community card, bet 2. Bet 3 always rides. Standard paytable on the final five
// cards (pair of tens or better), about 3.5% house edge per unit with the basic strategy below.
import { shuffledDeck, type PlayingCard } from './cards';
import { evalHand, type HandCat, type HandValue } from './poker';
import { type Rng, cryptoRng } from './rng';

export type LirHand = 'royal' | HandCat | 'tensOrBetter' | 'nothing';

/** Paid to 1 on every bet still riding (stake returned on top). */
export const LIR_PAYTABLE: { hand: Exclude<LirHand, 'high' | 'pair' | 'nothing'>; label: string; pays: number }[] = [
  { hand: 'royal', label: 'Royal flush', pays: 1000 },
  { hand: 'straightFlush', label: 'Straight flush', pays: 200 },
  { hand: 'four', label: 'Four of a kind', pays: 50 },
  { hand: 'fullHouse', label: 'Full house', pays: 11 },
  { hand: 'flush', label: 'Flush', pays: 8 },
  { hand: 'straight', label: 'Straight', pays: 5 },
  { hand: 'three', label: 'Three of a kind', pays: 3 },
  { hand: 'twoPair', label: 'Two pair', pays: 2 },
  { hand: 'tensOrBetter', label: 'Pair of 10s or better', pays: 1 },
];

/** The paying class of a five-card hand. */
export function lirHand(v: HandValue): LirHand {
  if (v.cat === 'straightFlush') return v.ranks[0] === 14 ? 'royal' : 'straightFlush';
  if (v.cat === 'pair') return v.ranks[0] >= 10 ? 'tensOrBetter' : 'nothing';
  if (v.cat === 'high') return 'nothing';
  return v.cat;
}

export function lirPays(hand: LirHand): number {
  return LIR_PAYTABLE.find((p) => p.hand === hand)?.pays ?? 0;
}

const HIGH = (r: number) => r >= 10;

/** Does this partial hand already pay (pair of tens or better, trips)? */
function paying(cards: PlayingCard[]): boolean {
  const counts = new Map<number, number>();
  for (const c of cards) counts.set(c.rank, (counts.get(c.rank) ?? 0) + 1);
  for (const [r, n] of counts) if (n >= 3 || (n === 2 && r >= 10)) return true;
  // two pair among four cards
  return [...counts.values()].filter((n) => n >= 2).length >= 2;
}

/** Smallest number of gaps for suited cards to make a straight flush (ace high or low), or -1. */
function sfGaps(cards: PlayingCard[]): number {
  if (!cards.every((c) => c.suit === cards[0].suit)) return -1;
  const ranks = cards.map((c) => c.rank);
  if (new Set(ranks).size !== ranks.length) return -1;
  let best = -1;
  for (const lowAce of [false, true]) {
    const r = ranks.map((x) => (x === 14 && lowAce ? 1 : x));
    const span = Math.max(...r) - Math.min(...r);
    if (span <= 4) {
      const gaps = span + 1 - r.length;
      if (best < 0 || gaps < best) best = gaps;
    }
  }
  return best;
}

/** Basic strategy for the first decision (three cards): true = let it ride, false = pull the bet back. */
export function rideFirst(cards: PlayingCard[]): boolean {
  if (paying(cards)) return true;
  const gaps = sfGaps(cards);
  if (gaps < 0) return false;
  const ranks = cards.map((c) => c.rank).sort((a, b) => a - b);
  const highs = ranks.filter(HIGH).length;
  if (highs === 3) return true; // three to a royal
  if (gaps === 0) return ranks.join() !== '2,3,4' && ranks.join() !== '2,3,14';
  if (gaps === 1) return highs >= 1;
  return highs >= 2;
}

/** Basic strategy for the second decision (your three cards and the first community card). */
export function rideSecond(cards: PlayingCard[]): boolean {
  if (paying(cards)) return true;
  if (cards.every((c) => c.suit === cards[0].suit)) return true; // four to a flush
  const ranks = [...new Set(cards.map((c) => c.rank))].sort((a, b) => a - b);
  if (ranks.length !== 4) return false;
  // four in a row that can be completed at either end
  if (ranks[3] - ranks[0] === 3 && ranks[0] >= 2 && ranks[3] <= 13) return true;
  // four to an inside straight (one gap, or A-2-3-4 / J-Q-K-A) with four high cards
  const inside = ranks[3] - ranks[0] === 4 || (ranks[3] === 14 && ranks[2] <= 5) || (ranks[0] === 11 && ranks[3] === 14);
  return inside && ranks.every(HIGH);
}

export interface LirRound {
  deck: PlayingCard[];
  player: PlayingCard[];
  community: PlayingCard[]; // two cards, revealed one at a time
  unit: number; // each of the three bets
  riding: [boolean, boolean, boolean];
  step: 1 | 2 | 'done';
  hand?: LirHand;
  value?: HandValue;
  payout: number; // chips returned, stakes included
}

export function lirDeal(unit: number, rng: Rng = cryptoRng): LirRound {
  const deck = shuffledDeck(1, rng);
  const player = deck.splice(0, 3);
  const community = deck.splice(0, 2);
  return { deck, player, community, unit, riding: [true, true, true], step: 1, payout: 0 };
}

/** Decide on the current bet: let it ride or pull it back. Returns the next state. */
export function lirDecide(r: LirRound, ride: boolean): LirRound {
  if (r.step === 'done') return r;
  const riding = [...r.riding] as LirRound['riding'];
  riding[r.step - 1] = ride;
  if (r.step === 1) return { ...r, riding, step: 2 };
  return lirSettle({ ...r, riding });
}

export function lirSettle(r: LirRound): LirRound {
  const value = evalHand([...r.player, ...r.community]);
  const hand = lirHand(value);
  const bets = r.riding.filter(Boolean).length * r.unit;
  const payout = lirPays(hand) > 0 ? bets * (lirPays(hand) + 1) : 0;
  return { ...r, step: 'done', value, hand, payout };
}

/** Chips pulled back (returned before the showdown). */
export function lirReturned(r: LirRound): number {
  return r.riding.filter((x) => !x).length * r.unit;
}
