// Orebelt random events: a few minutes of better or worse luck (dust storms, rich seams, grid surges, a jammed belt).
// Everything is deterministic from simTime so saves and tests replay the same way, and events only start on live
// ticks, never while an absence is being caught up.
import { PHASES } from './data';
import type { FactoryState } from './state';

export interface GameEvent {
  id: string;
  name: string;
  desc: string;
  seconds: number;
  /** Rate multipliers while it runs. `belts` applies to the jammed belt only when one is named, else to every belt. */
  effect: { miners?: number; generators?: number; belts?: number };
  /** Launch Tower tier needed before it can happen. */
  minTier: number;
}

export const EVENTS: GameEvent[] = [
  { id: 'dust', name: 'Dust storm', desc: 'Grit in every drill: miners run at 75% for a while.', seconds: 5 * 60, effect: { miners: 0.75 }, minTier: 0 },
  { id: 'seam', name: 'Rich seam', desc: 'The drills hit a rich pocket: miners run at 150%.', seconds: 4 * 60, effect: { miners: 1.5 }, minTier: 0 },
  { id: 'surge', name: 'Grid surge', desc: 'Generators put out 125% while the surge lasts.', seconds: 5 * 60, effect: { generators: 1.25 }, minTier: 1 },
  { id: 'jam', name: 'Belt jam', desc: 'A belt has jammed and stopped. Clear it to get it moving again.', seconds: 15 * 60, effect: { belts: 0 }, minTier: 1 },
];
export const EVENT: Record<string, GameEvent> = Object.fromEntries(EVENTS.map((e) => [e.id, e]));

/** No event before this much simulated time. */
export const EVENT_START = 30 * 60;
/** One chance per window, at a minute inside it picked by the hash: events land every 20–40 minutes. */
const WINDOW = 30;
const JITTER = 10;

/** A tiny LCG-style hash: the same input always gives the same 32-bit output. */
export function lcg(n: number): number {
  let x = (Math.imul(n, 1103515245) + 12345) >>> 0;
  x ^= x >>> 13;
  x = Math.imul(x, 0x5bd1e995) >>> 0;
  return (x ^ (x >>> 15)) >>> 0;
}

export function eventMult(s: Pick<FactoryState, 'event'>): { miners: number; generators: number } {
  const e = s.event ? EVENT[s.event.id] : undefined;
  return { miners: e?.effect.miners ?? 1, generators: e?.effect.generators ?? 1 };
}

/** Rate multiplier for one belt under the current event. */
export function beltMult(s: Pick<FactoryState, 'event'>, beltId: number): number {
  const e = s.event ? EVENT[s.event.id] : undefined;
  if (!e || e.effect.belts === undefined) return 1;
  return s.event!.beltId === undefined || s.event!.beltId === beltId ? e.effect.belts : 1;
}

/** Start an event now. A jam needs a belt to stop (picked by `seed`); without one nothing happens. */
export function startEvent(s: FactoryState, id: string, seed = 0): boolean {
  const e = EVENT[id];
  if (!e) return false;
  const ev = { id, left: e.seconds } as NonNullable<FactoryState['event']>;
  if (e.effect.belts !== undefined) {
    if (!s.belts.length) return false;
    ev.beltId = s.belts[seed % s.belts.length].id;
  }
  s.event = ev;
  return true;
}

/** Called once per live tick with the time before it: maybe starts an event when a minute boundary was crossed. */
export function rollEvent(s: FactoryState, from: number): void {
  if (s.event || s.simTime < EVENT_START) return;
  const minute = Math.floor(s.simTime / 60);
  if (Math.floor(from / 60) === minute) return;
  const window = Math.floor(minute / WINDOW);
  const h = lcg(window);
  if (minute !== window * WINDOW + 1 + (h % JITTER)) return;
  const tier = Math.min(s.phase, PHASES.length);
  const pool = EVENTS.filter((e) => e.minTier <= tier);
  startEvent(s, pool[(h >>> 8) % pool.length].id, h >>> 16);
}

/** Count the event down; a jam whose belt is gone ends early. */
export function tickEvent(s: FactoryState, dt: number): void {
  if (!s.event) return;
  s.event.left -= dt;
  if (s.event.left <= 0 || (s.event.beltId !== undefined && !s.belts.some((b) => b.id === s.event!.beltId))) s.event = null;
}
