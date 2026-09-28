// Orebelt player actions: build, dismantle, belts, recipes, clock speed, milestones, sectors, research, hand work
// and homework rewards. Each one checks the rules, mutates the state and returns { ok } or { ok: false, error }.
import {
  BELTS,
  BUILDING,
  ITEM,
  MAP_H,
  MAP_W,
  MAX_BELT_LEN,
  MAX_CLOCK,
  MILESTONE,
  MIN_CLOCK,
  PHASES,
  RECIPE,
  RESEARCH,
  RESOURCE_ITEM,
  REWARD,
  SECTOR,
  nodeAt,
  sectorAt,
  shardsFor,
  type BuildingId,
  type Inv,
  type ItemId,
} from './data';
import { MAX_TASK_SHARDS, PERK } from './prestige';
import { buildingAt, byId, give, has, scaleCost, take, unlocked, type Belt, type Building, type Dir, type FactoryState, type Result } from './state';

export type { Result } from './state';
const ok: Result = { ok: true };
const fail = (error: string): Result => ({ ok: false, error });

export const DIRS: [number, number][] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

// ---------- building ----------
export function canPlace(s: FactoryState, type: BuildingId, x: number, y: number, free = false): Result {
  const def = BUILDING[type];
  if (!def || type === 'camp') return fail('Unknown building');
  if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return fail('Off the map');
  if (!surveyed(s, x, y)) return fail('Survey that sector first');
  const u = unlocked(s);
  if (!u.buildings.has(type)) return fail(`${def.name} isn't unlocked yet`);
  if (buildingAt(s, x, y)) return fail('That tile is taken');
  const node = nodeAt(x, y);
  if (def.kind === 'miner') {
    if (!node) return fail(`${def.name} must sit on a resource node`);
    if (!def.mines!.includes(node.res)) return fail(`${def.name} can't work that node`);
    if (!u.resources.has(node.res)) return fail("You can't process that resource yet");
  } else if (node) return fail('Resource nodes are for miners and pumps');
  if (!free && !has(s.inv, def.cost)) return fail('Not enough parts');
  return ok;
}

/** Is this tile in a sector you've surveyed? */
export function surveyed(s: Pick<FactoryState, 'sectors'>, x: number, y: number): boolean {
  const sec = sectorAt(x, y);
  return !!sec && s.sectors.includes(sec.id);
}

export function place(s: FactoryState, type: BuildingId, x: number, y: number, rot: Dir = 0): Result & { id?: number } {
  const check = canPlace(s, type, x, y);
  if (!check.ok) return check;
  take(s.inv, BUILDING[type].cost);
  const b: Building = { id: s.nextId++, type, x, y, rot, clock: 1, shards: 0, inBuf: {}, outBuf: {} };
  s.buildings.push(b);
  return { ok: true, id: b.id };
}

export function dismantle(s: FactoryState, id: number): Result {
  const b = byId(s, id);
  if (!b) return fail('Nothing there');
  if (b.type === 'camp') return fail("The Base Camp can't be moved");
  for (const belt of s.belts.filter((x) => x.from === id || x.to === id)) removeBelt(s, belt.id);
  give(s.inv, BUILDING[b.type].cost);
  give(s.inv, b.inBuf);
  give(s.inv, b.outBuf);
  s.shards += b.shards;
  s.buildings = s.buildings.filter((x) => x.id !== id);
  return ok;
}

export function rotate(s: FactoryState, id: number): Result {
  const b = byId(s, id);
  if (!b) return fail('Nothing there');
  b.rot = ((b.rot + 1) % 4) as Dir;
  return ok;
}

const SINK = new Set(['camp', 'depot', 'storage']);

export function toggle(s: FactoryState, id: number): Result {
  const b = byId(s, id);
  if (!b || SINK.has(BUILDING[b.type].kind)) return fail('Nothing to switch');
  b.off = !b.off;
  return ok;
}

// ---------- belts ----------
export interface Pt {
  x: number;
  y: number;
}

/** A belt's route in tile units: out of the source's output side, one bend, into the destination's input side. */
export function beltPath(src: Pick<Building, 'x' | 'y' | 'rot'>, dst: Pick<Building, 'x' | 'y' | 'rot'>, anySide = false): Pt[] {
  const [sx, sy] = DIRS[src.rot];
  // sinks (camp, depots) take belts on whichever side faces the source
  const ex = src.x + 0.5 + sx * 0.5 - (dst.x + 0.5);
  const ey = src.y + 0.5 + sy * 0.5 - (dst.y + 0.5);
  const [dx, dy] = anySide && (ex || ey) ? (Math.abs(ex) >= Math.abs(ey) ? [-Math.sign(ex), 0] : [0, -Math.sign(ey)]) : DIRS[dst.rot];
  const a = { x: src.x + 0.5, y: src.y + 0.5 };
  const a1 = { x: a.x + sx * 0.5, y: a.y + sy * 0.5 };
  const d = { x: dst.x + 0.5, y: dst.y + 0.5 };
  const d1 = { x: d.x - dx * 0.5, y: d.y - dy * 0.5 };
  const corner = sx !== 0 ? { x: d1.x, y: a1.y } : { x: a1.x, y: d1.y };
  const pts = [a, a1, corner, d1, d];
  return pts.filter((p, i) => i === 0 || p.x !== pts[i - 1].x || p.y !== pts[i - 1].y);
}

export function beltLength(src: Pick<Building, 'x' | 'y'>, dst: Pick<Building, 'x' | 'y'>): number {
  return Math.max(1, Math.abs(src.x - dst.x) + Math.abs(src.y - dst.y));
}

export function beltCost(tier: number, length: number): Inv {
  return scaleCost(BELTS[tier - 1].cost, length);
}

export function canConnect(s: FactoryState, fromId: number, toId: number, tier: number): Result {
  const src = byId(s, fromId);
  const dst = byId(s, toId);
  if (!src || !dst) return fail('Pick two buildings');
  if (src.id === dst.id) return fail("A belt can't loop into the same building");
  const sd = BUILDING[src.type];
  const dd = BUILDING[dst.type];
  if (sd.outs <= 0) return fail(`${sd.name} has no output`);
  if (dd.ins <= 0) return fail(`${dd.name} takes no input`);
  if (s.belts.some((b) => b.from === src.id && b.to === dst.id)) return fail('Those are already connected');
  if (s.belts.filter((b) => b.from === src.id).length >= sd.outs) return fail(`${sd.name} has no free output (max ${sd.outs})`);
  if (s.belts.filter((b) => b.to === dst.id).length >= dd.ins) return fail(`${dd.name} has no free input (max ${dd.ins})`);
  if (tier < 1 || tier > unlocked(s).belt) return fail("That belt isn't unlocked yet");
  const len = beltLength(src, dst);
  if (len > MAX_BELT_LEN) return fail(`Too far: belts reach ${MAX_BELT_LEN} tiles`);
  if (!has(s.inv, beltCost(tier, len))) return fail('Not enough parts for the belt');
  return ok;
}

export function connect(s: FactoryState, fromId: number, toId: number, tier = 1): Result & { id?: number } {
  const check = canConnect(s, fromId, toId, tier);
  if (!check.ok) return check;
  take(s.inv, beltCost(tier, beltLength(byId(s, fromId)!, byId(s, toId)!)));
  const belt: Belt = { id: s.nextId++, from: fromId, to: toId, tier };
  s.belts.push(belt);
  return { ok: true, id: belt.id };
}

export function removeBelt(s: FactoryState, beltId: number): Result {
  const belt = s.belts.find((b) => b.id === beltId);
  if (!belt) return fail('No such belt');
  const src = byId(s, belt.from);
  const dst = byId(s, belt.to);
  if (src && dst) give(s.inv, beltCost(belt.tier, beltLength(src, dst)));
  s.belts = s.belts.filter((b) => b.id !== beltId);
  return ok;
}

export function upgradeBelt(s: FactoryState, beltId: number, tier: number): Result {
  const belt = s.belts.find((b) => b.id === beltId);
  if (!belt) return fail('No such belt');
  if (tier <= belt.tier) return fail('Already that fast');
  if (tier > unlocked(s).belt) return fail("That belt isn't unlocked yet");
  const len = beltLength(byId(s, belt.from)!, byId(s, belt.to)!);
  const cost = beltCost(tier, len);
  const refund = beltCost(belt.tier, len);
  const after = { ...s.inv };
  give(after, refund);
  if (!has(after, cost)) return fail('Not enough parts for the belt');
  give(s.inv, refund);
  take(s.inv, cost);
  belt.tier = tier;
  return ok;
}

/** Let only one item (or anything, with undefined) travel on a belt. */
export function setBeltFilter(s: FactoryState, beltId: number, item: ItemId | undefined): Result {
  const belt = s.belts.find((b) => b.id === beltId);
  if (!belt) return fail('No such belt');
  if (item !== undefined && !(item in ITEM)) return fail('Unknown item');
  if (item === undefined) delete belt.filter;
  else belt.filter = item;
  return ok;
}

// ---------- machines ----------
export function setRecipe(s: FactoryState, id: number, recipeId: string | undefined): Result {
  const b = byId(s, id);
  if (!b) return fail('Nothing there');
  if (recipeId !== undefined) {
    const rec = RECIPE[recipeId];
    if (!rec || rec.building !== b.type) return fail("That building can't make this");
    if (!unlocked(s).recipes.has(recipeId)) return fail("That recipe isn't unlocked yet");
  }
  if (b.recipe === recipeId) return ok;
  // whatever was inside goes back to your stock
  give(s.inv, b.inBuf);
  give(s.inv, b.outBuf);
  b.inBuf = {};
  b.outBuf = {};
  b.recipe = recipeId;
  b.act = 1;
  return ok;
}

/** Pick what a Loader pulls from your stock; whatever it was holding goes back. */
export function setLoaderItem(s: FactoryState, id: number, item: ItemId | undefined): Result {
  const b = byId(s, id);
  if (!b || BUILDING[b.type].kind !== 'loader') return fail("That isn't a loader");
  if (item !== undefined && !(item in ITEM)) return fail('Unknown item');
  if (b.item === item) return ok;
  give(s.inv, b.outBuf);
  b.outBuf = {};
  if (item === undefined) delete b.item;
  else b.item = item;
  b.act = 1;
  return ok;
}

/** Highest clock this building can reach with its own shards plus the free ones. */
export function maxClock(s: FactoryState, b: Building): number {
  return Math.min(MAX_CLOCK, 1 + 0.5 * (b.shards + s.shards));
}

/** Set the clock (0.01–2.5); slots or frees shards as needed. Returns the clock actually set. */
export function setClock(s: FactoryState, id: number, clock: number): number {
  const b = byId(s, id);
  if (!b || SINK.has(BUILDING[b.type].kind)) return 1;
  const c = Math.round(Math.max(MIN_CLOCK, Math.min(maxClock(s, b), clock)) * 100) / 100;
  const need = shardsFor(c);
  s.shards += b.shards - need;
  b.shards = need;
  b.clock = c;
  return c;
}

// ---------- progression ----------
export function canMilestone(s: FactoryState, id: string): Result {
  const m = MILESTONE[id];
  if (!m) return fail('Unknown milestone');
  if (s.milestones.includes(id)) return fail('Already done');
  if (m.tier > s.phase) return fail('Deliver the Launch Tower phase first');
  if (!has(s.inv, m.cost)) return fail('Not enough parts');
  return ok;
}

export function completeMilestone(s: FactoryState, id: string): Result {
  const check = canMilestone(s, id);
  if (!check.ok) return check;
  const m = MILESTONE[id];
  take(s.inv, m.cost);
  s.milestones.push(id);
  s.shards += m.unlock.shards ?? 0;
  return ok;
}

/** What the current Launch Tower phase still needs. */
export function phaseRemaining(s: FactoryState): Inv {
  const p = PHASES[s.phase];
  const out: Inv = {};
  if (!p) return out;
  for (const [k, n] of Object.entries(p.cost) as [ItemId, number][]) out[k] = Math.max(0, n - (s.delivered[k] ?? 0));
  return out;
}

/** Send what you have towards the current phase (partial deliveries count). */
export function deliverPhase(s: FactoryState, limit?: Inv): { ok: boolean; sent: Inv; completed: boolean } {
  const p = PHASES[s.phase];
  const sent: Inv = {};
  if (!p) return { ok: false, sent, completed: false };
  for (const [k, need] of Object.entries(phaseRemaining(s)) as [ItemId, number][]) {
    const n = Math.floor(Math.min(need, s.inv[k] ?? 0, limit ? (limit[k] ?? 0) : Infinity));
    if (n <= 0) continue;
    s.inv[k] = (s.inv[k] ?? 0) - n;
    s.delivered[k] = (s.delivered[k] ?? 0) + n;
    sent[k] = n;
  }
  const completed = Object.values(phaseRemaining(s)).every((n) => (n ?? 0) <= 0);
  if (completed) finishPhase(s);
  return { ok: Object.keys(sent).length > 0 || completed, sent, completed };
}

/** The current phase is done: next tier, its shards, and a launch counted when the tower is finished. */
export function finishPhase(s: FactoryState): void {
  const p = PHASES[s.phase];
  if (!p) return;
  s.phase++;
  s.delivered = {};
  s.shards += p.shards;
  if (s.phase >= PHASES.length) s.lifetime.launches++;
}

export function canSurvey(s: FactoryState, id: string): Result {
  const sec = SECTOR[id];
  if (!sec) return fail('Unknown sector');
  if (s.sectors.includes(id)) return fail('Already surveyed');
  if (sec.tier > s.phase) return fail(`Reach tier ${sec.tier} first`);
  if (s.insight < sec.insight) return fail(`Needs ${sec.insight} insight (finish homework to earn it)`);
  if (!has(s.inv, sec.cost)) return fail('Not enough parts');
  return ok;
}

/** Open a sector for building: costs parts and insight. */
export function surveySector(s: FactoryState, id: string): Result {
  const check = canSurvey(s, id);
  if (!check.ok) return check;
  const sec = SECTOR[id];
  take(s.inv, sec.cost);
  s.insight -= sec.insight;
  s.sectors.push(id);
  return ok;
}

/** Get a jammed belt moving again. */
export function clearJam(s: FactoryState): Result {
  if (!s.event || s.event.beltId === undefined) return fail('No belt is jammed');
  s.event = null;
  return ok;
}

export function canResearch(s: FactoryState, id: string): Result {
  const r = RESEARCH.find((x) => x.id === id);
  if (!r) return fail('Unknown research');
  if (s.research.includes(id)) return fail('Already researched');
  if (r.tier > s.phase) return fail(`Reach tier ${r.tier} first`);
  if (s.insight < r.insight) return fail(`Needs ${r.insight} insight (finish homework to earn it)`);
  if (!has(s.inv, r.cost)) return fail('Not enough parts');
  return ok;
}

export function doResearch(s: FactoryState, id: string): Result {
  const check = canResearch(s, id);
  if (!check.ok) return check;
  const r = RESEARCH.find((x) => x.id === id)!;
  take(s.inv, r.cost);
  s.insight -= r.insight;
  s.research.push(id);
  return ok;
}

// ---------- hand work (so you can never get stuck) ----------
export function handMine(s: FactoryState, x: number, y: number): Result {
  const node = nodeAt(x, y);
  if (!node) return fail('No resource here');
  if (!surveyed(s, x, y)) return fail('Survey that sector first');
  if (!unlocked(s).resources.has(node.res)) return fail("You can't process that resource yet");
  const it = RESOURCE_ITEM[node.res];
  s.inv[it] = (s.inv[it] ?? 0) + 1;
  return ok;
}

/** Workbench: one cycle of a smelter or constructor recipe, by hand, from your stock. */
export function benchCraft(s: FactoryState, recipeId: string): Result {
  const rec = RECIPE[recipeId];
  if (!rec || (rec.building !== 'smelter' && rec.building !== 'constructor')) return fail('That needs a machine');
  if (!unlocked(s).recipes.has(recipeId)) return fail("That recipe isn't unlocked yet");
  if (!has(s.inv, rec.in)) return fail('Not enough parts');
  take(s.inv, rec.in);
  give(s.inv, rec.out);
  return ok;
}

// ---------- homework ----------
/** Shards one finished task earns, with the Scholar perk counted. */
export function taskShards(s: Pick<FactoryState, 'perks'>): number {
  return Math.min(MAX_TASK_SHARDS, REWARD.task.shards + s.perks.reduce((n, id) => n + (PERK[id]?.effect.taskShards ?? 0), 0));
}

/** Apply rewards for tasks completed, study sessions (notecards, pomodoros) and good days (ring closed, streak) since the last visit. */
export function applyRewards(s: FactoryState, tasks: number, study: number, days = 0): { shards: number; insight: number; boost: number } {
  tasks = Math.max(0, Math.floor(tasks));
  study = Math.max(0, Math.floor(study));
  days = Math.max(0, Math.floor(days));
  const shards = tasks * taskShards(s) + study * REWARD.study.shards + days * REWARD.day.shards;
  const insight = tasks * REWARD.task.insight + study * REWARD.study.insight + days * REWARD.day.insight;
  const before = s.boostLeft;
  s.boostLeft = Math.min(REWARD.boostCap, s.boostLeft + tasks * REWARD.task.boost + study * REWARD.study.boost + days * REWARD.day.boost);
  s.shards += shards;
  s.insight += insight;
  s.rewards.tasks += tasks;
  s.rewards.study += study;
  return { shards, insight, boost: s.boostLeft - before };
}
