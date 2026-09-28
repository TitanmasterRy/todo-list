// Orebelt UI controller: owns the game state, runs the fixed tick against the wall clock, saves, collects homework
// rewards and keeps the rolling stats the panels show. It also holds the UI state that more than one panel needs
// (the open tab, the selected tile, the map tool). The game rules themselves live in src/lib/factory.
import { applyRewards, type Result } from '../../../lib/factory/actions';
import { ITEM, type BuildingId, type Inv, type ItemId } from '../../../lib/factory/data';
import { takePending } from '../../../lib/factory/bridge';
import { loadGame, saveGame } from '../../../lib/factory/save';
import { catchUp, tick, TICK, type AwaySummary, type TickReport } from '../../../lib/factory/sim';
import type { FactoryState } from '../../../lib/factory/state';
import { store } from '../../../lib/store.svelte';
import { toasts } from '../../../lib/toast.svelte';

export interface PowerSample {
  cap: number;
  use: number;
}
export interface Rates {
  made: Partial<Record<ItemId, number>>;
  used: Partial<Record<ItemId, number>>;
  stocked: Partial<Record<ItemId, number>>;
}

/** One value every SERIES_STEP seconds per item, SERIES_LEN of them (ten minutes), for the sparklines. */
export interface Series {
  made: Partial<Record<ItemId, number[]>>;
  stocked: Partial<Record<ItemId, number[]>>;
  /** Samples taken so far (up to SERIES_LEN). */
  len: number;
}
export type FactoryTab = 'map' | 'stats' | 'tech' | 'trade';
export type MapTool = 'select' | 'build' | 'belt';
export type BurstKind = 'build' | 'dismantle' | 'milestone' | 'deliver';

const HISTORY = 120;
export const SERIES_STEP = 10;
export const SERIES_LEN = 60;
const TAB_KEY = 'homework-todo:factory-tab';
/** A gap longer than this is handled as an absence (catch-up + "while you were away"). */
const GAP = 30;
const SAVE_EVERY = 5;

function storage(): Storage | undefined {
  try {
    return localStorage;
  } catch {
    return undefined;
  }
}

export class FactoryCtl {
  game: FactoryState;
  /** Bumped whenever the game changes: panels re-derive their views from it. */
  rev = $state(0);
  report = $state.raw<TickReport | null>(null);
  away = $state.raw<AwaySummary | null>(null);
  history = $state.raw<PowerSample[]>([]);
  rates = $state.raw<Rates>({ made: {}, used: {}, stocked: {} });
  series = $state.raw<Series>({ made: {}, stocked: {}, len: 0 });
  message = $state<{ text: string; bad: boolean } | null>(null);
  /** Which section is open; remembered across visits. */
  tab = $state<FactoryTab>('map');
  /** The tile the panel shows, the active map tool and the building the palette has picked. */
  sel = $state<{ x: number; y: number } | null>(null);
  tool = $state<MapTool>('select');
  buildType = $state<BuildingId>('miner1');
  /** A machine whose settings the next tapped machine receives (the panel's "Copy settings"). */
  copyFrom = $state<number | null>(null);
  /** The last particle burst asked for, in tile coordinates; the map draws it. */
  burst = $state.raw<{ n: number; x: number; y: number; kind: BurstKind } | null>(null);
  private sinceSave = 0;
  private samples = 0;
  private bucket: { made: Inv; stocked: Inv; secs: number } = { made: {}, stocked: {}, secs: 0 };
  private msgTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(now = Date.now()) {
    this.game = loadGame(storage(), now);
    const t = storage()?.getItem(TAB_KEY);
    if (t === 'stats' || t === 'tech' || t === 'trade') this.tab = t;
    this.collectRewards();
    this.pump(now);
  }

  pickTab(next: FactoryTab): void {
    this.tab = next;
    try {
      storage()?.setItem(TAB_KEY, next);
    } catch {
      /* private mode or full: the tab just isn't remembered */
    }
  }

  /** Show a building in the panel: open the map, put the inspect tool on it. */
  select(id: number): void {
    const b = this.game.buildings.find((x) => x.id === id);
    if (!b) return;
    this.sel = { x: b.x, y: b.y };
    this.tool = 'select';
    this.copyFrom = null;
    this.pickTab('map');
  }

  /** Ask the map for a particle burst on a tile. */
  poof(x: number, y: number, kind: BurstKind): void {
    this.burst = { n: (this.burst?.n ?? 0) + 1, x, y, kind };
  }

  /** Run the ticks the wall clock says are due (or catch up an absence). */
  pump(now = Date.now()): void {
    const s = this.game;
    const elapsed = (now - s.lastSeen) / 1000;
    if (elapsed < TICK) {
      if (elapsed < -60) s.lastSeen = now; // the clock went backwards: start again from now
      return;
    }
    if (elapsed > GAP) {
      const summary = catchUp(s, elapsed);
      s.lastSeen = now;
      if (summary.seconds >= 60 && Object.keys(summary.gained).length) this.away = summary;
      this.report = tick(s, TICK);
      this.save();
    } else {
      const n = Math.floor(elapsed / TICK);
      for (let i = 0; i < n; i++) this.record(tick(s, TICK));
      s.lastSeen += n * TICK * 1000;
      this.sinceSave += n;
      if (this.sinceSave >= SAVE_EVERY) {
        this.save();
        this.collectRewards();
      }
    }
    this.rev++;
  }

  private record(rep: TickReport): void {
    this.report = rep;
    this.history = [...this.history, { cap: rep.power.capacity, use: Math.min(rep.power.demand, rep.power.capacity) }].slice(-HISTORY);
    // a plain running average for the first samples, then an exponential one
    this.samples++;
    const a = Math.max(0.1, 1 / this.samples);
    const ema = (prev: Partial<Record<ItemId, number>>, now: Partial<Record<ItemId, number>>) => {
      const out: Partial<Record<ItemId, number>> = {};
      for (const k of new Set([...Object.keys(prev), ...Object.keys(now)]) as Set<ItemId>) {
        const v = (prev[k] ?? 0) * (1 - a) + (((now[k] ?? 0) * 60) / rep.dt) * a;
        if (v > 0.01) out[k] = v;
      }
      return out;
    };
    this.rates = { made: ema(this.rates.made, rep.made), used: ema(this.rates.used, rep.used), stocked: ema(this.rates.stocked, rep.stocked) };
    this.sample(rep);
  }

  /** Sum ticks into a SERIES_STEP-second bucket; when it's full, append one per-minute value to every item's series. */
  private sample(rep: TickReport): void {
    const b = this.bucket;
    for (const [k, n] of Object.entries(rep.made) as [ItemId, number][]) b.made[k] = (b.made[k] ?? 0) + n;
    for (const [k, n] of Object.entries(rep.stocked) as [ItemId, number][]) b.stocked[k] = (b.stocked[k] ?? 0) + n;
    b.secs += rep.dt;
    if (b.secs < SERIES_STEP) return;
    const len = this.series.len;
    const push = (prev: Partial<Record<ItemId, number[]>>, add: Inv) => {
      const out: Partial<Record<ItemId, number[]>> = {};
      for (const k of new Set([...Object.keys(prev), ...Object.keys(add)]) as Set<ItemId>) {
        // an item seen for the first time gets zeros for the samples before it, so every series lines up
        out[k] = [...(prev[k] ?? new Array<number>(len).fill(0)), ((add[k] ?? 0) * 60) / b.secs].slice(-SERIES_LEN);
      }
      return out;
    };
    this.series = { made: push(this.series.made, b.made), stocked: push(this.series.stocked, b.stocked), len: Math.min(SERIES_LEN, len + 1) };
    this.bucket = { made: {}, stocked: {}, secs: 0 };
  }

  save(): void {
    this.sinceSave = 0;
    saveGame(storage(), this.game);
  }

  /** Homework done since the last look: shards, insight and a production boost. */
  collectRewards(): void {
    const p = takePending(storage());
    if (!p.tasks && !p.study) return;
    const got = applyRewards(this.game, p.tasks, p.study);
    const parts = [
      got.shards && `+${got.shards} overclock shard${got.shards === 1 ? '' : 's'}`,
      got.insight && `+${got.insight} insight`,
      got.boost > 0 && `+${Math.round(got.boost / 60)} min boost`,
    ].filter(Boolean);
    if (parts.length) toasts.push({ message: 'Homework power-up for your factory', detail: parts.join(' · '), kind: 'success', emoji: '🏭' });
    this.save();
    this.rev++;
  }

  /** Run an action on the game; show its error (or a success line) and save. */
  run(fn: (s: FactoryState) => Result | boolean | void, success?: string): boolean {
    const r = fn(this.game);
    const ok = r === undefined || r === true || (typeof r === 'object' && r.ok);
    if (!ok) this.say(typeof r === 'object' && !r.ok ? r.error : "Can't do that", true);
    else if (success) this.say(success, false);
    this.rev++;
    this.save();
    return ok;
  }

  say(text: string, bad: boolean): void {
    this.message = { text, bad };
    clearTimeout(this.msgTimer);
    this.msgTimer = setTimeout(() => (this.message = null), 3500);
  }

  stock(item: ItemId): number {
    return this.game.inv[item] ?? 0;
  }
}

/** Whether the factory may animate: off with the app's reduced-motion setting or the OS preference. */
export function motionOk(): boolean {
  if (store.settings.reducedMotion) return false;
  return typeof window === 'undefined' || !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export function fmt(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e4) return `${(n / 1e3).toFixed(1)}k`;
  if (n >= 100) return Math.floor(n).toLocaleString();
  if (n >= 10) return n.toFixed(0);
  return (Math.floor(n * 10) / 10).toString();
}
export function fmtRate(n: number): string {
  return n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2).replace(/\.?0+$/, '') || '0';
}
export function fmtTime(sec: number): string {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h ? `${h} h ${m} min` : m ? `${m} min${s && m < 10 ? ` ${s} s` : ''}` : `${s} s`;
}
export const itemName = (id: ItemId): string => ITEM[id]?.name ?? id;
