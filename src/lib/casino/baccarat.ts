import { shuffledDeck, type PlayingCard } from './cards';
import { type Rng, cryptoRng } from './rng';

export type BaccaratBet = 'player' | 'banker' | 'tie';

export function bacValue(c: PlayingCard): number {
  if (c.rank === 14) return 1;
  if (c.rank >= 10) return 0;
  return c.rank;
}
export function bacTotal(cards: PlayingCard[]): number {
  return cards.reduce((s, c) => s + bacValue(c), 0) % 10;
}

export interface BaccaratRound {
  player: PlayingCard[];
  banker: PlayingCard[];
  winner: BaccaratBet;
}

/** Deal one coup with the standard third-card rules (punto banco). */
export function playBaccarat(rng: Rng = cryptoRng, deck: PlayingCard[] = shuffledDeck(8, rng)): BaccaratRound {
  const d = [...deck];
  const player = [d.pop()!, d.pop()!];
  const banker = [d.pop()!, d.pop()!];
  const pt = bacTotal(player);
  const bt = bacTotal(banker);
  if (pt < 8 && bt < 8) {
    let playerThird: PlayingCard | undefined;
    if (pt <= 5) {
      playerThird = d.pop()!;
      player.push(playerThird);
    }
    if (bankerDraws(bacTotal(banker), playerThird ? bacValue(playerThird) : undefined)) banker.push(d.pop()!);
  }
  const p = bacTotal(player);
  const b = bacTotal(banker);
  return { player, banker, winner: p > b ? 'player' : b > p ? 'banker' : 'tie' };
}

/** Banker's drawing rule. playerThird is undefined when the player stood. */
export function bankerDraws(bankerTotal: number, playerThird: number | undefined): boolean {
  if (playerThird === undefined) return bankerTotal <= 5;
  if (bankerTotal <= 2) return true;
  if (bankerTotal === 3) return playerThird !== 8;
  if (bankerTotal === 4) return playerThird >= 2 && playerThird <= 7;
  if (bankerTotal === 5) return playerThird >= 4 && playerThird <= 7;
  if (bankerTotal === 6) return playerThird === 6 || playerThird === 7;
  return false;
}

/** Total returned for a bet. Banker pays 0.95:1, tie 8:1; player/banker bets push on a tie. */
export function settleBaccarat(bet: BaccaratBet, amount: number, winner: BaccaratBet): number {
  if (winner === 'tie') return bet === 'tie' ? amount * 9 : amount;
  if (bet !== winner) return 0;
  return bet === 'banker' ? amount + Math.floor(amount * 0.95) : amount * 2;
}
