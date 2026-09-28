import { describe, expect, it } from 'vitest';
import { connect, place, setRecipe } from './actions';
import { CAMP } from './data';
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
    expect(s.phase).toBe(6);
    expect(s.lastSeen).toBe(1000);
    expect(s.nextId).toBeGreaterThan(Math.max(...s.buildings.map((b) => b.id)));
  });
});
