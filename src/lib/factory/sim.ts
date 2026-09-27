// Orebelt simulation: one fixed tick moves the whole factory forward (power, production, belts), and
// catchUp() fast-forwards the time you were away. tick() mutates the state it's given and reports what happened.
import { BELTS, BUILDING, CAMP_POWER, nodeAt, OFFLINE_CAP, PURITY, RECIPE, RESOURCE_ITEM, REWARD, powerAt, type Inv, type ItemId } from './data';
import { accepts, inCap, outCap, type Building, type FactoryState } from './state';

export const TICK = 1; // seconds

export type Status = 'ok' | 'starved' | 'blocked' | 'power' | 'off' | 'idle' | 'nofuel';

export interface BuildingReport {
  st: Status;
  /** Share of the building's target rate reached (0–1). */
  eff: number;
  /** MW drawn (consumers) or produced (generators). */
  mw: number;
}
export interface TickReport {
  dt: number;
  power: { capacity: number; demand: number; factor: number; max: number };
  buildings: Record<number, BuildingReport>;
  /** Items per minute on each belt this tick, and the main item carried. */
  belts: Record<number, { rate: number; item?: ItemId }>;
  made: Inv;
  used: Inv;
  stocked: Inv;
  boost: number;
}

const EPS = 1e-9;

export function beltRate(tier: number): number {
  return BELTS[Math.max(0, Math.min(BELTS.length - 1, tier - 1))].rate;
}

/** Speed multiplier from homework boosts and bought rush orders. */
export function boostMult(s: Pick<FactoryState, 'boostLeft' | 'rushLeft'>): number {
  return (s.boostLeft > 0 ? REWARD.boostMult : 1) * (s.rushLeft > 0 ? RUSH_MULT : 1);
}
export const RUSH_MULT = 1.5;

/** Items per minute a miner makes at its clock (before power and boosts). */
export function minerRate(b: Building): number {
  const def = BUILDING[b.type];
  const node = nodeAt(b.x, b.y);
  if (!node || !def.rate) return 0;
  return def.rate * PURITY[node.purity] * b.clock;
}

/** MW a consumer draws at full activity. */
export function fullPower(b: Building): number {
  const def = BUILDING[b.type];
  if (b.off || def.power <= 0) return 0;
  if (def.kind === 'producer' && !b.recipe) return 0;
  return powerAt(def.power, b.clock);
}

const add = (inv: Inv, k: ItemId, n: number) => {
  if (n > 0) inv[k] = (inv[k] ?? 0) + n;
};

export function tick(s: FactoryState, dt = TICK): TickReport {
  const rep: TickReport = { dt, power: { capacity: CAMP_POWER, demand: 0, factor: 1, max: 0 }, buildings: {}, belts: {}, made: {}, used: {}, stocked: {}, boost: boostMult(s) };
  const boost = rep.boost;

  // 1. power: demand from last tick's activity (idle machines still draw 10%), capacity from fuelled generators
  const genFrac = new Map<number, number>();
  for (const b of s.buildings) {
    const def = BUILDING[b.type];
    if (def.kind === 'generator') {
      if (b.off) continue;
      const need = (def.gen!.burn * b.clock * dt) / 60;
      const frac = need > 0 ? Math.min(1, (b.inBuf[def.gen!.fuel] ?? 0) / need) : 0;
      genFrac.set(b.id, frac);
      rep.power.capacity += def.gen!.mw * b.clock * frac;
    } else {
      const full = fullPower(b);
      rep.power.max += full;
      rep.power.demand += full * Math.max(0.1, b.act ?? 1);
    }
  }
  const factor = rep.power.demand > rep.power.capacity + EPS ? rep.power.capacity / rep.power.demand : 1;
  rep.power.factor = factor;
  const load = rep.power.capacity > CAMP_POWER ? Math.min(1, Math.max(0, rep.power.demand - CAMP_POWER) / (rep.power.capacity - CAMP_POWER)) : 0;

  // 2. production
  for (const b of s.buildings) {
    const def = BUILDING[b.type];
    if (def.kind === 'camp' || def.kind === 'depot') continue;
    if (def.kind === 'generator') {
      if (b.off) {
        rep.buildings[b.id] = { st: 'off', eff: 0, mw: 0 };
        continue;
      }
      const frac = genFrac.get(b.id) ?? 0;
      const fuel = def.gen!.fuel;
      const burn = ((def.gen!.burn * b.clock * dt) / 60) * frac * load;
      b.inBuf[fuel] = Math.max(0, (b.inBuf[fuel] ?? 0) - burn);
      add(rep.used, fuel, burn);
      rep.buildings[b.id] = { st: frac < 0.999 ? 'nofuel' : 'ok', eff: frac, mw: def.gen!.mw * b.clock * frac * load };
      continue;
    }
    if (b.off) {
      rep.buildings[b.id] = { st: 'off', eff: 0, mw: 0 };
      b.act = 0;
      continue;
    }
    const mw = fullPower(b) * Math.max(0.1, b.act ?? 1) * factor;
    if (def.kind === 'miner') {
      const node = nodeAt(b.x, b.y);
      if (!node) {
        rep.buildings[b.id] = { st: 'idle', eff: 0, mw: 0 };
        continue;
      }
      const it = RESOURCE_ITEM[node.res];
      const pot = (minerRate(b) * boost * dt) / 60;
      const space = Math.max(0, outCap(b, it) - (b.outBuf[it] ?? 0));
      const done = Math.min(pot * factor, space);
      b.outBuf[it] = (b.outBuf[it] ?? 0) + done;
      add(rep.made, it, done);
      b.act = pot > 0 ? Math.min(1, space / pot) : 0;
      rep.buildings[b.id] = { st: statusOf(pot, pot * factor, Infinity, space, done), eff: pot > 0 ? done / pot : 0, mw };
      continue;
    }
    // producer
    const rec = b.recipe ? RECIPE[b.recipe] : undefined;
    if (!rec) {
      rep.buildings[b.id] = { st: 'idle', eff: 0, mw: 0 };
      b.act = 0;
      continue;
    }
    const pot = (dt * b.clock * boost) / rec.time;
    let limIn = Infinity;
    for (const [k, n] of Object.entries(rec.in) as [ItemId, number][]) limIn = Math.min(limIn, (b.inBuf[k] ?? 0) / n);
    let limOut = Infinity;
    for (const [k, n] of Object.entries(rec.out) as [ItemId, number][]) limOut = Math.min(limOut, Math.max(0, outCap(b, k) - (b.outBuf[k] ?? 0)) / n);
    const done = Math.max(0, Math.min(pot * factor, limIn, limOut));
    for (const [k, n] of Object.entries(rec.in) as [ItemId, number][]) {
      b.inBuf[k] = Math.max(0, (b.inBuf[k] ?? 0) - n * done);
      add(rep.used, k, n * done);
    }
    for (const [k, n] of Object.entries(rec.out) as [ItemId, number][]) {
      b.outBuf[k] = (b.outBuf[k] ?? 0) + n * done;
      add(rep.made, k, n * done);
    }
    b.act = pot > 0 ? Math.min(1, limIn / pot, limOut / pot) : 0;
    rep.buildings[b.id] = { st: statusOf(pot, pot * factor, limIn, limOut, done), eff: pot > 0 ? Math.min(1, done / pot) : 0, mw };
  }

  // 3. belts: each source shares its output between its belts, fairly, limited by belt speed and room at the other end
  moveBelts(s, dt, rep);

  // 4. bookkeeping
  for (const [k, n] of Object.entries(rep.made) as [ItemId, number][]) s.made[k] = (s.made[k] ?? 0) + n;
  s.simTime += dt;
  s.boostLeft = Math.max(0, s.boostLeft - dt);
  s.rushLeft = Math.max(0, s.rushLeft - dt);
  return rep;
}

function statusOf(pot: number, powered: number, limIn: number, limOut: number, done: number): Status {
  if (pot <= 0) return 'idle';
  if (done >= pot * 0.999) return 'ok';
  const m = Math.min(powered, limIn, limOut);
  if (limOut <= m + EPS) return 'blocked';
  if (limIn <= m + EPS) return 'starved';
  return 'power';
}

function moveBelts(s: FactoryState, dt: number, rep: TickReport): void {
  const byId = new Map(s.buildings.map((b) => [b.id, b]));
  const bySource = new Map<number, typeof s.belts>();
  for (const belt of s.belts) {
    rep.belts[belt.id] = { rate: 0 };
    const list = bySource.get(belt.from);
    if (list) list.push(belt);
    else bySource.set(belt.from, [belt]);
  }
  const left = new Map(s.belts.map((b) => [b.id, (beltRate(b.tier) * dt) / 60]));
  const moved = new Map<number, Map<ItemId, number>>();
  for (const [srcId, belts] of bySource) {
    const src = byId.get(srcId);
    if (!src) continue;
    for (const [item, have] of Object.entries(src.outBuf) as [ItemId, number][]) {
      if (have <= EPS) continue;
      const reqs = belts.map((belt) => {
        const dst = byId.get(belt.to);
        if (!dst || !accepts(dst, item)) return 0;
        const space = Math.max(0, inCap(dst, item) - (dst.inBuf[item] ?? 0));
        return Math.max(0, Math.min(left.get(belt.id)!, space));
      });
      const total = reqs.reduce((a, x) => a + x, 0);
      if (total <= EPS) continue;
      const share = Math.min(1, have / total);
      belts.forEach((belt, i) => {
        const n = reqs[i] * share;
        if (n <= EPS) return;
        const dst = byId.get(belt.to)!;
        src.outBuf[item] = Math.max(0, (src.outBuf[item] ?? 0) - n);
        const dk = BUILDING[dst.type].kind;
        if (dk === 'camp' || dk === 'depot') {
          s.inv[item] = (s.inv[item] ?? 0) + n;
          add(rep.stocked, item, n);
        } else dst.inBuf[item] = (dst.inBuf[item] ?? 0) + n;
        left.set(belt.id, left.get(belt.id)! - n);
        let m = moved.get(belt.id);
        if (!m) moved.set(belt.id, (m = new Map()));
        m.set(item, (m.get(item) ?? 0) + n);
      });
    }
  }
  for (const [id, m] of moved) {
    let total = 0;
    let top: ItemId | undefined;
    let topN = 0;
    for (const [k, n] of m) {
      total += n;
      if (n > topN) [top, topN] = [k, n];
    }
    rep.belts[id] = { rate: (total * 60) / dt, item: top };
  }
}

export interface AwaySummary {
  seconds: number;
  gained: Inv;
  /** Seconds of the absence that were simulated tick by tick (the rest is extrapolated). */
  simulated: number;
}

/** Tick-by-tick seconds before extrapolating the rest of a long absence. */
export const CATCHUP_TICKS = 1200;

/**
 * Fast-forward an absence: the first 20 minutes run tick by tick, then the rest is extrapolated from the steady rate
 * reached (the second half of the simulated stretch). Capped at 8 hours (plus any bought extra).
 */
export function catchUp(s: FactoryState, seconds: number, maxTicks = CATCHUP_TICKS): AwaySummary {
  const cap = OFFLINE_CAP + s.extraOffline;
  const total = Math.max(0, Math.min(Math.floor(seconds), cap));
  if (seconds > OFFLINE_CAP) s.extraOffline = 0; // the bought extra covers one long absence
  const before = { ...s.inv };
  const sim = Math.min(total, maxTicks);
  const half = Math.floor(sim / 2);
  let mid: Inv = before;
  for (let i = 0; i < sim; i++) {
    if (i === half) mid = { ...s.inv };
    tick(s, TICK);
  }
  const rest = total - sim;
  if (rest > 0 && sim - half > 0) {
    const window = sim - half;
    for (const k of Object.keys(s.inv) as ItemId[]) {
      const rate = ((s.inv[k] ?? 0) - (mid[k] ?? 0)) / window;
      if (rate > 0) s.inv[k] = (s.inv[k] ?? 0) + rate * rest;
    }
    // the factory kept running: count it as produced too
    s.simTime += rest;
    s.boostLeft = Math.max(0, s.boostLeft - rest);
    s.rushLeft = Math.max(0, s.rushLeft - rest);
  }
  const gained: Inv = {};
  for (const k of Object.keys(s.inv) as ItemId[]) {
    const d = (s.inv[k] ?? 0) - (before[k] ?? 0);
    if (d > 0.5) gained[k] = d;
  }
  return { seconds: total, gained, simulated: sim };
}
