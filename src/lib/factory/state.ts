// Orebelt game state: the saved shape, a fresh game, and what's unlocked. Pure functions only.
import { BUILDING, CAMP, MILESTONE, RECIPE, RESEARCH, START_INV, START_UNLOCKS, type BuildingId, type Inv, type ItemId, type Resource } from './data';

/** Output side: 0 = east, 1 = south, 2 = west, 3 = north. Inputs come in on the opposite side. */
export type Dir = 0 | 1 | 2 | 3;

export interface Building {
  id: number;
  type: BuildingId;
  x: number;
  y: number;
  rot: Dir;
  recipe?: string;
  /** Clock speed, 0.01–2.5 (1 = 100%). */
  clock: number;
  /** Overclock shards slotted in (one per 50% above 100%). */
  shards: number;
  /** Paused by the player. */
  off?: boolean;
  inBuf: Inv;
  outBuf: Inv;
  /** Share of last tick's potential that inputs/outputs allowed (drives power draw). Not important to save. */
  act?: number;
}

export interface Belt {
  id: number;
  from: number;
  to: number;
  tier: number;
}

export interface FactoryState {
  v: number;
  /** Wall-clock ms of the last simulated second. */
  lastSeen: number;
  /** Seconds simulated in total. */
  simTime: number;
  nextId: number;
  buildings: Building[];
  belts: Belt[];
  /** Your stock (what reached the Base Camp or a depot). */
  inv: Inv;
  milestones: string[];
  research: string[];
  /** Launch Tower phases delivered, and what's been delivered towards the current one. */
  phase: number;
  delivered: Inv;
  /** Free overclock shards (not slotted into a building). */
  shards: number;
  insight: number;
  /** Seconds of homework production boost left. */
  boostLeft: number;
  /** Seconds of a bought rush order left (+50% speed). */
  rushLeft: number;
  /** Extra seconds of offline progress bought for the next long absence. */
  extraOffline: number;
  /** Everything ever produced (for stats). */
  made: Inv;
  /** Market: fractional coins earned but not yet paid out. */
  credit: number;
  /** Homework rewards applied so far. */
  rewards: { tasks: number; study: number };
}

export const FACTORY_VERSION = 2;

export function newGame(now: number): FactoryState {
  return {
    v: FACTORY_VERSION,
    lastSeen: now,
    simTime: 0,
    nextId: 2,
    buildings: [{ id: 1, type: 'camp', x: CAMP.x, y: CAMP.y, rot: 0, clock: 1, shards: 0, inBuf: {}, outBuf: {} }],
    belts: [],
    inv: { ...START_INV },
    milestones: [],
    research: [],
    phase: 0,
    delivered: {},
    shards: 0,
    insight: 0,
    boostLeft: 0,
    rushLeft: 0,
    extraOffline: 0,
    made: {},
    credit: 0,
    rewards: { tasks: 0, study: 0 },
  };
}

export interface UnlockSet {
  buildings: Set<BuildingId>;
  recipes: Set<string>;
  resources: Set<Resource>;
  belt: number;
  tier: number;
}

/** Everything unlocked by the milestones done and the research finished. */
export function unlocked(s: Pick<FactoryState, 'milestones' | 'research' | 'phase'>): UnlockSet {
  const u: UnlockSet = {
    buildings: new Set(START_UNLOCKS.buildings),
    recipes: new Set(START_UNLOCKS.recipes),
    resources: new Set(START_UNLOCKS.resources),
    belt: START_UNLOCKS.belt,
    tier: s.phase,
  };
  for (const id of s.milestones) {
    const m = MILESTONE[id];
    if (!m) continue;
    m.unlock.buildings?.forEach((b) => u.buildings.add(b));
    m.unlock.recipes?.forEach((r) => u.recipes.add(r));
    m.unlock.resources?.forEach((r) => u.resources.add(r));
    if (m.unlock.belt) u.belt = Math.max(u.belt, m.unlock.belt);
  }
  for (const id of s.research) {
    const x = RESEARCH.find((r) => r.id === id);
    if (x) u.recipes.add(x.recipe);
  }
  return u;
}

// ---------- inventory helpers ----------
export function has(inv: Inv, cost: Inv, times = 1): boolean {
  return (Object.entries(cost) as [ItemId, number][]).every(([k, n]) => (inv[k] ?? 0) + 1e-9 >= n * times);
}
export function take(inv: Inv, cost: Inv, times = 1): void {
  for (const [k, n] of Object.entries(cost) as [ItemId, number][]) inv[k] = Math.max(0, (inv[k] ?? 0) - n * times);
}
export function give(inv: Inv, gain: Inv, times = 1): void {
  for (const [k, n] of Object.entries(gain) as [ItemId, number][]) inv[k] = (inv[k] ?? 0) + n * times;
}
export function scaleCost(cost: Inv, times: number): Inv {
  const out: Inv = {};
  for (const [k, n] of Object.entries(cost) as [ItemId, number][]) out[k] = Math.ceil(n * times - 1e-9);
  return out;
}

export function buildingAt(s: FactoryState, x: number, y: number): Building | undefined {
  return s.buildings.find((b) => b.x === x && b.y === y);
}
export function byId(s: FactoryState, id: number): Building | undefined {
  return s.buildings.find((b) => b.id === id);
}

/** Does this building take this item in on a belt? */
export function accepts(b: Building, item: ItemId): boolean {
  const def = BUILDING[b.type];
  if (def.kind === 'camp' || def.kind === 'depot') return true;
  if (def.kind === 'generator') return def.gen!.fuel === item;
  if (def.kind === 'producer') {
    const r = b.recipe ? RECIPE[b.recipe] : undefined;
    return !!r && item in r.in;
  }
  return false;
}

/** Max items of one kind a building holds in its input buffer. */
export function inCap(b: Building, item: ItemId): number {
  const def = BUILDING[b.type];
  if (def.kind === 'generator') return 50;
  if (def.kind === 'producer' && b.recipe) {
    const need = RECIPE[b.recipe]?.in[item] ?? 0;
    return Math.max(need * 2, 10);
  }
  return Infinity;
}
/** Max items of one kind a building holds in its output buffer. */
export function outCap(b: Building, item: ItemId): number {
  const def = BUILDING[b.type];
  if (def.kind === 'miner') return 40;
  if (def.kind === 'producer' && b.recipe) return Math.max((RECIPE[b.recipe]?.out[item] ?? 0) * 2, 20);
  return 0;
}
