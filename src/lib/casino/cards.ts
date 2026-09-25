import { shuffle, type Rng, cryptoRng } from './rng';

export type Suit = '♠' | '♥' | '♦' | '♣';
export interface PlayingCard {
  rank: number; // 2–14 (11 J, 12 Q, 13 K, 14 A)
  suit: Suit;
}
export const SUITS: Suit[] = ['♠', '♥', '♦', '♣'];

export function newDeck(decks = 1): PlayingCard[] {
  const out: PlayingCard[] = [];
  for (let d = 0; d < decks; d++) for (const suit of SUITS) for (let rank = 2; rank <= 14; rank++) out.push({ rank, suit });
  return out;
}

export function shuffledDeck(decks = 1, rng: Rng = cryptoRng): PlayingCard[] {
  return shuffle(newDeck(decks), rng);
}

export function rankLabel(rank: number): string {
  return rank <= 10 ? String(rank) : ({ 11: 'J', 12: 'Q', 13: 'K', 14: 'A' } as Record<number, string>)[rank];
}

export function isRed(c: PlayingCard): boolean {
  return c.suit === '♥' || c.suit === '♦';
}

export function cardLabel(c: PlayingCard): string {
  return `${rankLabel(c.rank)}${c.suit}`;
}
