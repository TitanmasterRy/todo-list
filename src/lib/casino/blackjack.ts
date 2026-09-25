import { shuffledDeck, type PlayingCard } from './cards';
import { type Rng, cryptoRng } from './rng';

export interface BjState {
  shoe: PlayingCard[];
  player: PlayingCard[];
  dealer: PlayingCard[];
  bet: number;
  doubled: boolean;
  phase: 'player' | 'done';
  outcome?: 'blackjack' | 'win' | 'push' | 'lose' | 'bust' | 'dealerBust';
  payout: number; // total returned to the player (0 on a loss, bet on a push)
}

export function cardValue(c: PlayingCard): number {
  if (c.rank === 14) return 11;
  return Math.min(10, c.rank);
}

/** Best total and whether an ace still counts as 11. */
export function handValue(cards: PlayingCard[]): { total: number; soft: boolean } {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    total += cardValue(c);
    if (c.rank === 14) aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return { total, soft: aces > 0 };
}

export function isBlackjack(cards: PlayingCard[]): boolean {
  return cards.length === 2 && handValue(cards).total === 21;
}

function draw(s: BjState, rng: Rng): PlayingCard {
  if (s.shoe.length < 15) s.shoe = shuffledDeck(6, rng);
  return s.shoe.pop()!;
}

export function deal(bet: number, shoe: PlayingCard[] | undefined, rng: Rng = cryptoRng): BjState {
  const s: BjState = { shoe: shoe && shoe.length >= 15 ? [...shoe] : shuffledDeck(6, rng), player: [], dealer: [], bet, doubled: false, phase: 'player', payout: 0 };
  s.player.push(draw(s, rng));
  s.dealer.push(draw(s, rng));
  s.player.push(draw(s, rng));
  s.dealer.push(draw(s, rng));
  if (isBlackjack(s.player) || isBlackjack(s.dealer)) return settle(s, rng, false);
  return s;
}

export function hit(prev: BjState, rng: Rng = cryptoRng): BjState {
  if (prev.phase !== 'player') return prev;
  const s = { ...prev, shoe: [...prev.shoe], player: [...prev.player] };
  s.player.push(draw(s, rng));
  const v = handValue(s.player).total;
  if (v > 21) return { ...s, phase: 'done', outcome: 'bust', payout: 0 };
  if (v === 21) return settle(s, rng, true);
  return s;
}

export function stand(prev: BjState, rng: Rng = cryptoRng): BjState {
  if (prev.phase !== 'player') return prev;
  return settle({ ...prev, shoe: [...prev.shoe] }, rng, true);
}

/** Double the bet, take exactly one card, then stand. Only on the first two cards. */
export function doubleDown(prev: BjState, rng: Rng = cryptoRng): BjState {
  if (prev.phase !== 'player' || prev.player.length !== 2) return prev;
  const s = { ...prev, shoe: [...prev.shoe], player: [...prev.player], bet: prev.bet * 2, doubled: true };
  s.player.push(draw(s, rng));
  if (handValue(s.player).total > 21) return { ...s, phase: 'done', outcome: 'bust', payout: 0 };
  return settle(s, rng, true);
}

/** Dealer draws to 17 and stands on soft 17, then compare. */
function settle(s: BjState, rng: Rng, dealerPlays: boolean): BjState {
  const pBj = isBlackjack(s.player) && !s.doubled;
  const dBj = isBlackjack(s.dealer);
  const dealer = [...s.dealer];
  const next = { ...s, dealer, phase: 'done' as const };
  if (pBj || dBj) {
    if (pBj && dBj) return { ...next, outcome: 'push', payout: s.bet };
    if (pBj) return { ...next, outcome: 'blackjack', payout: s.bet + Math.floor(s.bet * 1.5) };
    return { ...next, outcome: 'lose', payout: 0 };
  }
  if (dealerPlays) {
    while (handValue(dealer).total < 17) dealer.push(draw(next, rng));
  }
  const p = handValue(s.player).total;
  const d = handValue(dealer).total;
  if (d > 21) return { ...next, outcome: 'dealerBust', payout: s.bet * 2 };
  if (p > d) return { ...next, outcome: 'win', payout: s.bet * 2 };
  if (p === d) return { ...next, outcome: 'push', payout: s.bet };
  return { ...next, outcome: 'lose', payout: 0 };
}
