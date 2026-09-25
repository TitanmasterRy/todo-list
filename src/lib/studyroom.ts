// Shared study-room timer with no server: the link carries the room (start time, lengths, name) and every
// device works out the same phase and time left from its own clock. Pure, so it's unit-tested.
import { cleanText, decodeJson, paramFrom, randomId, toB64url } from './b64url';

export interface StudyRoom {
  id: string; // random; names the optional realtime channel
  name: string;
  start: number; // epoch ms when round 1's focus begins (whole seconds)
  work: number; // minutes
  brk: number; // short break minutes
  long: number; // long break minutes (0 = no long breaks)
  every: number; // a long break after every N focus rounds (0 = no long breaks)
  rounds: number; // stop after N focus rounds (0 = keep going)
}

export type RoomPhase = 'waiting' | 'work' | 'break' | 'long' | 'done';

export interface RoomState {
  phase: RoomPhase;
  round: number; // focus round, 1-based (the round a break follows)
  left: number; // ms until the phase ends (0 when done)
  length: number; // ms the phase lasts
  endsAt: number; // epoch ms the phase ends: the same on every device
  index: number; // phase number since the start; changes exactly when the phase does
}

export const ROOM_LIMITS = { name: 40, work: [1, 180], brk: [1, 60], long: [0, 120], every: [0, 12], rounds: [0, 48] } as const;
const MIN_START = Date.UTC(2020, 0, 1);
const MAX_START = Date.UTC(2100, 0, 1);

function int(v: unknown, [lo, hi]: readonly [number, number]): number | null {
  return typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi ? v : null;
}

/** A new room starting `startInMin` minutes from now (rounded to the second so the link stays short). */
export function createRoom(o: { name: string; work: number; brk: number; long?: number; every?: number; rounds?: number; startInMin?: number }, now = Date.now()): StudyRoom {
  const clamp = (v: number | undefined, [lo, hi]: readonly [number, number], d: number) => Math.min(hi, Math.max(lo, Math.round(Number.isFinite(v) ? v! : d)));
  return {
    id: randomId(10),
    name: cleanText(o.name, ROOM_LIMITS.name) || 'Study room',
    start: Math.ceil((now + Math.max(0, o.startInMin ?? 0) * 60_000) / 1000) * 1000,
    work: clamp(o.work, ROOM_LIMITS.work, 25),
    brk: clamp(o.brk, ROOM_LIMITS.brk, 5),
    long: clamp(o.long, ROOM_LIMITS.long, 0),
    every: clamp(o.every, ROOM_LIMITS.every, 0),
    rounds: clamp(o.rounds, ROOM_LIMITS.rounds, 0),
  };
}

/** Versioned, short keys: {v, i, n, s (epoch seconds), w, b, l, e, r}. */
export function encodeRoom(r: StudyRoom): string {
  return toB64url(JSON.stringify({ v: 1, i: r.id, n: r.name, s: Math.round(r.start / 1000), w: r.work, b: r.brk, l: r.long, e: r.every, r: r.rounds }));
}

/** Read a room from a code or a pasted link (`#room=…` or `?room=…`). Null for anything invalid. */
export function decodeRoom(input: string): StudyRoom | null {
  const o = decodeJson(paramFrom(input, 'room'), 1024);
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  const j = o as Record<string, unknown>;
  if (j.v !== 1 || typeof j.i !== 'string' || !/^[a-z0-9]{4,24}$/.test(j.i)) return null;
  const s = typeof j.s === 'number' && Number.isInteger(j.s) ? j.s * 1000 : NaN;
  if (!(s >= MIN_START && s <= MAX_START)) return null;
  const work = int(j.w, ROOM_LIMITS.work);
  const brk = int(j.b, ROOM_LIMITS.brk);
  const long = int(j.l ?? 0, ROOM_LIMITS.long);
  const every = int(j.e ?? 0, ROOM_LIMITS.every);
  const rounds = int(j.r ?? 0, ROOM_LIMITS.rounds);
  if (work === null || brk === null || long === null || every === null || rounds === null) return null;
  return { id: j.i, name: cleanText(j.n, ROOM_LIMITS.name) || 'Study room', start: s, work, brk, long, every, rounds };
}

/** The app link for a room. The code is in the hash, so it never reaches the web host's logs. */
export function roomLink(r: StudyRoom, base: string): string {
  return `${base.replace(/#.*$/, '')}#room=${encodeRoom(r)}`;
}

/**
 * Where the room is at `now`: focus rounds alternate with short breaks, every `every`-th break is the long one,
 * and with `rounds` set the room ends after that many focus rounds (no break after the last).
 */
export function phaseAt(r: StudyRoom, now: number): RoomState {
  if (now < r.start) return { phase: 'waiting', round: 1, left: r.start - now, length: r.start - now, endsAt: r.start, index: -1 };
  const W = r.work * 60_000;
  const B = r.brk * 60_000;
  const hasLong = r.every > 0 && r.long > 0;
  const per = hasLong ? r.every : 1;
  const L = hasLong ? r.long * 60_000 : B;
  const cycleLen = per * W + (per - 1) * B + L;
  const cycle = Math.floor((now - r.start) / cycleLen);
  let at = r.start + cycle * cycleLen; // start of the segment being checked
  const done = (): RoomState => {
    const end = r.start + totalMs(r);
    return { phase: 'done', round: r.rounds, left: 0, length: 0, endsAt: end, index: 2 * r.rounds - 1 };
  };
  for (let k = 0; k < per; k++) {
    const round = cycle * per + k + 1;
    if (r.rounds && round > r.rounds) return done();
    if (now < at + W) return { phase: 'work', round, left: at + W - now, length: W, endsAt: at + W, index: 2 * (round - 1) };
    at += W;
    if (r.rounds && round === r.rounds) return done();
    const isLong = k === per - 1 && hasLong;
    const len = k === per - 1 ? L : B;
    if (now < at + len) return { phase: isLong ? 'long' : 'break', round, left: at + len - now, length: len, endsAt: at + len, index: 2 * (round - 1) + 1 };
    at += len;
  }
  return phaseAt(r, at); // not reached: the cycle covers every millisecond
}

/** How long a room with a set number of rounds lasts, in ms (Infinity when it keeps going). */
export function totalMs(r: StudyRoom): number {
  if (!r.rounds) return Infinity;
  const hasLong = r.every > 0 && r.long > 0;
  const breaks = r.rounds - 1;
  const longs = hasLong ? Math.floor(breaks / r.every) : 0;
  return (r.rounds * r.work + (breaks - longs) * r.brk + longs * (hasLong ? r.long : 0)) * 60_000;
}

/** "mm:ss" (or "h:mm:ss"), rounding up so a phase never shows 00:00 while it's still running. */
export function formatLeft(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export const PHASE_LABEL: Record<RoomPhase, string> = { waiting: 'Starting soon', work: 'Focus', break: 'Short break', long: 'Long break', done: 'Finished' };
