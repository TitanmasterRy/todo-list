import { describe, expect, it } from 'vitest';
import { connect, place, setClock, setRecipe } from './actions';
import { copySettings, pauseAll, quoteUpgradeAll, resumeAll, upgradeAllBelts } from './bulk';
import { newGame, type FactoryState } from './state';

const fresh = (): FactoryState => {
  const s = newGame(0);
  s.inv = { ironPlate: 500, ironRod: 500, screw: 500 };
  return s;
};

describe('copySettings', () => {
  it('copies the recipe and clock between machines of the same type', () => {
    const s = fresh();
    s.shards = 2;
    const a = place(s, 'smelter', 5, 5).id!;
    const b = place(s, 'smelter', 6, 5).id!;
    setRecipe(s, a, 'ironIngot');
    setClock(s, a, 1.5);
    expect(copySettings(s, a, b)).toEqual({ ok: true, clock: 1.5 });
    const t = s.buildings.find((x) => x.id === b)!;
    expect(t.recipe).toBe('ironIngot');
    expect(t.clock).toBe(1.5);
    expect(s.shards).toBe(0);
  });

  it('copies as far as the free shards go', () => {
    const s = fresh();
    s.shards = 1;
    const a = place(s, 'smelter', 5, 5).id!;
    const b = place(s, 'smelter', 6, 5).id!;
    setRecipe(s, a, 'ironIngot');
    setClock(s, a, 1.5);
    expect(copySettings(s, a, b)).toEqual({ ok: true, clock: 1 });
    expect(s.buildings.find((x) => x.id === b)!.recipe).toBe('ironIngot');
  });

  it('refuses different types, sinks and itself', () => {
    const s = fresh();
    const a = place(s, 'smelter', 5, 5).id!;
    const c = place(s, 'constructor', 6, 5).id!;
    expect(copySettings(s, a, c)).toMatchObject({ ok: false, error: expect.stringContaining('Smelter') });
    expect(copySettings(s, a, a).ok).toBe(false);
    expect(copySettings(s, 1, a).ok).toBe(false);
    expect(copySettings(s, a, 999).ok).toBe(false);
  });
});

describe('upgradeAllBelts', () => {
  function floor() {
    const s = fresh();
    s.milestones.push('belts2');
    const m = place(s, 'miner1', 4, 3).id!;
    const sm = place(s, 'smelter', 5, 3).id!;
    connect(s, m, sm); // 1 tile
    connect(s, sm, 1); // 5 tiles to the camp
    return s;
  }

  it('quotes the net cost of every slower belt', () => {
    const s = floor();
    const q = quoteUpgradeAll(s, 2);
    expect(q.belts).toBe(2);
    expect(q.cost).toEqual({ ironPlate: 6, screw: 24 });
    expect(q.refund).toEqual({ ironPlate: 6 });
    expect(q.net).toEqual({ screw: 24 });
    expect(q.affordable).toBe(true);
    expect(quoteUpgradeAll(s, 1)).toMatchObject({ belts: 0, affordable: false });
  });

  it('upgrades every belt and reports what it spent', () => {
    const s = floor();
    const r = upgradeAllBelts(s, 2);
    expect(r).toEqual({ upgraded: 2, cost: { screw: 24 } });
    expect(s.belts.every((b) => b.tier === 2)).toBe(true);
    expect(s.inv.screw).toBe(476);
    expect(upgradeAllBelts(s, 2)).toEqual({ upgraded: 0, cost: {} });
  });

  it('does the short belts first when parts are tight, and nothing for a locked tier', () => {
    const s = floor();
    s.inv.screw = 10;
    expect(quoteUpgradeAll(s, 2).affordable).toBe(false);
    const r = upgradeAllBelts(s, 2);
    expect(r).toEqual({ upgraded: 1, cost: { screw: 4 } });
    expect(s.belts.map((b) => b.tier)).toEqual([2, 1]);
    expect(upgradeAllBelts(s, 3)).toEqual({ upgraded: 0, cost: {} });
  });
});

describe('pauseAll / resumeAll', () => {
  it('switches every machine but the camp and depots, and counts what changed', () => {
    const s = fresh();
    place(s, 'miner1', 4, 3);
    const sm = place(s, 'smelter', 5, 3).id!;
    place(s, 'depot', 8, 5);
    expect(pauseAll(s)).toBe(2);
    expect(s.buildings.filter((b) => b.off).map((b) => b.type)).toEqual(['miner1', 'smelter']);
    expect(pauseAll(s)).toBe(0);
    s.buildings.find((b) => b.id === sm)!.off = false;
    expect(resumeAll(s)).toBe(1);
    expect(s.buildings.some((b) => b.off)).toBe(false);
  });
});
