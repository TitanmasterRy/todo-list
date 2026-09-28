// Orebelt daily contracts: three delivery orders a day, the same on every device for the same day and tier,
// progress counted from what reaches your stock, paid in shards or insight (never coins).
import { ITEM, ITEMS, type Inv, type ItemId } from './data';
import type { FactoryState } from './state';

export interface Contract {
  id: string;
  item: ItemId;
  qty: number;
  reward: { shards?: number; insight?: number };
}

export interface ContractLedger {
  day: string;
  done: string[];
  /** Units stocked today per contract item (fractional: belts move part-units each tick). */
  progress: Record<string, number>;
}

/** The fields contracts touch; FactoryState carries them once the save shape lands. */
export type ContractState = FactoryState & { contracts: ContractLedger; lifetime: { launches: number; contracts: number; relaunches: number } };

export const CONTRACT_COUNT = 3;
const MIN_QTY = 20;
const MAX_QTY = 200;

/** FNV-1a of a string to [0, 1); ours so the pick doesn't drift if the quest hash ever changes. */
export function hash01(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0) / 4294967296;
}

const round5 = (n: number) => Math.round(n / 5) * 5;

/** Today's three contracts: crafted items up to one tier above the player's, so a new player can fill them. */
export function contractsFor(day: string, tier: number): Contract[] {
  const pool = ITEMS.filter((i) => i.tier >= 1 && i.tier <= tier + 1);
  const ranked = pool.map((i) => ({ i, r: hash01(`${day}:${i.id}`) })).sort((a, b) => a.r - b.r);
  return ranked.slice(0, CONTRACT_COUNT).map(({ i }) => {
    const h = hash01(`${day}:${i.id}:qty`);
    const k = hash01(`${day}:${i.id}:reward`);
    // more per order as you climb tiers, fewer of the pricier parts
    const qty = Math.max(MIN_QTY, Math.min(MAX_QTY, round5((20 * (tier + 1) * (1 + h) * 2) / (i.tier + 1))));
    const reward = k < 0.5 ? { shards: k < 0.15 ? 2 : 1 } : { insight: 2 + Math.floor((k - 0.5) * 6) };
    return { id: `${day}:${i.id}`, item: i.id, qty, reward };
  });
}

/** Start a fresh ledger when the day changes. */
function roll(s: ContractState, day: string): void {
  if (s.contracts.day === day) return;
  s.contracts = { day, done: [], progress: {} };
}

/** Count this tick's stocked items towards today's contracts. Call it with each tick report's `stocked`. */
export function trackStocked(s: ContractState, stocked: Inv, day: string): void {
  roll(s, day);
  for (const c of contractsFor(day, s.phase)) {
    const n = stocked[c.item] ?? 0;
    if (n > 0) s.contracts.progress[c.item] = (s.contracts.progress[c.item] ?? 0) + n;
  }
}

export function contractProgress(s: Pick<ContractState, 'contracts'>, c: Contract): number {
  return Math.min(c.qty, Math.floor(s.contracts.progress[c.item] ?? 0));
}

export function isClaimed(s: Pick<ContractState, 'contracts'>, c: Contract): boolean {
  return s.contracts.done.includes(c.id);
}

export function canClaim(s: Pick<ContractState, 'contracts'>, c: Contract): boolean {
  return c.id.startsWith(`${s.contracts.day}:`) && !isClaimed(s, c) && contractProgress(s, c) >= c.qty;
}

/** Claim a filled contract: pays its reward once and counts it for achievements. */
export function claimContract(s: ContractState, c: Contract, day: string): { ok: boolean; error?: string } {
  roll(s, day);
  if (!c.id.startsWith(`${day}:`)) return { ok: false, error: 'That contract has expired' };
  if (isClaimed(s, c)) return { ok: false, error: 'Already claimed' };
  if (contractProgress(s, c) < c.qty) return { ok: false, error: `Deliver ${c.qty} ${ITEM[c.item].name} first` };
  s.contracts.done.push(c.id);
  s.shards += c.reward.shards ?? 0;
  s.insight += c.reward.insight ?? 0;
  s.lifetime.contracts += 1;
  return { ok: true };
}
