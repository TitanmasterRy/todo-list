// Orebelt saves: localStorage JSON with a version number. migrate() upgrades older saves step by step and
// sanitizes anything broken or tampered with, so a bad save can never crash the game.
import { BUILDING, CAMP, ITEM, MAP_H, MAP_W, MAX_CLOCK, MILESTONE, MIN_CLOCK, PHASES, RECIPE, RESEARCH, shardsFor, type Inv, type ItemId } from './data';
import { FACTORY_VERSION, newGame, type Belt, type Building, type Dir, type FactoryState } from './state';

export const SAVE_KEY = 'homework-todo:factory';

type Raw = Record<string, unknown>;

/** One step per version: MIGRATIONS[n] turns a version-n save into version n + 1. */
export const MIGRATIONS: Record<number, (s: Raw) => Raw> = {
  // v1 (first release) kept clock speeds in percent and had no partial phase deliveries, rush orders or bought offline time
  1: (s) => ({
    ...s,
    v: 2,
    buildings: Array.isArray(s.buildings) ? s.buildings.map((b: Raw) => ({ ...b, clock: typeof b.clock === 'number' ? b.clock / 100 : 1 })) : [],
    delivered: {},
    rushLeft: 0,
    extraOffline: 0,
  }),
};

const num = (v: unknown, fallback: number, min = -Infinity, max = Infinity): number => (typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback);

function inv(v: unknown): Inv {
  const out: Inv = {};
  if (!v || typeof v !== 'object') return out;
  for (const [k, n] of Object.entries(v as Raw)) if (k in ITEM && typeof n === 'number' && Number.isFinite(n) && n > 0) out[k as ItemId] = n;
  return out;
}

/** Turn anything (an old save, a broken one, nothing) into a valid current-version state. */
export function migrate(raw: unknown, now: number): FactoryState {
  if (!raw || typeof raw !== 'object') return newGame(now);
  let s = raw as Raw;
  let v = num(s.v, 0);
  if (v < 1) return newGame(now);
  while (v < FACTORY_VERSION && MIGRATIONS[v]) {
    s = MIGRATIONS[v](s);
    v = num(s.v, v + 1);
  }
  return sanitize(s, now);
}

function sanitize(s: Raw, now: number): FactoryState {
  const fresh = newGame(now);
  const used = new Set<string>();
  const buildings: Building[] = [];
  let maxId = 1;
  for (const b of Array.isArray(s.buildings) ? (s.buildings as Raw[]) : []) {
    if (!b || typeof b !== 'object' || !(typeof b.type === 'string' && b.type in BUILDING)) continue;
    const x = Math.floor(num(b.x, -1));
    const y = Math.floor(num(b.y, -1));
    const id = Math.floor(num(b.id, 0));
    if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H || id < 1 || used.has(`${x},${y}`) || buildings.some((o) => o.id === id)) continue;
    const type = b.type as Building['type'];
    if (type === 'camp' && buildings.some((o) => o.type === 'camp')) continue;
    const recipe = typeof b.recipe === 'string' && RECIPE[b.recipe]?.building === type ? b.recipe : undefined;
    let clock = num(b.clock, 1, MIN_CLOCK, MAX_CLOCK);
    const shards = Math.floor(num(b.shards, 0, 0, 3));
    if (shardsFor(clock) > shards) clock = Math.min(clock, 1 + shards * 0.5);
    used.add(`${x},${y}`);
    maxId = Math.max(maxId, id);
    buildings.push({
      id,
      type,
      x,
      y,
      rot: (Math.floor(num(b.rot, 0, 0, 3)) % 4) as Dir,
      recipe,
      clock,
      shards,
      off: b.off === true || undefined,
      inBuf: inv(b.inBuf),
      outBuf: inv(b.outBuf),
    });
  }
  if (!buildings.some((b) => b.type === 'camp')) {
    const campId = maxId + 1;
    maxId = campId;
    // the camp's tile is always free of other buildings: drop anything squatting there
    const kept = buildings.filter((b) => !(b.x === CAMP.x && b.y === CAMP.y));
    buildings.length = 0;
    buildings.push({ id: campId, type: 'camp', x: CAMP.x, y: CAMP.y, rot: 0, clock: 1, shards: 0, inBuf: {}, outBuf: {} }, ...kept);
  }
  const ids = new Set(buildings.map((b) => b.id));
  const belts: Belt[] = [];
  for (const b of Array.isArray(s.belts) ? (s.belts as Raw[]) : []) {
    if (!b || typeof b !== 'object') continue;
    const id = Math.floor(num(b.id, 0));
    const from = Math.floor(num(b.from, 0));
    const to = Math.floor(num(b.to, 0));
    if (id < 1 || from === to || !ids.has(from) || !ids.has(to) || ids.has(id) || belts.some((o) => o.id === id || (o.from === from && o.to === to))) continue;
    maxId = Math.max(maxId, id);
    belts.push({ id, from, to, tier: Math.floor(num(b.tier, 1, 1, 5)) });
  }
  const strings = (v: unknown, valid: (x: string) => boolean) => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && valid(x)))] : []);
  const rewards = (s.rewards ?? {}) as Raw;
  return {
    v: FACTORY_VERSION,
    lastSeen: num(s.lastSeen, now, 0, now),
    simTime: num(s.simTime, 0, 0),
    nextId: Math.max(Math.floor(num(s.nextId, 0)), maxId + 1),
    buildings,
    belts,
    inv: s.inv === undefined ? fresh.inv : inv(s.inv),
    milestones: strings(s.milestones, (x) => x in MILESTONE),
    research: strings(s.research, (x) => RESEARCH.some((r) => r.id === x)),
    phase: Math.floor(num(s.phase, 0, 0, PHASES.length)),
    delivered: inv(s.delivered),
    shards: Math.floor(num(s.shards, 0, 0)),
    insight: Math.floor(num(s.insight, 0, 0)),
    boostLeft: num(s.boostLeft, 0, 0),
    rushLeft: num(s.rushLeft, 0, 0),
    extraOffline: num(s.extraOffline, 0, 0),
    made: inv(s.made),
    credit: num(s.credit, 0, 0, 1),
    rewards: { tasks: Math.floor(num(rewards.tasks, 0, 0)), study: Math.floor(num(rewards.study, 0, 0)) },
  };
}

/** The JSON that goes to storage (runtime-only fields left out). */
export function serialize(s: FactoryState): string {
  return JSON.stringify({ ...s, buildings: s.buildings.map(({ act: _act, ...b }) => b) });
}

export function loadGame(storage: Pick<Storage, 'getItem'> | undefined, now: number): FactoryState {
  try {
    const text = storage?.getItem(SAVE_KEY);
    return migrate(text ? JSON.parse(text) : null, now);
  } catch {
    return newGame(now);
  }
}

export function saveGame(storage: Pick<Storage, 'setItem'> | undefined, s: FactoryState): boolean {
  try {
    storage?.setItem(SAVE_KEY, serialize(s));
    return !!storage;
  } catch {
    return false;
  }
}
