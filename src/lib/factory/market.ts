// Orebelt market: sell late-game parts for a few of the app's coins. Capped per day so homework stays the main
// source of coins (and so the market can't fund the coin shop by itself).
import { ITEM, MARKET_DAILY_CAP, type ItemId } from './data';

export interface LedgerLike {
  currency: string;
  amount: number;
  reason: string;
  ref?: string;
}

/** Coins the market has paid out today (ledger reason 'factory', ref starting with the day). */
export function coinsPaidToday(ledger: readonly LedgerLike[], day: string): number {
  let n = 0;
  for (const e of ledger) if (e.reason === 'factory' && e.currency === 'coins' && e.amount > 0 && e.ref?.startsWith(day)) n += e.amount;
  return n;
}

export function roomToday(ledger: readonly LedgerLike[], day: string): number {
  return Math.max(0, MARKET_DAILY_CAP - coinsPaidToday(ledger, day));
}

export interface Quote {
  qty: number;
  coins: number;
  credit: number;
}

/**
 * Sell up to `qty` of an item: `credit` is the fractional coin carried over from earlier sales, `room` the coins
 * still payable today. Never sells more than fits under the cap.
 */
export function sellQuote(item: ItemId, have: number, qty: number, credit: number, room: number): Quote {
  const v = ITEM[item]?.value ?? 0;
  if (v <= 0) return { qty: 0, coins: 0, credit };
  let n = Math.max(0, Math.floor(Math.min(have, qty)));
  // the most that keeps the payout within today's room (the carried fraction stays below 1)
  const fits = Math.floor((room + 1 - credit) / v - 1e-9);
  n = Math.max(0, Math.min(n, fits));
  const total = credit + n * v;
  const coins = Math.min(room, Math.floor(total + 1e-9));
  return { qty: n, coins, credit: Math.max(0, Math.min(0.999, total - coins)) };
}
