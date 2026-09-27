// Three Card Poker: Ante / Play against the dealer, plus the optional Pair Plus side bet.
// Standard rules: the dealer qualifies with queen high or better; Ante bonus 5/4/1; Pair Plus 40/30/6/4/1.
import { shuffledDeck, type PlayingCard } from './cards';
import { type Rng, cryptoRng } from './rng';

/** Three-card categories, weakest first (a straight beats a flush with three cards). */
export const TC_CATS = ['high', 'pair', 'flush', 'straight', 'three', 'straightFlush'] as const;
export type TcCat = (typeof TC_CATS)[number];

export const TC_LABEL: Record<TcCat, string> = {
  high: 'High card',
  pair: 'Pair',
  flush: 'Flush',
  straight: 'Straight',
  three: 'Three of a kind',
  straightFlush: 'Straight flush',
};

/** Pair Plus pays on the player's hand alone (to 1, stake returned on top). Full-pay table: 2.3% house edge. */
export const PAIR_PLUS: Record<TcCat, number> = { straightFlush: 40, three: 30, straight: 6, flush: 4, pair: 1, high: 0 };
/** Ante bonus: paid on the Ante whenever the player plays, even if the dealer wins. */
export const ANTE_BONUS: Record<TcCat, number> = { straightFlush: 5, three: 4, straight: 1, flush: 0, pair: 0, high: 0 };

export interface TcValue {
  cat: TcCat;
  score: number;
  high: number; // highest rank (for the queen-high qualifier)
}

export function evalThree(cards: PlayingCard[]): TcValue {
  const r = cards.map((c) => c.rank).sort((a, b) => b - a);
  const flush = cards[0].suit === cards[1].suit && cards[1].suit === cards[2].suit;
  const trips = r[0] === r[2];
  const pairRank = r[0] === r[1] ? r[0] : r[1] === r[2] ? r[1] : 0;
  // A-2-3 is the lowest straight, A-K-Q the highest
  const wheel = r[0] === 14 && r[1] === 3 && r[2] === 2;
  const straight = !pairRank && !trips && (r[0] - r[2] === 2 || wheel);
  const top = wheel ? 3 : r[0];
  let cat: TcCat = 'high';
  let ranks = r;
  if (straight && flush) {
    cat = 'straightFlush';
    ranks = [top];
  } else if (trips) {
    cat = 'three';
    ranks = [r[0]];
  } else if (straight) {
    cat = 'straight';
    ranks = [top];
  } else if (flush) cat = 'flush';
  else if (pairRank) {
    cat = 'pair';
    ranks = [pairRank, r.find((x) => x !== pairRank)!];
  }
  let s = TC_CATS.indexOf(cat);
  for (let i = 0; i < 3; i++) s = s * 16 + (ranks[i] ?? 0);
  return { cat, score: s, high: r[0] };
}

/** The dealer needs queen high or better to open. */
export function dealerQualifies(v: TcValue): boolean {
  return v.cat !== 'high' || v.high >= 12;
}

/** Optimal simple strategy: play Q-6-4 or better, fold anything lower. */
export function shouldPlay(cards: PlayingCard[]): boolean {
  const v = evalThree(cards);
  if (v.cat !== 'high') return true;
  const r = cards.map((c) => c.rank).sort((a, b) => b - a);
  if (r[0] !== 12) return r[0] > 12;
  if (r[1] !== 6) return r[1] > 6;
  return r[2] >= 4;
}

export interface TcBets {
  ante: number;
  pairPlus: number;
}

export interface TcRound {
  deck: PlayingCard[];
  player: PlayingCard[];
  dealer: PlayingCard[];
  bets: TcBets;
  phase: 'decide' | 'done';
  played?: boolean;
  result?: TcResult;
}

export interface TcResult {
  player: TcValue;
  dealer: TcValue;
  qualified: boolean;
  outcome: 'fold' | 'noQualify' | 'win' | 'lose' | 'push';
  /** chips returned per bet, stakes included */
  ante: number;
  play: number;
  pairPlus: number;
  bonus: number;
  total: number;
}

export function tcDeal(bets: TcBets, rng: Rng = cryptoRng): TcRound {
  const deck = shuffledDeck(1, rng);
  const player = deck.splice(0, 3);
  const dealer = deck.splice(0, 3);
  return { deck, player, dealer, bets, phase: 'decide' };
}

/** Settle a round. `play` is true when the player matched the Ante with the Play bet. */
export function tcSettle(player: PlayingCard[], dealer: PlayingCard[], bets: TcBets, play: boolean): TcResult {
  const pv = evalThree(player);
  const dv = evalThree(dealer);
  const qualified = dealerQualifies(dv);
  if (!play) {
    // folding forfeits the Ante and the Pair Plus
    return { player: pv, dealer: dv, qualified, outcome: 'fold', ante: 0, play: 0, pairPlus: 0, bonus: 0, total: 0 };
  }
  const pairPlus = bets.pairPlus > 0 && PAIR_PLUS[pv.cat] > 0 ? bets.pairPlus * (PAIR_PLUS[pv.cat] + 1) : 0;
  const bonus = bets.ante * ANTE_BONUS[pv.cat];
  let ante = 0;
  let playBack = 0;
  let outcome: TcResult['outcome'];
  if (!qualified) {
    outcome = 'noQualify';
    ante = bets.ante * 2;
    playBack = bets.ante;
  } else if (pv.score > dv.score) {
    outcome = 'win';
    ante = bets.ante * 2;
    playBack = bets.ante * 2;
  } else if (pv.score < dv.score) outcome = 'lose';
  else {
    outcome = 'push';
    ante = bets.ante;
    playBack = bets.ante;
  }
  return { player: pv, dealer: dv, qualified, outcome, ante, play: playBack, pairPlus, bonus, total: ante + playBack + pairPlus + bonus };
}

export function tcFinish(r: TcRound, play: boolean): TcRound {
  return { ...r, phase: 'done', played: play, result: tcSettle(r.player, r.dealer, r.bets, play) };
}
