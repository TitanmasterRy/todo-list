import { describe, expect, it } from 'vitest';
import { connect, place, setRecipe } from './actions';
import { CAMP, PHASES } from './data';
import { loadGame, migrate, saveGame, SAVE_KEY, serialize } from './save';
import { FACTORY_VERSION, newGame } from './state';
import { tick } from './sim';

function memory(): Storage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, String(v)),
  };
}

describe('factory saves', () => {
  it('round-trips a game through storage', () => {
    const s = newGame(1000);
    const m = place(s, 'miner1', 4, 3).id!;
    const sm = place(s, 'smelter', 5, 3).id!;
    setRecipe(s, sm, 'ironIngot');
    connect(s, m, sm);
    for (let i = 0; i < 10; i++) tick(s);
    const st = memory();
    expect(saveGame(st, s)).toBe(true);
    expect(st.data.has(SAVE_KEY)).toBe(true);
    const back = loadGame(st, 2000);
    const shape = (b: (typeof s.buildings)[number]) => [b.id, b.type, b.x, b.y, b.rot, b.recipe, b.clock];
    expect(back.buildings.map(shape)).toEqual(s.buildings.map(shape));
    expect(s.buildings[2].outBuf.ironIngot).toBeGreaterThan(0);
    expect(back.buildings[2].outBuf.ironIngot).toBeCloseTo(s.buildings[2].outBuf.ironIngot!);
    expect(back.belts).toEqual(s.belts);
    expect(back.inv).toEqual(s.inv);
    expect(back.v).toBe(FACTORY_VERSION);
    expect(JSON.parse(serialize(s)).buildings[1].act).toBeUndefined();
  });

  it('starts fresh from nothing, garbage or broken JSON', () => {
    expect(migrate(null, 5).buildings).toHaveLength(1);
    expect(migrate('nope', 5).inv.ironPlate).toBe(60);
    expect(migrate({ v: 0 }, 5).lastSeen).toBe(5);
    const st = memory();
    st.setItem(SAVE_KEY, '{not json');
    expect(loadGame(st, 5).buildings[0].type).toBe('camp');
    const throwing = {
      getItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadGame(throwing, 5).v).toBe(FACTORY_VERSION);
    expect(saveGame({ setItem: throwing.getItem }, newGame(0))).toBe(false);
  });

  it('migrates a version 1 save (clock speeds in percent)', () => {
    const v1 = {
      v: 1,
      lastSeen: 100,
      nextId: 5,
      buildings: [
        { id: 1, type: 'camp', x: CAMP.x, y: CAMP.y, rot: 0, clock: 100, shards: 0, inBuf: {}, outBuf: {} },
        { id: 2, type: 'miner1', x: 4, y: 3, rot: 0, clock: 150, shards: 1, inBuf: {}, outBuf: { ironOre: 12 } },
      ],
      belts: [{ id: 3, from: 2, to: 1, tier: 1 }],
      inv: { ironPlate: 7 },
      milestones: ['fasteners'],
    };
    const s = migrate(v1, 200);
    expect(s.v).toBe(FACTORY_VERSION);
    expect(s.buildings[1].clock).toBe(1.5);
    expect(s.buildings[1].outBuf).toEqual({ ironOre: 12 });
    expect(s.delivered).toEqual({});
    expect(s.rushLeft).toBe(0);
    expect(s.extraOffline).toBe(0);
    expect(s.milestones).toEqual(['fasteners']);
    expect(s.lastSeen).toBe(100);
  });

  it('migrates a version 2 save (no sectors, contracts, prestige or events)', () => {
    const v2 = {
      v: 2,
      lastSeen: 100,
      nextId: 5,
      buildings: [
        { id: 1, type: 'camp', x: CAMP.x, y: CAMP.y, rot: 0, clock: 1, shards: 0, inBuf: {}, outBuf: {} },
        { id: 2, type: 'miner1', x: 4, y: 3, rot: 0, clock: 1, shards: 0, inBuf: {}, outBuf: {} },
      ],
      belts: [{ id: 3, from: 2, to: 1, tier: 1 }],
      inv: { ironPlate: 7 },
      made: { ironOre: 1500, ironIngot: 500 },
      milestones: ['fasteners'],
      research: [],
      phase: 6,
      delivered: {},
      shards: 1,
      insight: 2,
      boostLeft: 0,
      rushLeft: 0,
      extraOffline: 0,
      credit: 0,
      rewards: { tasks: 3, study: 1 },
    };
    const s = migrate(v2, 200);
    expect(s.v).toBe(FACTORY_VERSION);
    expect(s.sectors).toEqual(['home']);
    expect(s.contracts).toEqual({ day: '', done: [], progress: {} });
    expect(s.ach).toEqual([]);
    expect([s.stars, s.runs, s.perks, s.event]).toEqual([0, 0, [], null]);
    expect(s.madeTotal).toBe(2000);
    expect(s.lifetime).toEqual({ launches: 1, contracts: 0, relaunches: 0 }); // v2's tower had 6 phases: this one launched
    expect(s.phase).toBe(6); // ...and now has two more to go
    expect(s.belts).toEqual([{ id: 3, from: 2, to: 1, tier: 1 }]);
    expect(s.buildings[1].item).toBeUndefined();
    expect(migrate({ ...v2, phase: 3 }, 200).lifetime.launches).toBe(0);
  });

  it('cleans junk out of the new fields', () => {
    const s = migrate(
      {
        v: FACTORY_VERSION,
        buildings: [
          { id: 1, type: 'camp', x: CAMP.x, y: CAMP.y },
          { id: 2, type: 'loader', x: 6, y: 6, item: 'unobtainium' },
          { id: 3, type: 'loader', x: 7, y: 6, item: 'ironPlate' },
          { id: 4, type: 'smelter', x: 8, y: 6, item: 'ironPlate' },
          { id: 5, type: 'smelter', x: 25, y: 15 }, // outside the home sector: kept (the map is 32×18 now)
          { id: 6, type: 'smelter', x: 32, y: 0 },
        ],
        belts: [
          { id: 7, from: 3, to: 1, tier: 9, filter: 'ironPlate' },
          { id: 8, from: 2, to: 1, tier: 1, filter: 'gold' },
        ],
        sectors: ['east', 'atlantis', 'east', 7],
        contracts: { day: 5, done: ['a', 3, 'a'], progress: { motor: 4, rotor: -1, x: 'y' } },
        ach: ['first', 'first', null],
        stars: -4,
        runs: 2.7,
        perks: ['swift', 'cheat', 'swift'],
        event: { id: 'jam', left: 100, beltId: 99 },
        madeTotal: 'lots',
        lifetime: { launches: 'x', contracts: 3, relaunches: -2 },
      },
      1000,
    );
    expect(s.buildings.map((b) => [b.type, b.item])).toEqual([
      ['camp', undefined],
      ['loader', undefined],
      ['loader', 'ironPlate'],
      ['smelter', undefined],
      ['smelter', undefined],
    ]);
    expect(s.belts.map((b) => [b.tier, b.filter])).toEqual([
      [6, 'ironPlate'],
      [1, undefined],
    ]);
    expect(s.sectors).toEqual(['home', 'east']);
    expect(s.contracts).toEqual({ day: '', done: ['a'], progress: { motor: 4 } });
    expect(s.ach).toEqual(['first']);
    expect([s.stars, s.runs, s.perks, s.madeTotal]).toEqual([0, 2, ['swift'], 0]);
    expect(s.event).toBeNull(); // jammed belt doesn't exist
    expect(s.lifetime).toEqual({ launches: 0, contracts: 3, relaunches: 0 });
    const jam = migrate({ v: FACTORY_VERSION, buildings: s.buildings, belts: s.belts, event: { id: 'jam', left: 1e9, beltId: 7 } }, 1000);
    expect(jam.event).toEqual({ id: 'jam', left: 900, beltId: 7 });
    expect(migrate({ v: FACTORY_VERSION, event: { id: 'dust', left: 10 } }, 1000).event).toEqual({ id: 'dust', left: 10 });
    expect(migrate({ v: FACTORY_VERSION, event: { id: 'dust', left: 0 } }, 1000).event).toBeNull();
  });

  it('cleans up a tampered or broken save', () => {
    const s = migrate(
      {
        v: FACTORY_VERSION,
        lastSeen: 9e15, // in the future
        buildings: [
          { id: 2, type: 'laser', x: 1, y: 1 },
          { id: 3, type: 'smelter', x: 5, y: 5, clock: 9, shards: 0, recipe: 'ironPlate', inBuf: { ironOre: -4, gold: 3 } },
          { id: 4, type: 'smelter', x: 5, y: 5 },
          { id: 5, type: 'constructor', x: 50, y: 5 },
        ],
        belts: [
          { id: 6, from: 3, to: 99 },
          { id: 7, from: 3, to: 3 },
        ],
        inv: { ironPlate: 'lots', screw: 5 },
        milestones: ['fasteners', 'fasteners', 'hack'],
        shards: -3,
        phase: 99,
      },
      1000,
    );
    expect(s.buildings.map((b) => b.type).sort()).toEqual(['camp', 'smelter']);
    const sm = s.buildings.find((b) => b.type === 'smelter')!;
    expect(sm.clock).toBe(1); // no shards: no overclock
    expect(sm.recipe).toBeUndefined(); // a smelter can't make plates
    expect(sm.inBuf).toEqual({});
    expect(s.belts).toEqual([]);
    expect(s.inv).toEqual({ screw: 5 });
    expect(s.milestones).toEqual(['fasteners']);
    expect(s.shards).toBe(0);
    expect(s.phase).toBe(PHASES.length);
    expect(s.lastSeen).toBe(1000);
    expect(s.nextId).toBeGreaterThan(Math.max(...s.buildings.map((b) => b.id)));
  });
});
