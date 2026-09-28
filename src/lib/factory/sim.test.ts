import { describe, expect, it } from 'vitest';
import { connect, place, setBeltFilter, setClock, setLoaderItem, setRecipe } from './actions';
import { OFFLINE_CAP, STORAGE_CAP } from './data';
import { newGame, type FactoryState } from './state';
import { beltRate, catchUp, fullPower, minerMult, speedMult, STATUS_LABEL, tick, type Status, type TickReport } from './sim';

const CAMP_ID = 1;

function rich(): FactoryState {
  const s = newGame(0);
  s.inv = { ironPlate: 5000, ironRod: 5000, screw: 5000, wire: 500, reinforcedPlate: 500, steelBeam: 500 };
  s.milestones.push('logistics');
  return s;
}
function build(s: FactoryState, type: Parameters<typeof place>[1], x: number, y: number, rot: 0 | 1 | 2 | 3 = 0): number {
  const r = place(s, type, x, y, rot);
  if (!r.ok) throw new Error(r.error);
  return r.id!;
}
function link(s: FactoryState, a: number, b: number, tier = 1) {
  const r = connect(s, a, b, tier);
  if (!r.ok) throw new Error(r.error);
  return r.id!;
}
function run(s: FactoryState, n: number): TickReport {
  let rep!: TickReport;
  for (let i = 0; i < n; i++) rep = tick(s);
  return rep;
}

describe('factory tick', () => {
  it('mines ore, smelts it and stocks ingots at the camp', () => {
    const s = rich();
    const miner = build(s, 'miner1', 4, 3);
    const smelter = build(s, 'smelter', 5, 3);
    setRecipe(s, smelter, 'ironIngot');
    link(s, miner, smelter);
    link(s, smelter, CAMP_ID);
    const rep = run(s, 120);
    // 30/min for two minutes, less the first few seconds of warm-up
    expect(s.inv.ironIngot).toBeGreaterThan(55);
    expect(s.inv.ironIngot).toBeLessThanOrEqual(60);
    expect(rep.buildings[smelter].st).toBe('ok');
    expect(rep.buildings[smelter].eff).toBeCloseTo(1);
    expect(rep.belts[s.belts[1].id].rate).toBeCloseTo(30, 0);
    expect(s.made.ironOre).toBeCloseTo(60, 0);
  });

  it('caps a belt at its tier speed and shows the source as blocked', () => {
    const s = rich();
    s.shards = 3;
    const miner = build(s, 'miner1', 10, 10); // pure iron: 60/min
    setClock(s, miner, 2.5); // 150/min
    const belt = link(s, miner, CAMP_ID, 1);
    const rep = run(s, 60);
    expect(rep.belts[belt].rate).toBeCloseTo(beltRate(1), 5);
    expect(rep.buildings[miner].st).toBe('blocked');
    expect(rep.buildings[miner].eff).toBeCloseTo(60 / 150, 2);
    expect(s.inv.ironOre).toBeGreaterThan(55);
    expect(s.inv.ironOre).toBeLessThanOrEqual(61);
  });

  it('a starved building runs at the rate its inputs arrive', () => {
    const s = rich();
    const miner = build(s, 'miner1', 5, 8); // impure iron: 15/min
    const smelter = build(s, 'smelter', 6, 8);
    setRecipe(s, smelter, 'ironIngot');
    link(s, miner, smelter);
    link(s, smelter, CAMP_ID);
    const rep = run(s, 60);
    expect(rep.buildings[smelter].st).toBe('starved');
    expect(rep.buildings[smelter].eff).toBeCloseTo(0.5, 1);
  });

  it('a building with nowhere to send its output ends up blocked', () => {
    const s = rich();
    const miner = build(s, 'miner1', 4, 3);
    const smelter = build(s, 'smelter', 5, 3);
    setRecipe(s, smelter, 'ironIngot');
    link(s, miner, smelter);
    const rep = run(s, 200);
    expect(rep.buildings[smelter].st).toBe('blocked');
    expect(rep.buildings[miner].st).toBe('blocked');
    expect(s.buildings.find((b) => b.id === smelter)!.outBuf.ironIngot).toBeCloseTo(20);
  });

  it('splits one output fairly over several belts', () => {
    const s = rich();
    const miner = build(s, 'miner1', 10, 10); // 60/min
    const d1 = build(s, 'depot', 11, 9);
    const d2 = build(s, 'depot', 11, 11);
    const b1 = link(s, miner, d1);
    const b2 = link(s, miner, d2);
    const rep = run(s, 30);
    expect(rep.belts[b1].rate).toBeCloseTo(30, 1);
    expect(rep.belts[b2].rate).toBeCloseTo(30, 1);
  });

  it('slows everything down in proportion when power runs short', () => {
    const s = rich();
    const miners = [
      [4, 3],
      [5, 8],
      [10, 10],
      [18, 4],
      [1, 2],
    ].map(([x, y]) => build(s, 'miner1', x, y));
    expect(miners.length).toBe(5);
    const rep = tick(s); // 5 × 5 MW = 25 MW on a 20 MW camp
    expect(rep.power.demand).toBeCloseTo(25);
    expect(rep.power.capacity).toBeCloseTo(20);
    expect(rep.power.factor).toBeCloseTo(0.8);
    expect(rep.buildings[miners[0]].st).toBe('power');
    expect(s.made.ironOre).toBeCloseTo(((30 + 15 + 60 + 60) / 60) * 0.8);
  });

  it('generators add capacity while they have fuel, and burn it by load', () => {
    const s = rich();
    const grove = build(s, 'miner1', 3, 10); // pure grove: 60 biomass/min
    const burner = build(s, 'biomassBurner', 4, 10);
    link(s, grove, burner);
    let rep = tick(s);
    expect(rep.buildings[burner].st).toBe('nofuel');
    rep = run(s, 70);
    expect(rep.power.capacity).toBeCloseTo(50);
    expect(rep.buildings[burner].st).toBe('ok');
    // only 5 MW of demand, all of it covered by the camp: the burner idles and keeps its fuel
    const b = s.buildings.find((x) => x.id === burner)!;
    expect(b.inBuf.biomass).toBeCloseTo(50);
  });

  it('draws power super-linearly with the clock', () => {
    const s = rich();
    s.shards = 2;
    const miner = build(s, 'miner1', 4, 3);
    const b = s.buildings.find((x) => x.id === miner)!;
    expect(fullPower(b)).toBe(5);
    setClock(s, miner, 2);
    expect(fullPower(b)).toBeGreaterThan(10);
    setClock(s, miner, 0.5);
    expect(fullPower(b)).toBeLessThan(2.5);
  });

  it('homework boosts and rush orders speed machines up and run out', () => {
    const s = rich();
    s.boostLeft = 30;
    s.rushLeft = 10;
    const miner = build(s, 'miner1', 4, 3);
    link(s, miner, CAMP_ID);
    const rep = tick(s);
    expect(rep.boost).toBeCloseTo(1.25 * 1.5);
    expect(s.made.ironOre).toBeCloseTo((30 / 60) * 1.25 * 1.5);
    run(s, 40);
    expect(s.boostLeft).toBe(0);
    expect(s.rushLeft).toBe(0);
    expect(tick(s).boost).toBe(1);
  });

  it('counts everything made this run and labels every status', () => {
    const s = rich();
    build(s, 'miner1', 4, 3);
    run(s, 60);
    expect(s.madeTotal).toBeCloseTo(30, 0);
    expect(s.madeTotal).toBeCloseTo(s.made.ironOre!);
    for (const st of ['ok', 'starved', 'blocked', 'power', 'off', 'idle', 'nofuel'] as Status[]) expect(STATUS_LABEL[st]).toBeTruthy();
    expect(STATUS_LABEL.ok).toBe('Running');
  });

  it('perks speed machines and miners up on top of boosts', () => {
    const s = rich();
    expect(speedMult(s)).toBe(1);
    s.perks.push('swift', 'deepDrills');
    expect(speedMult(s)).toBeCloseTo(1.1);
    expect(minerMult(s)).toBeCloseTo(1.1 * 1.2);
    s.boostLeft = 100;
    expect(minerMult(s)).toBeCloseTo(1.25 * 1.1 * 1.2);
    const miner = build(s, 'miner1', 4, 3);
    link(s, miner, CAMP_ID);
    tick(s);
    expect(s.made.ironOre).toBeCloseTo((30 / 60) * 1.25 * 1.1 * 1.2);
  });

  it('paused and recipe-less machines do nothing and draw nothing', () => {
    const s = rich();
    const smelter = build(s, 'smelter', 5, 3);
    const miner = build(s, 'miner1', 4, 3);
    s.buildings.find((b) => b.id === miner)!.off = true;
    const rep = tick(s);
    expect(rep.buildings[smelter].st).toBe('idle');
    expect(rep.buildings[miner].st).toBe('off');
    expect(rep.power.demand).toBe(0);
  });
});

describe('logistics', () => {
  it('a loader feeds a smelter from stock', () => {
    const s = rich();
    s.inv.ironOre = 300;
    const loader = build(s, 'loader', 5, 5);
    const smelter = build(s, 'smelter', 6, 5);
    setRecipe(s, smelter, 'ironIngot');
    link(s, loader, smelter);
    link(s, smelter, CAMP_ID);
    let rep = tick(s);
    expect(rep.buildings[loader].st).toBe('idle');
    setLoaderItem(s, loader, 'ironOre');
    rep = run(s, 120);
    expect(rep.buildings[loader].st).toBe('blocked'); // the smelter only takes 30/min
    expect(rep.buildings[smelter].st).toBe('ok');
    expect(rep.used.ironOre).toBeGreaterThan(0);
    expect(s.inv.ironIngot).toBeGreaterThan(50);
    expect(s.inv.ironOre).toBeLessThan(200);
    rep = run(s, 600);
    expect(s.inv.ironOre).toBe(0);
    expect(rep.buildings[loader].st).toBe('starved');
    expect(s.inv.ironIngot).toBeCloseTo(300, 0);
  });

  it('a filtered belt carries only its item', () => {
    const s = rich();
    s.inv.ironOre = 100;
    s.inv.copperOre = 100;
    const a = build(s, 'loader', 5, 5);
    const b = build(s, 'loader', 5, 7);
    setLoaderItem(s, a, 'ironOre');
    setLoaderItem(s, b, 'copperOre');
    const store = build(s, 'storage', 7, 6);
    link(s, a, store);
    link(s, b, store);
    const d1 = build(s, 'depot', 9, 5);
    const d2 = build(s, 'depot', 9, 7);
    setBeltFilter(s, link(s, store, d1), 'ironOre');
    setBeltFilter(s, link(s, store, d2), 'copperOre');
    run(s, 30);
    const st = s.buildings.find((x) => x.id === store)!;
    expect(st.outBuf.ironOre ?? 0).toBeLessThan(2);
    expect(st.outBuf.copperOre ?? 0).toBeLessThan(2);
    expect(s.inv.ironOre).toBeGreaterThan(95); // pulled out and dropped back in through the iron belt (a few in transit)
    expect(s.inv.copperOre).toBeGreaterThan(95);
    // block the copper: the filter keeps it off the iron belt
    setBeltFilter(s, s.belts[3].id, 'ironPlate');
    run(s, 60);
    expect(st.outBuf.copperOre).toBeGreaterThan(30);
    expect(st.outBuf.ironOre ?? 0).toBeLessThan(2);
  });

  it('storage buffers a burst and lets it out at belt speed', () => {
    const s = rich();
    s.shards = 3;
    s.milestones.push('belts2', 'belts3');
    const miner = build(s, 'miner1', 10, 10); // pure iron
    setClock(s, miner, 2); // 120/min
    const store = build(s, 'storage', 11, 10);
    link(s, miner, store, 3); // 270/min in
    link(s, store, CAMP_ID, 1); // 60/min out
    let rep = run(s, 60);
    expect(rep.buildings[miner].st).toBe('ok');
    const st = s.buildings.find((x) => x.id === store)!;
    expect(st.outBuf.ironOre).toBeGreaterThan(50);
    expect(rep.buildings[store].eff).toBeCloseTo(st.outBuf.ironOre! / STORAGE_CAP, 1);
    expect(s.inv.ironOre).toBeGreaterThan(55); // a belt's worth out, one tick behind
    rep = run(s, 600);
    expect(st.outBuf.ironOre! + (st.inBuf.ironOre ?? 0)).toBeLessThanOrEqual(STORAGE_CAP + 1e-6);
    expect(rep.buildings[miner].st).toBe('blocked');
  });
});

describe('offline progress', () => {
  function line(): FactoryState {
    const s = rich();
    const miner = build(s, 'miner1', 4, 3);
    link(s, miner, CAMP_ID);
    return s;
  }

  it('simulates short absences tick by tick', () => {
    const s = line();
    const away = catchUp(s, 600);
    expect(away.seconds).toBe(600);
    expect(away.simulated).toBe(600);
    expect(away.gained.ironOre).toBeCloseTo(300, -1);
  });

  it('extrapolates long absences from the steady rate', () => {
    const s = line();
    const away = catchUp(s, 3 * 3600);
    expect(away.simulated).toBeLessThan(away.seconds);
    expect(away.gained.ironOre!).toBeGreaterThan(30 * 180 - 20);
    expect(away.gained.ironOre!).toBeLessThanOrEqual(30 * 180 + 1);
    expect(s.simTime).toBe(3 * 3600);
  });

  it('caps at 8 hours, or 12 with a night shift that is then used up', () => {
    const s = line();
    expect(catchUp(s, 3 * 24 * 3600).seconds).toBe(OFFLINE_CAP);
    s.extraOffline = 4 * 3600;
    expect(catchUp(s, 3 * 24 * 3600).seconds).toBe(OFFLINE_CAP + 4 * 3600);
    expect(s.extraOffline).toBe(0);
    s.extraOffline = 4 * 3600;
    catchUp(s, 60); // short absence: the night shift is kept for later
    expect(s.extraOffline).toBe(4 * 3600);
  });

  it('counts boosts down while away, and only extrapolates boosted rates while the boost lasts', () => {
    const s = line();
    s.boostLeft = 1500; // boosted for 25 of the 180 minutes
    const away = catchUp(s, 3 * 3600);
    expect(s.boostLeft).toBe(0);
    const expected = 30 * 180 + 30 * 0.25 * 25;
    expect(away.gained.ironOre!).toBeGreaterThan(expected - 25);
    expect(away.gained.ironOre!).toBeLessThan(expected + 25);
  });

  it('Night Owl adds two hours, and loaders never extrapolate below empty stock', () => {
    const s = line();
    s.perks.push('nightOwl');
    expect(catchUp(s, 3 * 24 * 3600).seconds).toBe(OFFLINE_CAP + 2 * 3600);
    const t = rich();
    t.inv.ironOre = 1000;
    const loader = build(t, 'loader', 5, 5);
    setLoaderItem(t, loader, 'ironOre');
    link(t, loader, CAMP_ID);
    catchUp(t, 3 * 3600);
    expect(t.inv.ironOre).toBeGreaterThanOrEqual(0);
  });
});
