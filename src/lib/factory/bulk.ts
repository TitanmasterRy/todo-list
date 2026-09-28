// Orebelt mass tools: copy one machine's settings to another, upgrade every belt at once, pause or resume the whole
// floor. Built on the single-building actions so every rule check stays in one place.
import { beltCost, beltLength, setClock, setRecipe, toggle, upgradeBelt, type Result } from './actions';
import { BUILDING, type Inv, type ItemId } from './data';
import { byId, give, has, type FactoryState } from './state';

/** Copy the recipe and clock speed of one machine onto another of the same type. `clock` is what the target got. */
export function copySettings(s: FactoryState, fromId: number, toId: number): Result & { clock?: number } {
  const from = byId(s, fromId);
  const to = byId(s, toId);
  if (!from || !to) return { ok: false, error: 'Nothing there' };
  if (from.id === to.id) return { ok: false, error: "That's the same machine" };
  const def = BUILDING[from.type];
  if (def.kind === 'camp' || def.kind === 'depot') return { ok: false, error: `${def.name} has no settings to copy` };
  if (from.type !== to.type) return { ok: false, error: `Settings only copy between two ${def.name}s` };
  if (from.recipe !== to.recipe) {
    const r = setRecipe(s, toId, from.recipe);
    if (!r.ok) return r;
  }
  return { ok: true, clock: setClock(s, toId, from.clock) };
}

export interface UpgradeQuote {
  /** Belts below the target tier (with both ends still standing). */
  belts: number;
  /** Parts paid for the new belts, and parts refunded for the old ones. */
  cost: Inv;
  refund: Inv;
  /** What actually leaves your stock: cost minus refund, per part. */
  net: Inv;
  affordable: boolean;
}

/** What upgrading every slower belt to `tier` would take. */
export function quoteUpgradeAll(s: FactoryState, tier: number): UpgradeQuote {
  const cost: Inv = {};
  const refund: Inv = {};
  let belts = 0;
  for (const b of s.belts) {
    const src = byId(s, b.from);
    const dst = byId(s, b.to);
    if (!src || !dst || b.tier >= tier) continue;
    belts++;
    const len = beltLength(src, dst);
    give(cost, beltCost(tier, len));
    give(refund, beltCost(b.tier, len));
  }
  const net: Inv = {};
  for (const [k, n] of Object.entries(cost) as [ItemId, number][]) {
    const d = n - (refund[k] ?? 0);
    if (d > 0) net[k] = d;
  }
  const after = { ...s.inv };
  give(after, refund);
  return { belts, cost, refund, net, affordable: belts > 0 && has(after, cost) };
}

/** Upgrade every slower belt to `tier`, as far as your parts go. `cost` is what actually left your stock. */
export function upgradeAllBelts(s: FactoryState, tier: number): { upgraded: number; cost: Inv } {
  const before = { ...s.inv };
  let upgraded = 0;
  // short belts first so a tight budget upgrades as many as possible
  const todo = s.belts
    .filter((b) => b.tier < tier && byId(s, b.from) && byId(s, b.to))
    .sort((a, b) => beltLength(byId(s, a.from)!, byId(s, a.to)!) - beltLength(byId(s, b.from)!, byId(s, b.to)!));
  for (const b of todo) if (upgradeBelt(s, b.id, tier).ok) upgraded++;
  const cost: Inv = {};
  for (const k of new Set([...Object.keys(before), ...Object.keys(s.inv)]) as Set<ItemId>) {
    const d = (before[k] ?? 0) - (s.inv[k] ?? 0);
    if (d > 1e-9) cost[k] = d;
  }
  return { upgraded, cost };
}

const switchable = (s: FactoryState) => s.buildings.filter((b) => BUILDING[b.type].kind !== 'camp' && BUILDING[b.type].kind !== 'depot');

/** Pause every running machine. Returns how many were switched. */
export function pauseAll(s: FactoryState): number {
  let n = 0;
  for (const b of switchable(s)) if (!b.off && toggle(s, b.id).ok) n++;
  return n;
}

/** Resume every paused machine. Returns how many were switched. */
export function resumeAll(s: FactoryState): number {
  let n = 0;
  for (const b of switchable(s)) if (b.off && toggle(s, b.id).ok) n++;
  return n;
}
