import { describe, expect, it } from 'vitest';
import {
  BELTS,
  BUILDING,
  BUILDINGS,
  CAMP,
  ITEM,
  ITEMS,
  MAP_H,
  MAP_W,
  MAX_TIER,
  MILESTONES,
  NODES,
  PHASES,
  RECIPES,
  RESEARCH,
  RESOURCE_ITEM,
  SECTOR,
  SECTORS,
  START_UNLOCKS,
  perMin,
  powerAt,
  sectorAt,
  shardsFor,
  type ItemId,
} from './data';

describe('factory data', () => {
  it('has a deep enough tech tree', () => {
    expect(ITEMS.length).toBeGreaterThanOrEqual(25);
    expect(RECIPES.length).toBeGreaterThanOrEqual(30);
    expect(RECIPES.filter((r) => r.alt).length).toBeGreaterThanOrEqual(5);
    expect(new Set(ITEMS.map((i) => i.tier)).size).toBeGreaterThanOrEqual(5);
    for (const b of ['smelter', 'foundry', 'constructor', 'assembler', 'manufacturer', 'refinery'] as const) expect(RECIPES.some((r) => r.building === b)).toBe(true);
  });

  it('only references real items, buildings and recipes', () => {
    const ids = new Set(ITEMS.map((i) => i.id));
    const check = (inv: Partial<Record<ItemId, number>>) => Object.keys(inv).forEach((k) => expect(ids.has(k as ItemId), k).toBe(true));
    for (const r of RECIPES) {
      check(r.in);
      check(r.out);
      expect(BUILDING[r.building].kind).toBe('producer');
      expect(r.time).toBeGreaterThan(0);
    }
    BUILDINGS.forEach((b) => check(b.cost));
    MILESTONES.forEach((m) => {
      check(m.cost);
      m.unlock.recipes?.forEach((r) =>
        expect(
          RECIPES.some((x) => x.id === r && !x.alt),
          r,
        ).toBe(true),
      );
    });
    PHASES.forEach((p) => check(p.cost));
    SECTORS.forEach((x) => check(x.cost));
    BELTS.forEach((b) => check(b.cost));
    RESEARCH.forEach((r) => {
      check(r.cost);
      expect(RECIPES.find((x) => x.id === r.recipe)?.alt, r.recipe).toBe(true);
    });
    expect(new Set(RECIPES.map((r) => r.id)).size).toBe(RECIPES.length);
    expect(new Set(MILESTONES.map((m) => m.id)).size).toBe(MILESTONES.length);
  });

  it('every standard recipe is unlocked by exactly one milestone or at the start', () => {
    for (const r of RECIPES.filter((x) => !x.alt)) {
      const n = MILESTONES.filter((m) => m.unlock.recipes?.includes(r.id)).length + (START_UNLOCKS.recipes.includes(r.id) ? 1 : 0);
      expect(n, r.id).toBe(1);
    }
  });

  it('is climbable: what each tier costs can be made with what earlier tiers unlock', () => {
    // walk the tiers in order and check every cost only uses items makeable by then
    const makeable = new Set<ItemId>(['ironPlate', 'ironRod']);
    const recipes = new Set<string>(START_UNLOCKS.recipes);
    const resources = new Set<string>(START_UNLOCKS.resources);
    const refresh = () => {
      let grew = true;
      while (grew) {
        grew = false;
        for (const n of NODES) {
          const item = RESOURCE_ITEM[n.res];
          if (resources.has(n.res) && !makeable.has(item)) {
            makeable.add(item);
            grew = true;
          }
        }
        for (const r of RECIPES)
          if (recipes.has(r.id) && Object.keys(r.in).every((k) => makeable.has(k as ItemId)))
            for (const o of Object.keys(r.out) as ItemId[])
              if (!makeable.has(o)) {
                makeable.add(o);
                grew = true;
              }
      }
    };
    for (let tier = 0; tier < PHASES.length; tier++) {
      // a milestone may depend on another milestone of the same tier: go round until nothing changes
      const todo = MILESTONES.filter((m) => m.tier === tier);
      for (let round = 0; round < todo.length + 1; round++) {
        refresh();
        for (const m of todo)
          if (Object.keys(m.cost).every((k) => makeable.has(k as ItemId))) {
            m.unlock.recipes?.forEach((r) => recipes.add(r));
            m.unlock.resources?.forEach((r) => resources.add(r));
          }
      }
      refresh();
      for (const m of todo)
        expect(
          Object.keys(m.cost).filter((k) => !makeable.has(k as ItemId)),
          `${m.id} cost`,
        ).toEqual([]);
      expect(
        Object.keys(PHASES[tier].cost).filter((k) => !makeable.has(k as ItemId)),
        `phase ${tier}`,
      ).toEqual([]);
    }
  });

  it('places nodes on the map, apart from each other and the camp', () => {
    const seen = new Set<string>();
    for (const n of NODES) {
      expect(n.x).toBeGreaterThanOrEqual(0);
      expect(n.x).toBeLessThan(MAP_W);
      expect(n.y).toBeLessThan(MAP_H);
      const k = `${n.x},${n.y}`;
      expect(seen.has(k)).toBe(false);
      seen.add(k);
    }
    expect(seen.has(`${CAMP.x},${CAMP.y}`)).toBe(false);
  });

  it('works out rates, shards and power', () => {
    const plate = RECIPES.find((r) => r.id === 'ironPlate')!;
    expect(perMin(plate, plate.in.ironIngot!)).toBe(30);
    expect(perMin(plate, plate.out.ironPlate!)).toBe(20);
    expect(shardsFor(1)).toBe(0);
    expect(shardsFor(1.01)).toBe(1);
    expect(shardsFor(1.5)).toBe(1);
    expect(shardsFor(2)).toBe(2);
    expect(shardsFor(2.5)).toBe(3);
    expect(powerAt(10, 1)).toBe(10);
    expect(powerAt(10, 2)).toBeCloseTo(10 * 2 ** 1.6);
    expect(powerAt(10, 2)).toBeGreaterThan(20); // super-linear
    expect(powerAt(10, 0.5)).toBeLessThan(5);
  });

  it('keeps market values on later parts only', () => {
    for (const i of ITEMS) if (i.tier < 2) expect(ITEM[i.id].value ?? 0).toBe(0);
  });

  it('reaches tier 7 with aluminium, nuclear power and a sixth belt', () => {
    expect(MAX_TIER).toBe(7);
    expect(PHASES.map((p) => p.name).slice(-2)).toEqual(['Orbital Station', 'Deep Space Probe']);
    for (const id of ['logistics', 'aluminium', 'heatSinks', 'belts6', 'nuclear', 'radio'])
      expect(
        MILESTONES.some((m) => m.id === id),
        id,
      ).toBe(true);
    expect(BELTS.at(-1)).toMatchObject({ tier: 6, rate: 1200 });
    expect(BUILDING.nuclearPlant.gen).toEqual({ fuel: 'uraniumRod', mw: 600, burn: 1 });
    expect(BUILDING.blender.ins).toBe(4);
    expect(BUILDING.miner3.mines).toEqual(expect.arrayContaining(['bauxite', 'uranium']));
    expect(BUILDING.miner1.mines).not.toContain('uranium');
    expect(['storage', 'loader'].map((b) => BUILDING[b as 'storage'].kind)).toEqual(['storage', 'loader']);
    for (const id of ['radioUnit', 'uraniumRod', 'fusedFrame', 'encasedCell', 'heatSink', 'alumina'] as const) expect(ITEM[id].value).toBeGreaterThan(0);
  });
});

describe('sectors', () => {
  it('tile the whole map without overlapping', () => {
    const owner = new Map<string, string>();
    for (let y = 0; y < MAP_H; y++)
      for (let x = 0; x < MAP_W; x++) {
        const s = sectorAt(x, y);
        expect(s, `${x},${y}`).toBeDefined();
        owner.set(`${x},${y}`, s!.id);
      }
    for (const s of SECTORS) expect([...owner.values()].filter((id) => id === s.id).length).toBe(s.w * s.h);
    expect(sectorAt(-1, 0)).toBeUndefined();
    expect(sectorAt(MAP_W, 0)).toBeUndefined();
    expect(SECTOR.home).toMatchObject({ x: 0, y: 0, w: 20, h: 12, tier: 0, insight: 0, cost: {} });
  });

  it('keep the camp and the original nodes in the free home sector, and the new ores outside it', () => {
    expect(sectorAt(CAMP.x, CAMP.y)?.id).toBe('home');
    for (const n of NODES.slice(0, 25)) expect(sectorAt(n.x, n.y)?.id, `${n.x},${n.y}`).toBe('home');
    expect(NODES.slice(0, 25).some((n) => n.x === 4 && n.y === 3 && n.res === 'iron' && n.purity === 'normal')).toBe(true);
    for (const n of NODES) if (n.res === 'bauxite' || n.res === 'uranium') expect(sectorAt(n.x, n.y)?.id).not.toBe('home');
    expect(NODES.filter((n) => n.res === 'uranium').length).toBeGreaterThan(0);
    for (const s of SECTORS)
      expect(
        NODES.some((n) => sectorAt(n.x, n.y)?.id === s.id),
        s.id,
      ).toBe(true);
    const tiers = SECTORS.map((s) => s.tier);
    expect(tiers).toEqual([...tiers].sort((a, b) => a - b));
  });
});
