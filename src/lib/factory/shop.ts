// Orebelt coin shop: spend the coins earned from homework on a few factory advantages. Each offer has a daily limit
// so coins speed things up without replacing play. Purchases are logged in the app's ledger as 'factory:<id>'.
import { PHASES, type Inv, type ItemId } from './data';
import { give, type FactoryState } from './state';
import type { LedgerLike } from './market';

export type OfferId = 'crate' | 'rush' | 'nightShift' | 'shard' | 'grant' | 'cargo';

export interface CoinOffer {
  id: OfferId;
  name: string;
  desc: string;
  price: number;
  perDay: number;
}

export const RUSH_SECONDS = 30 * 60;
export const RUSH_CAP = 60 * 60;
export const NIGHT_SHIFT = 4 * 60 * 60;
export const CARGO_SHARE = 0.2;

export const COIN_SHOP: CoinOffer[] = [
  { id: 'crate', name: 'Supply crate', desc: 'A crate of parts for your current tier, dropped at the Base Camp.', price: 15, perDay: 3 },
  { id: 'rush', name: 'Rush order', desc: '+50% speed for every miner and machine for 30 minutes.', price: 25, perDay: 2 },
  { id: 'nightShift', name: 'Night shift', desc: '+4 h of offline progress for your next long absence (8 h → 12 h).', price: 10, perDay: 1 },
  { id: 'shard', name: 'Overclock shard', desc: 'One extra shard to push a machine past 100%.', price: 30, perDay: 1 },
  { id: 'grant', name: 'Research grant', desc: '+1 insight for alternate recipes.', price: 20, perDay: 1 },
  { id: 'cargo', name: 'Cargo lift', desc: 'Delivers 20% of the current Launch Tower phase for you.', price: 40, perDay: 1 },
];
export const OFFER: Record<OfferId, CoinOffer> = Object.fromEntries(COIN_SHOP.map((o) => [o.id, o])) as Record<OfferId, CoinOffer>;

/** Supply crate contents by tier. */
export const CRATES: Inv[] = [
  { ironPlate: 60, ironRod: 40, wire: 40 },
  { ironPlate: 100, screw: 200, concrete: 40, reinforcedPlate: 10 },
  { reinforcedPlate: 30, rotor: 15, trussFrame: 8, cable: 60 },
  { steelBeam: 40, steelPipe: 60, motor: 6, concreteBeam: 10 },
  { plastic: 120, rubber: 120, motor: 15, heavyChassis: 3 },
  { circuitBoard: 30, computer: 5, controlUnit: 5, heavyChassis: 5 },
];
export function crateFor(tier: number): Inv {
  return CRATES[Math.max(0, Math.min(CRATES.length - 1, tier))];
}

export function ledgerReason(id: OfferId): string {
  return `factory:${id}`;
}

/** How many times an offer was bought today (ledger entries with reason 'factory:<id>' and ref = the day). */
export function boughtToday(ledger: readonly LedgerLike[], id: OfferId, day: string): number {
  const reason = ledgerReason(id);
  return ledger.filter((e) => e.reason === reason && e.currency === 'coins' && e.amount < 0 && e.ref === day).length;
}

export type Check = { ok: true } | { ok: false; error: string };

export function canBuyOffer(s: FactoryState, id: OfferId, coins: number, bought: number): Check {
  const o = OFFER[id];
  if (!o) return { ok: false, error: 'Unknown offer' };
  if (bought >= o.perDay) return { ok: false, error: `Limit ${o.perDay} a day` };
  if (coins < o.price) return { ok: false, error: `Needs ${o.price} coins` };
  if (id === 'rush' && s.rushLeft + RUSH_SECONDS > RUSH_CAP + 1) return { ok: false, error: 'A rush order is already running' };
  if (id === 'nightShift' && s.extraOffline >= NIGHT_SHIFT) return { ok: false, error: 'Already booked' };
  if (id === 'cargo' && s.phase >= PHASES.length) return { ok: false, error: 'The Launch Tower is finished' };
  return { ok: true };
}

/** Apply a paid offer to the game. Returns a short line for the toast. */
export function applyOffer(s: FactoryState, id: OfferId): string {
  switch (id) {
    case 'crate':
      give(s.inv, crateFor(s.phase));
      return 'Supply crate unpacked at the Base Camp';
    case 'rush':
      s.rushLeft = Math.min(RUSH_CAP, s.rushLeft + RUSH_SECONDS);
      return 'Rush order: +50% speed for 30 minutes';
    case 'nightShift':
      s.extraOffline = NIGHT_SHIFT;
      return 'Night shift booked: up to 12 h of offline progress next time';
    case 'shard':
      s.shards += 1;
      return '+1 overclock shard';
    case 'grant':
      s.insight += 1;
      return '+1 insight';
    case 'cargo': {
      const p = PHASES[s.phase];
      if (!p) return '';
      for (const [k, n] of Object.entries(p.cost) as [ItemId, number][]) s.delivered[k] = Math.min(n, (s.delivered[k] ?? 0) + Math.ceil(n * CARGO_SHARE));
      if ((Object.entries(p.cost) as [ItemId, number][]).every(([k, n]) => (s.delivered[k] ?? 0) >= n)) {
        s.phase++;
        s.delivered = {};
        s.shards += p.shards;
        return `Cargo lift finished ${p.name}!`;
      }
      return `Cargo lift delivered 20% of ${p.name}`;
    }
  }
}
