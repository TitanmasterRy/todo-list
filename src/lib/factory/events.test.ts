import { describe, expect, it } from 'vitest';
import { clearJam, connect, place } from './actions';
import { beltMult, EVENT, EVENT_START, EVENTS, eventMult, lcg, rollEvent, startEvent, tickEvent } from './events';
import { newGame, type FactoryState } from './state';
import { catchUp, tick } from './sim';

function line(): FactoryState & { miner: number; belt: number } {
  const s = newGame(0);
  s.inv = { ironPlate: 500, ironRod: 500 };
  const miner = place(s, 'miner1', 4, 3).id!;
  const belt = connect(s, miner, 1).id!;
  return Object.assign(s, { miner, belt });
}

describe('events', () => {
  it('lists the four events with sane lengths and a deterministic hash', () => {
    expect(EVENTS.map((e) => e.id)).toEqual(['dust', 'seam', 'surge', 'jam']);
    for (const e of EVENTS) expect(e.seconds).toBeGreaterThanOrEqual(60);
    expect(EVENT.dust.effect).toEqual({ miners: 0.75 });
    expect(EVENT.seam.effect).toEqual({ miners: 1.5 });
    expect(EVENT.surge.effect).toEqual({ generators: 1.25 });
    expect(EVENT.jam.effect).toEqual({ belts: 0 });
    expect(lcg(7)).toBe(lcg(7));
    expect(lcg(7)).not.toBe(lcg(8));
  });

  it('scales miners while it lasts, then ends', () => {
    const s = line();
    expect(startEvent(s, 'dust')).toBe(true);
    expect(eventMult(s).miners).toBe(0.75);
    tick(s);
    expect(s.made.ironOre).toBeCloseTo((30 / 60) * 0.75);
    expect(s.event!.left).toBe(EVENT.dust.seconds - 1);
    for (let i = 1; i < EVENT.dust.seconds; i++) tick(s);
    expect(s.event).toBeNull();
    const before = s.made.ironOre!;
    tick(s);
    expect(s.made.ironOre! - before).toBeCloseTo(30 / 60);
    expect(startEvent(s, 'nope')).toBe(false);
    startEvent(s, 'surge');
    expect(eventMult(s)).toEqual({ miners: 1, generators: 1.25 });
    tickEvent(s, 1e9);
    expect(s.event).toBeNull();
  });

  it('a jam stops one belt until it is cleared', () => {
    const s = line();
    expect(startEvent(newGame(0), 'jam')).toBe(false); // nothing to jam
    expect(startEvent(s, 'jam')).toBe(true);
    expect(s.event).toMatchObject({ id: 'jam', beltId: s.belt });
    expect(beltMult(s, s.belt)).toBe(0);
    expect(beltMult(s, s.belt + 1)).toBe(1);
    const rep = tick(s);
    expect(rep.belts[s.belt].rate).toBe(0);
    expect(s.inv.ironOre).toBeUndefined();
    expect(clearJam(s).ok).toBe(true);
    for (let i = 0; i < 5; i++) tick(s);
    expect(s.inv.ironOre).toBeGreaterThan(0);
    // the jammed belt being removed ends the jam too
    startEvent(s, 'jam');
    s.belts = [];
    tick(s);
    expect(s.event).toBeNull();
  });

  it('starts nothing in the first 30 minutes, then something every 20-40 minutes, and never while catching up', () => {
    const s = line();
    const starts: number[] = [];
    for (let i = 0; i < 6 * 3600; i++) {
      const had = s.event;
      tick(s);
      if (s.event && !had) starts.push(s.simTime);
    }
    expect(starts.length).toBeGreaterThanOrEqual(8);
    expect(starts[0]).toBeGreaterThan(EVENT_START);
    for (let i = 1; i < starts.length; i++) {
      expect(starts[i] - starts[i - 1]).toBeGreaterThanOrEqual(20 * 60);
      expect(starts[i] - starts[i - 1]).toBeLessThanOrEqual(40 * 60);
    }
    for (const at of starts) expect(at % 60).toBe(0);
    // the same again from the same start replays exactly
    const again = line();
    const replay: number[] = [];
    for (let i = 0; i < 6 * 3600; i++) {
      const had = again.event;
      tick(again);
      if (again.event && !had) replay.push(again.simTime);
    }
    expect(replay).toEqual(starts);
    // an absence is caught up without any new events
    const away = line();
    catchUp(away, 6 * 3600);
    expect(away.event).toBeNull();
    // tier 0 never sees a surge or a jam
    const t0 = line();
    for (let i = 0; i < 6 * 3600; i++) {
      tick(t0);
      if (t0.event) expect(['dust', 'seam']).toContain(t0.event.id);
    }
  });

  it('rollEvent only fires on a minute boundary with no event running', () => {
    const s = line();
    s.simTime = EVENT_START + 30;
    rollEvent(s, s.simTime - 1);
    expect(s.event).toBeNull();
  });
});
