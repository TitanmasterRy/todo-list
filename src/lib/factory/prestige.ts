// Orebelt prestige: once the Launch Tower is finished you can relaunch, keeping stars to spend on permanent perks.
// Stars come from phases delivered and from how much the run produced. Pure functions on the game state.
import { CAMP, OFFLINE_CAP, PHASES, START_INV, type Inv } from './data';
import { give, type FactoryState, type Result } from './state';

export interface Perk {
  id: string;
  name: string;
  desc: string;
  /** Stars. */
  cost: number;
  effect: {
    /** Machine speed multiplier. */
    speed?: number;
    /** Miner rate multiplier. */
    miners?: number;
    /** Extra stock at relaunch. */
    headStart?: Inv;
    /** Research survives a relaunch. */
    archive?: boolean;
    /** Extra overclock shards per homework task. */
    taskShards?: number;
    /** Extra seconds of offline progress. */
    offline?: number;
  };
}

export const PERKS: Perk[] = [
  { id: 'swift', name: 'Swift', desc: 'Every machine runs 10% faster.', cost: 8, effect: { speed: 1.1 } },
  { id: 'deepDrills', name: 'Deep Drills', desc: 'Miners pull 20% more from every node.', cost: 8, effect: { miners: 1.2 } },
  { id: 'headStart', name: 'Head Start', desc: '+200 iron plates and rods at every relaunch.', cost: 4, effect: { headStart: { ironPlate: 200, ironRod: 200 } } },
  { id: 'archive', name: 'Archive', desc: 'Alternate recipes you researched stay unlocked after a relaunch.', cost: 10, effect: { archive: true } },
  { id: 'scholar', name: 'Scholar', desc: 'Each finished task earns 2 overclock shards instead of 1.', cost: 12, effect: { taskShards: 1 } },
  { id: 'nightOwl', name: 'Night Owl', desc: 'Offline progress runs for 10 hours instead of 8.', cost: 6, effect: { offline: 2 * 60 * 60 } },
];
export const PERK: Record<string, Perk> = Object.fromEntries(PERKS.map((p) => [p.id, p]));

/** Shards a completed task earns: one, or two with Scholar (never more). */
export const MAX_TASK_SHARDS = 2;

export const hasPerk = (s: Pick<FactoryState, 'perks'>, id: string): boolean => s.perks.includes(id);

export function perkSpeed(s: Pick<FactoryState, 'perks'>): number {
  return s.perks.reduce((m, id) => m * (PERK[id]?.effect.speed ?? 1), 1);
}
export function perkMiners(s: Pick<FactoryState, 'perks'>): number {
  return s.perks.reduce((m, id) => m * (PERK[id]?.effect.miners ?? 1), 1);
}
/** Seconds of offline progress this player gets (before any bought night shift). */
export function offlineCap(s: Pick<FactoryState, 'perks'>): number {
  return OFFLINE_CAP + s.perks.reduce((n, id) => n + (PERK[id]?.effect.offline ?? 0), 0);
}

/** Stars a relaunch would grant right now: two per phase delivered, plus a slow bonus for everything made this run. */
export function starsFor(s: Pick<FactoryState, 'phase' | 'madeTotal'>): number {
  return s.phase * 2 + Math.floor(Math.sqrt(Math.max(0, s.madeTotal) / 2000));
}

export const launched = (s: Pick<FactoryState, 'phase'>): boolean => s.phase >= PHASES.length;

export function canRelaunch(s: FactoryState): Result {
  if (!launched(s)) return { ok: false, error: 'Finish the Launch Tower first' };
  return { ok: true };
}

/**
 * Start over with stars in hand. Buildings (but the camp), belts, stock, milestones, phases, sectors and research go;
 * stars, perks, achievements, lifetime stats, homework rewards and the all-time `made` stay.
 */
export function relaunch(s: FactoryState): Result & { stars?: number } {
  const check = canRelaunch(s);
  if (!check.ok) return check;
  const stars = starsFor(s);
  s.stars += stars;
  s.runs++;
  s.lifetime.relaunches++;
  s.buildings = [{ id: 1, type: 'camp', x: CAMP.x, y: CAMP.y, rot: 0, clock: 1, shards: 0, inBuf: {}, outBuf: {} }];
  s.belts = [];
  s.nextId = 2;
  s.inv = { ...START_INV };
  for (const id of s.perks) give(s.inv, PERK[id]?.effect.headStart ?? {});
  s.milestones = [];
  if (!hasPerk(s, 'archive')) s.research = [];
  s.phase = 0;
  s.delivered = {};
  s.shards = 0;
  s.sectors = ['home'];
  s.event = null;
  s.madeTotal = 0;
  return { ok: true, stars };
}

export function canBuyPerk(s: FactoryState, id: string): Result {
  const p = PERK[id];
  if (!p) return { ok: false, error: 'Unknown perk' };
  if (hasPerk(s, id)) return { ok: false, error: 'Already yours' };
  if (s.stars < p.cost) return { ok: false, error: `Needs ${p.cost} stars` };
  return { ok: true };
}

export function buyPerk(s: FactoryState, id: string): Result {
  const check = canBuyPerk(s, id);
  if (!check.ok) return check;
  s.stars -= PERK[id].cost;
  s.perks.push(id);
  return { ok: true };
}
