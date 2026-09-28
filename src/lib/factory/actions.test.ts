import { describe, expect, it } from 'vitest';
import {
  applyRewards,
  beltCost,
  beltLength,
  beltPath,
  benchCraft,
  canPlace,
  clearJam,
  completeMilestone,
  connect,
  deliverPhase,
  dismantle,
  doResearch,
  handMine,
  maxClock,
  phaseRemaining,
  place,
  removeBelt,
  rotate,
  setBeltFilter,
  setClock,
  setLoaderItem,
  setRecipe,
  surveySector,
  surveyed,
  upgradeBelt,
} from './actions';
import { BUILDING, PHASES, REWARD, SECTOR, START_INV } from './data';
import { startEvent } from './events';
import { newGame, unlocked, type FactoryState } from './state';

const fresh = (): FactoryState => newGame(0);

describe('building', () => {
  it('places miners only on unlocked nodes and machines only on open ground', () => {
    const s = fresh();
    expect(canPlace(s, 'miner1', 4, 3).ok).toBe(true); // iron
    expect(canPlace(s, 'miner1', 3, 3)).toMatchObject({ ok: false, error: expect.stringContaining('resource node') });
    expect(canPlace(s, 'miner1', 6, 1)).toMatchObject({ ok: false, error: expect.stringContaining("can't process") }); // copper: locked
    expect(canPlace(s, 'smelter', 4, 3).ok).toBe(false); // node
    expect(canPlace(s, 'smelter', 2, 5).ok).toBe(false); // camp
    expect(canPlace(s, 'smelter', 99, 0).ok).toBe(false);
    expect(canPlace(s, 'assembler', 5, 5)).toMatchObject({ ok: false, error: expect.stringContaining('unlocked') });
    expect(canPlace(s, 'pump', 16, 3).ok).toBe(false);
  });

  it('only builds in surveyed sectors', () => {
    const s = fresh();
    s.inv = { ironPlate: 1000, ironRod: 1000, concrete: 1000 };
    expect(surveyed(s, 5, 5)).toBe(true);
    expect(surveyed(s, 24, 5)).toBe(false);
    expect(canPlace(s, 'smelter', 24, 5)).toMatchObject({ ok: false, error: 'Survey that sector first' });
    expect(handMine(s, 22, 2)).toMatchObject({ ok: false, error: 'Survey that sector first' }); // pure iron on the east ridge
    expect(surveySector(s, 'east')).toMatchObject({ ok: false, error: expect.stringContaining('tier 1') });
    s.phase = 1;
    expect(surveySector(s, 'east')).toMatchObject({ ok: false, error: expect.stringContaining('insight') });
    s.insight = 1;
    expect(surveySector(s, 'east').ok).toBe(true);
    expect(s.insight).toBe(0);
    expect(s.inv.ironPlate).toBe(1000 - SECTOR.east.cost.ironPlate!);
    expect(s.sectors).toEqual(['home', 'east']);
    expect(surveySector(s, 'east')).toMatchObject({ ok: false, error: 'Already surveyed' });
    expect(surveySector(s, 'nowhere').ok).toBe(false);
    expect(canPlace(s, 'smelter', 24, 5).ok).toBe(true);
    expect(handMine(s, 22, 2).ok).toBe(true);
    s.insight = 5;
    expect(surveySector(s, 'south')).toMatchObject({ ok: false, error: expect.stringContaining('tier 2') });
  });

  it('charges the cost, and dismantling refunds it with the belts and buffers', () => {
    const s = fresh();
    const m = place(s, 'miner1', 4, 3);
    const sm = place(s, 'smelter', 5, 3);
    expect(s.inv.ironPlate).toBe(START_INV.ironPlate! - 10 - 6);
    connect(s, m.id!, sm.id!);
    expect(s.inv.ironPlate).toBe(START_INV.ironPlate! - 10 - 6 - 1);
    s.buildings.find((b) => b.id === sm.id)!.inBuf.ironOre = 3;
    expect(dismantle(s, sm.id!).ok).toBe(true);
    expect(dismantle(s, m.id!).ok).toBe(true);
    expect(s.inv).toMatchObject({ ...START_INV, ironOre: 3 });
    expect(s.belts).toEqual([]);
    expect(dismantle(s, 1).ok).toBe(false); // camp
  });

  it('refuses to build without the parts', () => {
    const s = fresh();
    s.inv = {};
    expect(place(s, 'smelter', 5, 5)).toMatchObject({ ok: false, error: 'Not enough parts' });
  });

  it('rotates, which changes where belts attach', () => {
    const s = fresh();
    const id = place(s, 'smelter', 5, 5).id!;
    rotate(s, id);
    const b = s.buildings.find((x) => x.id === id)!;
    expect(b.rot).toBe(1);
    const path = beltPath(b, { x: 5, y: 8, rot: 1 });
    expect(path[1]).toEqual({ x: 5.5, y: 6 }); // leaves from the south side
    expect(path.at(-1)).toEqual({ x: 5.5, y: 8.5 });
    // sinks take the belt on the side facing it
    const intoCamp = beltPath({ x: 5, y: 5, rot: 2 }, { x: 2, y: 5, rot: 0 }, true);
    expect(intoCamp.at(-2)).toEqual({ x: 3, y: 5.5 });
    expect(beltPath({ x: 5, y: 5, rot: 2 }, { x: 2, y: 5, rot: 0 }).at(-2)).toEqual({ x: 2, y: 5.5 });
  });
});

describe('belts', () => {
  it('checks outputs, inputs, duplicates, reach and tier', () => {
    const s = fresh();
    const m = place(s, 'miner1', 4, 3).id!;
    const sm = place(s, 'smelter', 5, 3).id!;
    expect(connect(s, sm, sm).ok).toBe(false);
    expect(connect(s, 1, sm)).toMatchObject({ ok: false, error: expect.stringContaining('no output') });
    expect(connect(s, sm, m)).toMatchObject({ ok: false, error: expect.stringContaining('no input') });
    expect(connect(s, m, sm, 2)).toMatchObject({ ok: false, error: expect.stringContaining('unlocked') });
    expect(connect(s, m, sm).ok).toBe(true);
    expect(connect(s, m, sm).ok).toBe(false);
  });

  it('costs per tile and upgrades for the difference', () => {
    const s = fresh();
    s.inv = { ironPlate: 500, ironRod: 500, screw: 500 };
    s.milestones.push('belts2');
    const m = place(s, 'miner1', 4, 3).id!;
    const d = place(s, 'depot', 8, 5).id!;
    const len = beltLength({ x: 4, y: 3 }, { x: 8, y: 5 });
    expect(len).toBe(6);
    expect(beltCost(1, len)).toEqual({ ironPlate: 6 });
    const before = s.inv.ironPlate!;
    const belt = connect(s, m, d).id!;
    expect(s.inv.ironPlate).toBe(before - 6);
    expect(upgradeBelt(s, belt, 2).ok).toBe(true);
    expect(s.inv.ironPlate).toBe(before - 6);
    expect(s.inv.screw).toBe(500 - 24);
    expect(removeBelt(s, belt).ok).toBe(true);
    expect(s.inv.screw).toBe(500);
  });

  it('filters carry one item, or anything again', () => {
    const s = fresh();
    const m = place(s, 'miner1', 4, 3).id!;
    const belt = connect(s, m, 1).id!;
    expect(setBeltFilter(s, belt, 'ironOre').ok).toBe(true);
    expect(s.belts[0].filter).toBe('ironOre');
    expect(setBeltFilter(s, belt, 'plutonium' as never)).toMatchObject({ ok: false, error: 'Unknown item' });
    expect(setBeltFilter(s, belt, undefined).ok).toBe(true);
    expect('filter' in s.belts[0]).toBe(false);
    expect(setBeltFilter(s, 999, 'ironOre').ok).toBe(false);
  });

  it('clears a jam', () => {
    const s = fresh();
    expect(clearJam(s)).toMatchObject({ ok: false });
    const m = place(s, 'miner1', 4, 3).id!;
    connect(s, m, 1);
    startEvent(s, 'jam');
    expect(s.event?.beltId).toBe(s.belts[0].id);
    expect(clearJam(s).ok).toBe(true);
    expect(s.event).toBeNull();
    startEvent(s, 'dust');
    expect(clearJam(s).ok).toBe(false); // not a jam
  });
});

describe('machines', () => {
  it('sets only unlocked recipes of the right building and returns buffers', () => {
    const s = fresh();
    const sm = place(s, 'smelter', 5, 5).id!;
    expect(setRecipe(s, sm, 'ironPlate').ok).toBe(false);
    expect(setRecipe(s, sm, 'copperIngot').ok).toBe(false);
    expect(setRecipe(s, sm, 'ironIngot').ok).toBe(true);
    s.buildings.find((b) => b.id === sm)!.outBuf.ironIngot = 4;
    setRecipe(s, sm, undefined);
    expect(s.inv.ironIngot).toBe(4);
  });

  it('a loader takes only real items and hands back what it held', () => {
    const s = fresh();
    s.milestones.push('logistics');
    s.inv = { ironPlate: 100, wire: 100, ironRod: 100 };
    const ld = place(s, 'loader', 5, 5).id!;
    const sm = place(s, 'smelter', 6, 5).id!;
    expect(setLoaderItem(s, sm, 'ironOre')).toMatchObject({ ok: false, error: "That isn't a loader" });
    expect(setLoaderItem(s, ld, 'mithril' as never)).toMatchObject({ ok: false, error: 'Unknown item' });
    expect(setLoaderItem(s, ld, 'ironOre').ok).toBe(true);
    const b = s.buildings.find((x) => x.id === ld)!;
    expect(b.item).toBe('ironOre');
    b.outBuf.ironOre = 7;
    expect(setLoaderItem(s, ld, undefined).ok).toBe(true);
    expect(b.item).toBeUndefined();
    expect(s.inv.ironOre).toBe(7);
    expect(setClock(s, ld, 2)).toBe(1);
  });

  it('overclocking uses shards and gives them back', () => {
    const s = fresh();
    const sm = place(s, 'smelter', 5, 5).id!;
    const b = s.buildings.find((x) => x.id === sm)!;
    expect(setClock(s, sm, 2)).toBe(1); // no shards: capped at 100%
    expect(setClock(s, sm, 0.4)).toBe(0.4);
    s.shards = 2;
    expect(maxClock(s, b)).toBe(2);
    expect(setClock(s, sm, 2.5)).toBe(2);
    expect(b.shards).toBe(2);
    expect(s.shards).toBe(0);
    setClock(s, sm, 1.2);
    expect(b.shards).toBe(1);
    expect(s.shards).toBe(1);
    dismantle(s, sm);
    expect(s.shards).toBe(2);
  });
});

describe('progress', () => {
  it('milestones cost parts and unlock things; later tiers wait for the Launch Tower', () => {
    const s = fresh();
    expect(completeMilestone(s, 'assembly').ok).toBe(false);
    expect(completeMilestone(s, 'fasteners').ok).toBe(true);
    expect(unlocked(s).recipes.has('screw')).toBe(true);
    expect(completeMilestone(s, 'fasteners').ok).toBe(false);
    s.inv = { ironPlate: 1000, screw: 1000, concrete: 1000 };
    expect(completeMilestone(s, 'assembly')).toMatchObject({ ok: false, error: expect.stringContaining('Launch Tower') });
    s.phase = 1;
    expect(completeMilestone(s, 'assembly').ok).toBe(true);
    expect(unlocked(s).buildings.has('assembler')).toBe(true);
  });

  it('delivers to the Launch Tower in parts and moves up a tier when complete', () => {
    const s = fresh();
    s.inv = { ironPlate: 100, wire: 1000, concrete: 1000 };
    const first = deliverPhase(s);
    expect(first.completed).toBe(false);
    expect(first.sent.ironPlate).toBe(100);
    expect(phaseRemaining(s).ironPlate).toBe(PHASES[0].cost.ironPlate! - 100);
    s.inv.ironPlate = 500;
    const second = deliverPhase(s);
    expect(second.completed).toBe(true);
    expect(s.phase).toBe(1);
    expect(s.shards).toBe(PHASES[0].shards);
    expect(s.inv.ironPlate).toBe(500 - (PHASES[0].cost.ironPlate! - 100));
    expect(unlocked(s).tier).toBe(1);
  });

  it('research needs insight and parts, and unlocks an alternate recipe', () => {
    const s = fresh();
    expect(doResearch(s, 'r-castScrew')).toMatchObject({ ok: false, error: expect.stringContaining('insight') });
    s.insight = 1;
    expect(doResearch(s, 'r-castScrew').ok).toBe(true);
    expect(s.insight).toBe(0);
    expect(unlocked(s).recipes.has('castScrew')).toBe(true);
    expect(doResearch(s, 'r-ironAlloy').ok).toBe(false); // tier 2
  });

  it('hand work keeps you from ever getting stuck', () => {
    const s = fresh();
    s.inv = {};
    expect(handMine(s, 4, 3).ok).toBe(true);
    expect(handMine(s, 6, 1).ok).toBe(false); // copper: locked
    expect(handMine(s, 3, 3).ok).toBe(false);
    expect(benchCraft(s, 'ironIngot').ok).toBe(true);
    expect(s.inv).toEqual({ ironOre: 0, ironIngot: 1 });
    expect(benchCraft(s, 'ironIngot').ok).toBe(false);
    expect(benchCraft(s, 'reinforcedPlate').ok).toBe(false);
  });

  it('homework rewards shards, insight and a capped boost', () => {
    const s = fresh();
    const got = applyRewards(s, 2, 1);
    expect(got.shards).toBe(2 * REWARD.task.shards);
    expect(s.insight).toBe(3);
    expect(s.boostLeft).toBe(2 * REWARD.task.boost + REWARD.study.boost);
    applyRewards(s, 40, 0);
    expect(s.boostLeft).toBe(REWARD.boostCap);
    expect(s.rewards).toEqual({ tasks: 42, study: 1 });
  });

  it('good days reward too, and the Scholar perk doubles task shards (never more)', () => {
    const s = fresh();
    expect(applyRewards(s, 0, 0, 2)).toEqual({ shards: 2 * REWARD.day.shards, insight: 2 * REWARD.day.insight, boost: 2 * REWARD.day.boost });
    expect(applyRewards(s, 1, 1)).toEqual({ shards: 1, insight: 2, boost: REWARD.task.boost + REWARD.study.boost });
    s.perks.push('scholar', 'scholar');
    expect(applyRewards(s, 3, 0).shards).toBe(6);
    expect(s.rewards).toEqual({ tasks: 4, study: 1 });
  });

  it('counts a launch when the last phase is delivered', () => {
    const s = fresh();
    s.phase = PHASES.length - 1;
    s.inv = { ...PHASES.at(-1)!.cost };
    expect(deliverPhase(s).completed).toBe(true);
    expect(s.phase).toBe(PHASES.length);
    expect(s.lifetime.launches).toBe(1);
    expect(deliverPhase(s).ok).toBe(false);
  });

  it('every building but the camp has a cost', () => {
    for (const b of Object.values(BUILDING)) if (b.id !== 'camp') expect(Object.keys(b.cost).length).toBeGreaterThan(0);
  });
});
