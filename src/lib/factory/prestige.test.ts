import { describe, expect, it } from 'vitest';
import { connect, place, setRecipe } from './actions';
import { PHASES, START_INV } from './data';
import { buyPerk, canRelaunch, offlineCap, PERK, PERKS, relaunch, starsFor } from './prestige';
import { newGame } from './state';

describe('prestige', () => {
  it('prices perks in stars and lists real effects', () => {
    expect(PERKS.map((p) => p.id)).toEqual(['swift', 'deepDrills', 'headStart', 'archive', 'scholar', 'nightOwl']);
    for (const p of PERKS) {
      expect(p.cost).toBeGreaterThan(0);
      expect(Object.keys(p.effect).length).toBe(1);
    }
    expect(PERK.swift.effect.speed).toBeCloseTo(1.1);
    expect(PERK.deepDrills.effect.miners).toBeCloseTo(1.2);
  });

  it('counts stars from phases and from what the run made', () => {
    expect(starsFor({ phase: 0, madeTotal: 0 })).toBe(0);
    expect(starsFor({ phase: 3, madeTotal: 1999 })).toBe(6);
    expect(starsFor({ phase: 3, madeTotal: 2000 })).toBe(7);
    expect(starsFor({ phase: PHASES.length, madeTotal: 200_000 })).toBe(PHASES.length * 2 + 10);
  });

  it('relaunches only after the launch, granting stars and keeping the right things', () => {
    const s = newGame(0);
    s.inv = { ironPlate: 500, ironRod: 500 };
    const m = place(s, 'miner1', 4, 3).id!;
    const sm = place(s, 'smelter', 5, 3).id!;
    setRecipe(s, sm, 'ironIngot');
    connect(s, m, sm);
    s.milestones.push('fasteners');
    s.research.push('r-castScrew');
    s.sectors.push('east');
    s.shards = 3;
    s.made = { ironOre: 50_000 };
    s.madeTotal = 50_000;
    s.ach.push('first');
    s.rewards = { tasks: 4, study: 2 };
    s.insight = 3;
    s.event = { id: 'dust', left: 10 };
    expect(relaunch(s)).toMatchObject({ ok: false, error: expect.stringContaining('Launch Tower') });
    s.phase = PHASES.length;
    expect(canRelaunch(s).ok).toBe(true);
    const r = relaunch(s);
    expect(r).toMatchObject({ ok: true, stars: PHASES.length * 2 + 5 });
    expect(s.stars).toBe(PHASES.length * 2 + 5);
    expect(s.runs).toBe(1);
    expect(s.lifetime.relaunches).toBe(1);
    expect(s.buildings.map((b) => b.type)).toEqual(['camp']);
    expect(s.belts).toEqual([]);
    expect(s.inv).toEqual(START_INV);
    expect(s.milestones).toEqual([]);
    expect(s.research).toEqual([]);
    expect(s.sectors).toEqual(['home']);
    expect([s.phase, s.delivered, s.shards, s.event, s.madeTotal]).toEqual([0, {}, 0, null, 0]);
    expect(s.made.ironOre).toBe(50_000); // all-time stats stay
    expect(s.ach).toEqual(['first']);
    expect(s.rewards).toEqual({ tasks: 4, study: 2 });
    expect(s.insight).toBe(3);
  });

  it('buys perks with stars, and Head Start and Archive change the next relaunch', () => {
    const s = newGame(0);
    expect(buyPerk(s, 'swift')).toMatchObject({ ok: false, error: 'Needs 8 stars' });
    expect(buyPerk(s, 'nope').ok).toBe(false);
    s.stars = 20;
    expect(buyPerk(s, 'headStart').ok).toBe(true);
    expect(buyPerk(s, 'headStart')).toMatchObject({ ok: false, error: 'Already yours' });
    expect(buyPerk(s, 'archive').ok).toBe(true);
    expect(s.stars).toBe(20 - PERK.headStart.cost - PERK.archive.cost);
    expect(buyPerk(s, 'scholar').ok).toBe(false);
    s.research.push('r-castScrew');
    s.phase = PHASES.length;
    relaunch(s);
    expect(s.inv).toEqual({ ironPlate: START_INV.ironPlate! + 200, ironRod: START_INV.ironRod! + 200 });
    expect(s.research).toEqual(['r-castScrew']);
    expect(s.perks).toEqual(['headStart', 'archive']);
    expect(offlineCap(s)).toBe(8 * 3600);
    s.perks.push('nightOwl');
    expect(offlineCap(s)).toBe(10 * 3600);
  });
});
