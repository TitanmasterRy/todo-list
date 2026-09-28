import { describe, expect, it } from 'vitest';
import {
  coinsLeftToday,
  COINS,
  daylight,
  dropsFor,
  emptyGarden,
  feedSnail,
  feedTree,
  GARDEN_DAILY_MAX,
  GROW_REST_MS,
  GROWN,
  GROWN_BONUS,
  GROWN_REST_MS,
  KINDS,
  loadGarden,
  nextMilestone,
  nextNeed,
  parseGarden,
  plant,
  POTS,
  saveGarden,
  seasonOf,
  seedsFrom,
  SHINY_ONE_IN,
  snailAwake,
  supplies,
  tend,
  thirsty,
  toMeadow,
  TREE_MILESTONES,
  treeUnlocks,
  wake,
  WISDOM,
  wisdomFor,
  type Completion,
  type Seed,
} from './garden';

const done = (i: number, color?: string): Completion => ({ id: `c${i}`, at: new Date(2026, 9, 1, i).toISOString(), color, course: color ? 'Bio' : undefined });
const seed = (over: Partial<Seed> = {}): Seed => ({ id: 's1', kind: 'daisy', color: '#123456', shiny: false, ...over });
const T = 1_700_000_000_000;

describe('garden supplies', () => {
  it('turns finished tasks into seed packets in completion order, colored by course', () => {
    const seeds = seedsFrom([done(3), done(1, '#111111'), done(2)]);
    expect(seeds.map((s) => s.id)).toEqual(['c1', 'c2', 'c3']);
    expect(seeds[0]).toMatchObject({ color: '#111111', course: 'Bio' });
    expect(seeds[1].color).toBe('#e06666');
    expect(seeds.every((s) => KINDS.includes(s.kind))).toBe(true);
    // the kind and the shine are stable per task, and about one packet in eight is shiny
    expect(seedsFrom([done(1)])[0].kind).toBe(seeds[0].kind);
    const many = seedsFrom(Array.from({ length: 800 }, (_, i) => done(i)));
    const shiny = many.filter((s) => s.shiny).length;
    expect(shiny).toBeGreaterThan(800 / SHINY_ONE_IN / 2);
    expect(shiny).toBeLessThan((800 / SHINY_ONE_IN) * 2);
  });

  it('drops a care pack per task and never counts below zero', () => {
    expect(dropsFor(0)).toEqual({ seeds: 0, fertilizer: 0, spray: 0, treeFood: 0, chocolate: 0 });
    expect(dropsFor(7)).toEqual({ seeds: 7, fertilizer: 7, spray: 2, treeFood: 7, chocolate: 0 });
    const shed = supplies(dropsFor(2), { fertilizer: 3, chocolate: 1 }, { seeds: 1, fertilizer: 6, spray: 0, treeFood: 0, chocolate: 0 });
    expect(shed).toEqual({ seeds: 1, fertilizer: 0, spray: 0, treeFood: 2, chocolate: 1 });
  });
});

describe('garden pots', () => {
  it('plants a seed that asks for water, then fertilizer, and grows a size per bag', () => {
    let g = plant(emptyGarden(), 5, seed(), T);
    expect(g.used.seeds).toBe(1);
    expect(g.pots[5]).toMatchObject({ stage: 0, need: 'water', tended: 0 });
    expect(plant(g, 5, seed({ id: 'other' }), T)).toBe(g); // the pot is taken
    expect(plant(g, POTS, seed(), T)).toBe(g);

    expect(tend(g, 5, 'fertilizer', T).ok).toBe(false); // wrong tool
    const w = tend(g, 5, 'water', T);
    expect(w).toMatchObject({ ok: true, coins: COINS.water, grew: false });
    expect(w.garden.pots[5]).toMatchObject({ need: 'fertilizer', tended: 1 });
    const f = tend(w.garden, 5, 'fertilizer', T + 1);
    expect(f).toMatchObject({ ok: true, coins: COINS.fertilizer, grew: true, grown: false });
    expect(f.garden.pots[5]).toMatchObject({ stage: 1, need: null, needAt: T + 1 + GROW_REST_MS });
    expect(f.garden.used.fertilizer).toBe(1);
    g = f.garden;
    // resting: nothing surfaces until the rest is over
    expect(wake(g, T + 2)).toBe(g);
    const woke = wake(g, T + 1 + GROW_REST_MS);
    expect(woke.pots[5]!.need).toBe(nextNeed(g.pots[5]!));
  });

  it('pays the bonus on reaching full size, then only asks for water a few times a day', () => {
    let g = plant(emptyGarden(), 0, seed(), T);
    let coins = 0;
    let now = T;
    for (let size = 0; size < GROWN; size++) {
      // clear whatever the plant asks for first, until it wants water
      g = wake(g, now);
      while (g.pots[0]!.need !== 'water') {
        const r = tend(g, 0, g.pots[0]!.need!, now);
        expect(r.ok).toBe(true);
        g = r.garden;
        coins += r.coins;
      }
      g = tend(g, 0, 'water', now).garden;
      const r = tend(g, 0, 'fertilizer', now);
      g = r.garden;
      coins += r.coins;
      if (size === GROWN - 1) {
        expect(r.grown).toBe(true);
        expect(r.coins).toBe(COINS.fertilizer + GROWN_BONUS);
        expect(g.pots[0]).toMatchObject({ stage: GROWN, grownAt: now, needAt: now + GROWN_REST_MS });
      }
      now += GROWN_REST_MS;
    }
    expect(coins).toBeGreaterThan(0);
    g = wake(g, now);
    expect(g.pots[0]!.need).toBe('water');
    expect(thirsty(g)).toEqual([0]);
    const w = tend(g, 0, 'water', now);
    expect(w.garden.pots[0]).toMatchObject({ stage: GROWN, need: null, needAt: now + GROWN_REST_MS });
    expect(tend(w.garden, 0, 'water', now).ok).toBe(false);
  });

  it('shiny plants drop double coins; bugs and music lead straight to a drink', () => {
    const g = plant(emptyGarden(), 1, seed({ shiny: true }), T);
    expect(tend(g, 1, 'water', T).coins).toBe(COINS.water * 2);
    const buggy = { ...g, pots: g.pots.map((p, i) => (i === 1 ? { ...p!, need: 'spray' as const } : p)) };
    const s = tend(buggy, 1, 'spray', T);
    expect(s.garden.pots[1]!.need).toBe('water');
    expect(s.garden.used.spray).toBe(1);
    const musical = { ...g, pots: g.pots.map((p, i) => (i === 1 ? { ...p!, need: 'music' as const } : p)) };
    expect(tend(musical, 1, 'music', T).garden.pots[1]!.need).toBe('water');
  });

  it('surfaces bugs or music now and then while growing, never once grown', () => {
    const needs = new Set<string>();
    for (let i = 0; i < 60; i++) needs.add(nextNeed({ ...seed({ id: `p${i}` }), stage: 1, plantedAt: T, need: null, needAt: T, tended: i }));
    expect([...needs].sort()).toEqual(['music', 'spray', 'water']);
    for (let i = 0; i < 60; i++) expect(nextNeed({ ...seed({ id: `p${i}` }), stage: GROWN, plantedAt: T, need: null, needAt: T, tended: i })).toBe('water');
  });

  it('wheels only full-grown plants to the meadow', () => {
    const g = plant(emptyGarden(), 2, seed(), T);
    expect(toMeadow(g, 2)).toBe(g);
    const grown = { ...g, pots: g.pots.map((p, i) => (i === 2 ? { ...p!, stage: GROWN } : p)) };
    const m = toMeadow(grown, 2);
    expect(m.pots[2]).toBeNull();
    expect(m.meadow).toEqual([{ kind: 'daisy', color: '#123456' }]);
  });

  it('caps the coins per day and keeps Stinky awake an hour per chocolate', () => {
    expect(coinsLeftToday(0)).toBe(GARDEN_DAILY_MAX);
    expect(coinsLeftToday(GARDEN_DAILY_MAX + 5)).toBe(0);
    const g = feedSnail(emptyGarden(), T);
    expect(snailAwake(g, T + 1)).toBe(true);
    expect(snailAwake(g, T + 3_600_001)).toBe(false);
    expect(feedSnail(g, T).snail.awakeUntil).toBe(T + 2 * 3_600_000); // a second bar adds on
    expect(g.used.chocolate).toBe(1);
  });
});

describe('tree of wisdom', () => {
  it('grows a foot per feeding, keeps the colors that fed it and unlocks things on the way up', () => {
    let g = emptyGarden();
    for (let i = 0; i < 30; i++) g = feedTree(g, i % 2 ? '#ff0000' : '#00ff00');
    expect(g.tree.height).toBe(30);
    expect(g.tree.leaves).toHaveLength(24);
    expect(g.used.treeFood).toBe(30);
    expect(treeUnlocks(0)).toEqual([]);
    expect(treeUnlocks(10).map((m) => m.feet)).toEqual([3, 6, 10]);
    expect(nextMilestone(10)?.feet).toBe(15);
    expect(nextMilestone(10_000)).toBeUndefined();
    expect(TREE_MILESTONES.map((m) => m.feet)).toEqual([...TREE_MILESTONES.map((m) => m.feet)].sort((a, b) => a - b));
  });

  it('has a line of wisdom for every foot and a memory at milestones', () => {
    expect(wisdomFor(1, 0)).toBe(WISDOM[0]);
    expect(wisdomFor(WISDOM.length + 2, 0)).toBe(WISDOM[1]);
    expect(wisdomFor(10, 12)).toContain('A birdhouse');
    expect(wisdomFor(10, 1)).toContain('1 task finished');
    expect(new Set(WISDOM).size).toBe(WISDOM.length);
  });
});

describe('garden scenery and saves', () => {
  it('knows the time of day and the season', () => {
    expect([daylight(6), daylight(12), daylight(18), daylight(23), daylight(2)]).toEqual(['dawn', 'day', 'dusk', 'night', 'night']);
    expect([seasonOf(0), seasonOf(3), seasonOf(6), seasonOf(9), seasonOf(11)]).toEqual(['winter', 'spring', 'summer', 'autumn', 'winter']);
  });

  it('round-trips through storage and shrugs off broken saves', () => {
    const data = new Map<string, string>();
    const st = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
    let g = plant(emptyGarden(), 3, seed({ shiny: true, course: 'Math' }), T);
    g = feedTree(feedSnail(g, T), '#abcdef');
    saveGarden(st, g);
    expect(loadGarden(st)).toEqual(g);
    expect(loadGarden(undefined)).toEqual(emptyGarden());
    expect(parseGarden('{not json')).toEqual(emptyGarden());
    const odd = parseGarden(
      JSON.stringify({
        pots: [
          { kind: 'weed', id: 'x' },
          { kind: 'rose', id: 'ok', stage: 99, need: 'sunshine' },
        ],
        used: { seeds: -4 },
        tree: { height: 2.7 },
      }),
    );
    expect(odd.pots[0]).toBeNull();
    expect(odd.pots[1]).toMatchObject({ kind: 'rose', stage: GROWN, need: null });
    expect(odd.pots).toHaveLength(POTS);
    expect(odd.used.seeds).toBe(0);
    expect(odd.tree.height).toBe(2);
  });
});
