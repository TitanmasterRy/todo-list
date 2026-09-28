import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import * as ts from './caseclicker';
import type { Item, State } from './caseclicker';

// The game page carries its own plain-JS copy of the rules (it has to be one self-contained file).
// Pull that copy out and run every test against both, so the two can't drift apart.
const html = readFileSync(new URL('../../public/games/craterush.html', import.meta.url), 'utf8');
const inline = /\/\/ logic:start[^\n]*\n([\s\S]*?)^[ \t]*\/\/ logic:end/m.exec(html)?.[1];
const NAMES = Object.keys(ts);
const page = runInNewContext(`${inline}\n;({ ${NAMES.join(', ')} })`) as typeof ts;
/** Values from the page's realm, as plain JSON (so arrays and objects compare across realms). */
const plain = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const T0 = 1_750_000_000_000;

/** A seeded play session: every kind of action, logged, so both copies can be compared step by step. */
function session(m: typeof ts, seed: number) {
  const rng = m.mulberry32(seed);
  const st = m.newState(T0);
  const log: unknown[] = [];
  let now = T0;
  for (let k = 0; k < 400; k++) m.click(st, now);
  st.cash += 50_000; // skip ahead
  for (let round = 0; round < 25; round++) {
    now += 7_000;
    log.push(m.tick(st, 7, now));
    log.push(m.buyGen(st, round % 4, 1 + (round % 3)), m.buyGrip(st), m.buySynergy(st));
    const crate = round % 3;
    const got = m.openCrates(st, rng, crate, round % 2 ? 10 : 1);
    log.push(got && got.map((x) => [x.d, x.w, x.s, x.t, m.itemValue(x)]));
    if (round % 5 === 4) log.push(m.sellItems(st, m.duplicates(st).slice(0, 6)));
    const commons = st.inv.filter((x) => m.ITEMS[x.d].rarity === 0).slice(0, 10);
    if (commons.length === 10) {
      log.push(plain(m.tradeUpOutcomes(commons)));
      log.push(m.doTradeUp(st, rng, commons.map((x) => x.u)));
    }
    const stake = st.inv[st.inv.length - 1];
    if (stake && round % 4 === 1) {
      const targets = m.upgradeTargets(rng, m.itemValue(stake));
      log.push(targets.map((x) => [x.d, m.itemValue(x)]));
      if (targets[0]) log.push(m.doUpgrade(st, rng, stake.u, targets[0]));
    }
    if (round === 6) st.showcase = st.inv[0].u;
    if (round === 9) log.push(m.applyPowerup(st, 'cash', 'cash-1', now), m.applyPowerup(st, 'lucky', 'lucky-1', now), m.applyPowerup(st, 'boost', 'boost-1', now));
    log.push(m.checkAchievements(st));
  }
  log.push(m.applyOffline(st, now + 3 * 3600_000));
  const back = m.migrateSave(JSON.stringify(st), now);
  log.push(m.rebirth(back));
  return plain({ log, st, back });
}

describe('the page copy of the rules', () => {
  it('is present and exports the same things', () => {
    expect(inline).toBeTruthy();
    for (const k of NAMES) expect(typeof (page as Record<string, unknown>)[k], k).toBe(typeof (ts as Record<string, unknown>)[k]);
  });
  it('has the same tables', () => {
    for (const k of ['RARITIES', 'WEARS', 'KINDS', 'CRATES', 'ITEMS', 'GENERATORS', 'POWERUPS', 'MILESTONES', 'UPGRADE_STEPS'] as const) expect(plain(page[k]), k).toEqual(ts[k]);
    expect(page.ACHIEVEMENTS.map((a) => [a.id, a.name, a.desc])).toEqual(ts.ACHIEVEMENTS.map((a) => [a.id, a.name, a.desc]));
    const nums = NAMES.filter((k) => typeof (ts as Record<string, unknown>)[k] === 'number');
    expect(nums.length).toBeGreaterThan(20);
    for (const k of nums) expect((page as Record<string, unknown>)[k], k).toBe((ts as Record<string, unknown>)[k]);
  });
  it('plays out the same seeded session', () => {
    for (const seed of [1, 42, 2026]) expect(session(page, seed)).toEqual(session(ts, seed));
  });
});

describe.each([
  ['caseclicker.ts', ts],
  ['craterush.html', page],
])('rules (%s)', (_name, m) => {
  const item = (d: number, over: Partial<Item> = {}): Item => ({ u: 0, d, w: 0.2, s: 500, t: -1, l: 0, ...over });
  const defOf = (crate: number, rarity: number) => m.crateDefs(crate, rarity)[0];
  /** A state holding the given items (uids 1…n). */
  const holding = (items: Item[]): State => {
    const st = m.newState(T0);
    for (const it of items) st.inv.push({ ...it, u: st.uid++ });
    return st;
  };

  it('has odds that add up and every rarity in every crate', () => {
    expect(m.RARITIES.reduce((a, r) => a + r.odds, 0)).toBeCloseTo(1, 10);
    expect(m.RARITIES.map((r) => r.name)).toEqual(['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic', 'Exotic']);
    for (let c = 0; c < m.CRATES.length; c++) for (let r = 0; r < m.RARITIES.length; r++) expect(m.crateDefs(c, r).length, `${c}/${r}`).toBeGreaterThan(0);
    expect(new Set(m.ITEMS.map((x) => m.itemName(x.i))).size).toBe(m.ITEMS.length);
    for (let i = 1; i < m.CRATES.length; i++) expect(m.CRATES[i].price).toBeGreaterThan(m.CRATES[i - 1].price);
  });

  it('rolls rarities with the listed odds, and a lucky roll moves up a tier now and then', () => {
    const N = 200_000;
    const rng = m.mulberry32(7);
    const hits = m.RARITIES.map(() => 0);
    for (let k = 0; k < N; k++) hits[m.rollRarity(rng)]++;
    m.RARITIES.forEach((r, i) => {
      const sd = Math.sqrt(N * r.odds * (1 - r.odds));
      expect(Math.abs(hits[i] - N * r.odds), r.name).toBeLessThan(5 * sd + 2);
    });
    const lucky = m.RARITIES.map(() => 0);
    for (let k = 0; k < N; k++) lucky[m.rollRarity(rng, true)]++;
    expect(lucky[0] / N).toBeCloseTo(m.RARITIES[0].odds * (1 - m.LUCKY_BUMP), 2);
    expect(lucky[1]).toBeGreaterThan(hits[1]);
    expect(lucky.reduce((a, b) => a + b)).toBe(N); // never past Exotic
  });

  it('rolls wear by tier weight and names the tiers at their edges', () => {
    const rng = m.mulberry32(3);
    const tiers = m.WEARS.map(() => 0);
    for (let k = 0; k < 50_000; k++) {
      const w = m.rollWear(rng);
      expect(w).toBeGreaterThanOrEqual(0);
      expect(w).toBeLessThan(1);
      tiers[m.wearTier(w)]++;
    }
    m.WEARS.forEach((w, i) => expect(tiers[i] / 50_000, w.name).toBeCloseTo(w.weight, 1));
    expect([0, 0.0699, 0.07, 0.1499, 0.15, 0.38, 0.45, 0.9999].map(m.wearTier)).toEqual([0, 0, 1, 1, 2, 3, 4, 4]);
  });

  it('values items by rarity × wear, with Tracked, Prime and Flawless bonuses', () => {
    const d = defOf(0, 2);
    const base = m.ITEMS[d].base;
    expect(base).toBe(m.round2(m.CRATES[0].price * m.RARITIES[2].mult * 0.9));
    const scuffed = m.itemValue(item(d, { w: 0.38 - 1e-9 }));
    expect(scuffed).toBeCloseTo(base, 1);
    expect(m.itemValue(item(d, { w: 0.02 }))).toBeGreaterThan(m.itemValue(item(d, { w: 0.9 })) * 2);
    expect(m.itemValue(item(d, { w: 0.2, t: 0 }))).toBeCloseTo(m.itemValue(item(d, { w: 0.2 })) * m.TRACKED_MULT, 1);
    expect(m.itemValue(item(d, { w: 0.2, s: 3 }))).toBeCloseTo(m.itemValue(item(d, { w: 0.2 })) * 2, 1);
    expect(m.itemValue(item(d, { w: 0.005 }))).toBeCloseTo(m.itemValue(item(d, { w: 0.0101 })) * 1.5, 0);
    // rarer is always worth more at the same wear
    for (let r = 1; r < m.RARITIES.length; r++) expect(m.itemValue(item(defOf(3, r), { w: 0.9 }))).toBeGreaterThan(m.itemValue(item(defOf(3, r - 1), { w: 0.001, t: 0, s: 0 })) * 0.5);
  });

  it('pays back most of a crate on average, so cash still comes from clicking', () => {
    const rng = m.mulberry32(11);
    for (const c of [0, 4, 7]) {
      let sum = 0;
      for (let k = 0; k < 60_000; k++) sum += m.itemValue(m.rollItem(rng, c));
      const ev = sum / 60_000 / m.CRATES[c].price;
      expect(ev, m.CRATES[c].name).toBeGreaterThan(0.75);
      expect(ev).toBeLessThan(0.98);
    }
  });

  it('builds a reel with the winner at the stop', () => {
    const strip = m.reelStrip(m.mulberry32(1), 2, defOf(2, 5), 60, 50);
    expect(strip).toHaveLength(60);
    expect(strip[50]).toBe(defOf(2, 5));
    expect(strip.every((d) => m.ITEMS[d].crate === 2)).toBe(true);
  });

  it('opens crates for cash, fills the book, uses up lucky keys and respects the inventory limit', () => {
    const st = m.newState(T0);
    const rng = m.mulberry32(5);
    expect(m.openCrates(st, rng, 0, 1)).toBeNull();
    st.cash = 100;
    st.luck = 2;
    const got = m.openCrates(st, rng, 0, 5)!;
    expect(got).toHaveLength(5);
    expect(st.cash).toBe(50);
    expect(st.luck).toBe(0);
    expect(st.stats.opened).toBe(5);
    expect(st.stats.spent).toBe(50);
    expect(st.inv.map((x) => x.u)).toEqual([1, 2, 3, 4, 5]);
    expect(st.book.reduce((a, b) => a + b)).toBe(5);
    expect(st.stats.byRarity.reduce((a, b) => a + b)).toBe(5);
    expect(m.itemValue(st.stats.best!)).toBe(Math.max(...got.map(m.itemValue)));
    st.inv = Array.from({ length: m.INVENTORY_MAX - 1 }, (_, k) => item(0, { u: 100 + k }));
    expect(m.openCrates(st, rng, 0, 2)).toBeNull();
    expect(m.openCrates(st, rng, 0, 1)).toHaveLength(1);
  });

  it('earns from clicks and income, with milestones, showcase, synergy and boosts', () => {
    const st = m.newState(T0);
    expect(m.clickValue(st, T0)).toBe(1);
    expect(m.click(st, T0)).toBe(1);
    st.grip = 25;
    expect(m.clickValue(st, T0)).toBe(52);
    expect(m.genCost(0, 0)).toBe(15);
    expect(m.genCost(0, 10)).toBe(Math.ceil(15 * Math.pow(1.15, 10)));
    expect(m.genBulkCost(1, 3, 4)).toBe([3, 4, 5, 6].reduce((a, n) => a + m.genCost(1, n), 0));
    const n = m.genAffordable(0, 0, 1000);
    expect(m.genBulkCost(0, 0, n)).toBeLessThanOrEqual(1000);
    expect(m.genBulkCost(0, 0, n + 1)).toBeGreaterThan(1000);
    expect(m.genOutput(0, 24)).toBeCloseTo(24 * 0.3);
    expect(m.genOutput(0, 25)).toBeCloseTo(25 * 0.3 * 2);
    expect(m.genOutput(0, 100)).toBeCloseTo(100 * 0.3 * 8);
    st.gens[1] = 10; // 20/s
    expect(m.incomePerSec(st, T0)).toBeCloseTo(20);
    st.cash = 0;
    expect(m.tick(st, 2, T0 + 2000)).toBeCloseTo(40);
    expect(st.lastSeen).toBe(T0 + 2000);
    st.syn = 5; // +5% of income per click
    expect(m.clickValue(st, T0)).toBeCloseTo(52 + 1);
    st.boostUntil = T0 + 1000;
    expect(m.incomePerSec(st, T0)).toBeCloseTo(40);
    expect(m.incomePerSec(st, T0, false)).toBeCloseTo(20);
    expect(m.incomePerSec(st, T0 + 1000)).toBeCloseTo(20);
    // a showcased Legendary adds 20% to clicks, and a Tracked one counts them
    st.boostUntil = 0;
    st.syn = 0;
    st.inv.push(item(defOf(0, 4), { u: 9, t: 0 }));
    st.showcase = 9;
    expect(m.clickValue(st, T0)).toBeCloseTo(52 * 1.2);
    m.click(st, T0);
    m.click(st, T0);
    expect(st.inv[0].t).toBe(2);
    // stars, achievements and collections multiply everything
    st.stars = 3;
    st.ach = ['click1', 'open1'];
    st.claimed = [0];
    expect(m.globalMult(st, T0)).toBeCloseTo(1.3 * 1.04 * 1.05);
  });

  it('buys upgrades only when there is cash', () => {
    const st = m.newState(T0);
    expect(m.buyGen(st, 0, 1)).toBe(false);
    expect(m.buyGrip(st)).toBe(false);
    st.cash = 30;
    expect(m.buyGen(st, 0, 1)).toBe(true);
    expect(st.gens[0]).toBe(1);
    expect(st.cash).toBe(15);
    expect(m.buyGrip(st)).toBe(true);
    expect(st.grip).toBe(1);
    expect(st.cash).toBe(5);
    expect(m.buyGen(st, 99, 1)).toBe(false);
    st.cash = 1e15;
    for (let k = 0; k < 20; k++) m.buySynergy(st);
    expect(st.syn).toBe(m.SYNERGY_MAX);
  });

  it('sells items (never locked ones) and finds duplicates to sell', () => {
    const a = defOf(0, 0);
    const b = defOf(0, 1);
    const st = holding([item(a, { w: 0.5 }), item(a, { w: 0.01 }), item(a, { w: 0.9 }), item(b), item(b, { l: 1 }), item(defOf(1, 0))]);
    st.showcase = 3;
    // copy 2 of a is the best; b's locked copy is kept, so its other copy may go; the showcased a is kept too
    expect(m.duplicates(st).sort()).toEqual([1, 4]);
    const value = m.itemValue(st.inv[0]);
    expect(m.sellItems(st, [1, 5])).toBe(value);
    expect(st.inv.map((x) => x.u)).toEqual([2, 3, 4, 5, 6]);
    expect(st.cash).toBe(value);
    expect(st.stats.sold).toBe(value);
    m.sellItems(st, [3]);
    expect(st.showcase).toBe(0);
  });

  it('trades 10 of a rarity up to the next one, from the inputs’ collections', () => {
    const ten = (c: number, over: Partial<Item> = {}) => Array.from({ length: 10 }, () => item(defOf(c, 1), over));
    expect(m.tradeUpProblem(ten(0).slice(1))).toMatch(/Pick 10/);
    expect(m.tradeUpProblem([...ten(0).slice(1), item(defOf(0, 2))])).toMatch(/same rarity/);
    expect(m.tradeUpProblem(Array.from({ length: 10 }, () => item(defOf(0, 6))))).toMatch(/top/);
    expect(m.tradeUpProblem([...ten(0).slice(1), item(defOf(0, 1), { l: 1 })])).toMatch(/Unlock/);
    expect(m.tradeUp(m.mulberry32(1), ten(0).slice(1))).toBeNull();
    // 7 from crate 2 and 3 from crate 5: results come from those crates, 70/30
    const mixed = [...ten(2).slice(0, 7), ...ten(5).slice(0, 3)];
    const outs = m.tradeUpOutcomes(mixed);
    expect(outs.reduce((a, o) => a + o.chance, 0)).toBeCloseTo(1, 10);
    expect(outs.filter((o) => m.ITEMS[o.d].crate === 2).reduce((a, o) => a + o.chance, 0)).toBeCloseTo(0.7, 10);
    expect(outs.filter((o) => m.ITEMS[o.d].rarity === 3).reduce((a, o) => a + o.chance, 0)).toBeCloseTo(m.TRADE_UP_JUMP, 10);
    const rng = m.mulberry32(9);
    const seen = new Set<number>();
    for (let k = 0; k < 300; k++) {
      const w = mixed.map((x, i) => ({ ...x, w: 0.1 + i * 0.02 }));
      const out = m.tradeUp(rng, w)!;
      expect([2, 3]).toContain(m.ITEMS[out.d].rarity);
      expect([2, 5]).toContain(m.ITEMS[out.d].crate);
      expect(out.w).toBeCloseTo(0.19, 4);
      expect(out.t).toBe(-1);
      seen.add(out.d);
    }
    expect(seen.size).toBe(outs.length);
    expect(m.tradeUp(rng, ten(0, { t: 4 }))!.t).toBe(0); // all Tracked in → Tracked out
    // in a state: the inputs go, the result arrives
    const st = holding(ten(3));
    const out = m.doTradeUp(st, rng, st.inv.map((x) => x.u))!;
    expect(st.inv).toEqual([out]);
    expect(st.stats.tradeups).toBe(1);
    expect(m.doTradeUp(st, rng, [out.u])).toBeNull();
    expect(m.doTradeUp(holding(ten(3)), rng, [1, 1, 2, 3, 4, 5, 6, 7, 8, 9])).toBeNull();
  });

  it('prices upgrades fairly and pays out at the shown odds', () => {
    expect(m.upgradeChance(10, 20)).toBeCloseTo(0.45);
    expect(m.upgradeChance(10, 11)).toBe(m.UPGRADE_MAX);
    expect(m.upgradeChance(0, 20)).toBe(0);
    expect(m.upgradeChance(10, 0)).toBe(0);
    const rng = m.mulberry32(21);
    const targets = m.upgradeTargets(rng, 5);
    expect(targets.length).toBeGreaterThanOrEqual(4);
    for (let k = 0; k < targets.length; k++) {
      expect(m.itemValue(targets[k])).toBeGreaterThan(5);
      if (k) expect(m.itemValue(targets[k])).toBeGreaterThanOrEqual(m.itemValue(targets[k - 1]));
    }
    expect(m.upgradeTargets(rng, 1e12)).toEqual([]);
    const stake = item(defOf(0, 2));
    const target = targets[1];
    const chance = m.upgradeChance(m.itemValue(stake), m.itemValue(target));
    let wins = 0;
    for (let k = 0; k < 4000; k++) {
      const st = holding([stake]);
      const res = m.doUpgrade(st, rng, 1, target)!;
      expect(res.chance).toBe(chance);
      expect(res.win).toBe(res.roll < chance);
      expect(st.inv).toHaveLength(res.win ? 1 : 0);
      if (res.win) {
        wins++;
        expect(st.inv[0].d).toBe(target.d);
      }
    }
    expect(wins / 4000).toBeCloseTo(chance, 1);
    expect(m.doUpgrade(holding([{ ...stake, l: 1 }]), rng, 1, target)).toBeNull();
  });

  it('pays offline earnings at half rate, for up to 4 hours', () => {
    expect(m.offlineEarnings(10, 30)).toEqual({ seconds: 0, cash: 0 });
    expect(m.offlineEarnings(0, 3600)).toEqual({ seconds: 0, cash: 0 });
    expect(m.offlineEarnings(10, 3600)).toEqual({ seconds: 3600, cash: 18000 });
    expect(m.offlineEarnings(10, 24 * 3600)).toEqual({ seconds: 4 * 3600, cash: 72000 });
    const st = m.newState(T0);
    st.gens[0] = 10; // 3/s
    st.boostUntil = T0 + 9e9; // boosts don't count offline
    const r = m.applyOffline(st, T0 + 7200_000);
    expect(r.cash).toBeCloseTo(3 * 7200 * 0.5);
    expect(st.cash).toBe(r.cash);
    expect(st.stats.offline).toBe(r.cash);
    expect(st.lastSeen).toBe(T0 + 7200_000);
    expect(m.applyOffline(st, T0 + 7200_000).cash).toBe(0);
  });

  it('pays each collection once, when every item is found', () => {
    const st = m.newState(T0);
    expect(m.claimCollection(st, 0)).toBe(0);
    for (const x of m.ITEMS) if (x.crate === 0) st.book[x.i] = 1;
    expect(m.collectionDone(st, 0)).toBe(true);
    expect(m.claimCollection(st, 0)).toBe(m.CRATES[0].price * m.COLLECTION_REWARD);
    expect(m.claimCollection(st, 0)).toBe(0);
    expect(plain(st.claimed)).toEqual([0]);
    expect(m.claimCollection(st, 99)).toBe(0);
  });

  it('rebirths for stars, keeping the book, trophies and power-ups', () => {
    const st = holding([item(0)]);
    st.runEarned = 999_999;
    expect(m.rebirth(st)).toBe(0);
    st.runEarned = 4e6;
    st.cash = 123;
    st.gens[0] = 5;
    st.grip = 9;
    st.book[0] = 3;
    st.ach = ['click1'];
    st.luck = 4;
    st.showcase = 1;
    expect(m.starsFor(4e6)).toBe(2);
    expect(m.rebirth(st)).toBe(2);
    expect([st.stars, st.rebirths, st.cash, st.runEarned, st.gens[0], st.grip, st.inv.length, st.showcase]).toEqual([2, 1, 0, 0, 0, 0, 0, 0]);
    expect([st.book[0], st.ach.length, st.luck]).toEqual([3, 1, 4]);
  });

  it('applies each power-up purchase once', () => {
    const st = m.newState(T0);
    expect(m.applyPowerup(st, 'nope', 'nope-1', T0)).toBe(false);
    expect(m.applyPowerup(st, 'lucky', '', T0)).toBe(false);
    expect(m.applyPowerup(st, 'lucky', 'lucky-1', T0)).toBe(true);
    expect(m.applyPowerup(st, 'lucky', 'lucky-1', T0)).toBe(false);
    expect(st.luck).toBe(m.LUCKY_PACK);
    const amount = m.cashCrateAmount(st, T0);
    expect(amount).toBe(100);
    expect(m.applyPowerup(st, 'cash', 'cash-1', T0)).toBe(true);
    expect(st.cash).toBe(100);
    expect(m.applyPowerup(st, 'boost', 'boost-1', T0)).toBe(true);
    expect(m.applyPowerup(st, 'boost', 'boost-2', T0)).toBe(true);
    expect(st.boostUntil).toBe(T0 + 2 * m.BOOST_MS);
    for (let k = 0; k < 60; k++) m.applyPowerup(st, 'cash', `c-${k}`, T0);
    expect(st.bought).toHaveLength(50);
    for (const p of Object.values(m.POWERUPS)) {
      expect(Number.isInteger(p.cost) && p.cost >= 1 && p.cost <= 50).toBe(true);
      expect(p.label.length).toBeLessThanOrEqual(60);
    }
  });

  it('unlocks achievements once', () => {
    const st = m.newState(T0);
    expect(plain(m.checkAchievements(st))).toEqual([]);
    m.click(st, T0);
    expect(plain(m.checkAchievements(st))).toEqual(['click1']);
    expect(plain(m.checkAchievements(st))).toEqual([]);
    expect(new Set(m.ACHIEVEMENTS.map((a) => a.id)).size).toBe(m.ACHIEVEMENTS.length);
  });

  it('round-trips saves and repairs broken ones', () => {
    const st = m.newState(T0);
    const rng = m.mulberry32(4);
    st.cash = 5000;
    m.openCrates(st, rng, 1, 20);
    st.showcase = st.inv[3].u;
    st.inv[2].l = 1;
    st.ach = ['open1'];
    const back = m.migrateSave(JSON.stringify(st), T0 + 1);
    expect(plain(back)).toEqual(plain(st));
    for (const bad of [null, '', 'nope{', '[1,2]', 42, { v: 'x' }]) {
      const fresh = m.migrateSave(bad, T0);
      expect(plain(fresh)).toEqual(plain(m.newState(T0)));
    }
    const broken = {
      v: 1,
      cash: -50,
      grip: 'lots',
      gens: [3, -1, 2.7],
      inv: [{ u: 5, d: 0, w: 2, s: 5000, t: 3 }, { u: 5, d: 1 }, { u: 9, d: 99999 }, 'junk', { d: 2, l: true }],
      uid: 2,
      book: [1, 2],
      claimed: [0, 0, 99, 'a'],
      ach: ['click1', 'made-up', 'click1'],
      stats: { clicks: 12, byRarity: [4] },
      showcase: 9,
      lastSeen: T0 + 1e9,
      bought: ['a', 7, 'b'],
      sound: false,
    };
    const fixed = m.migrateSave(JSON.stringify(broken), T0);
    expect(fixed.cash).toBe(0);
    expect(fixed.grip).toBe(0);
    expect(plain(fixed.gens.slice(0, 3))).toEqual([3, 0, 2]);
    expect(fixed.inv.map((x) => [x.d, x.w, x.s, x.t, x.l])).toEqual([
      [0, 0.9999, 999, 3, 0],
      [1, 0.5, 500, -1, 0],
      [2, 0.5, 500, -1, 1],
    ]);
    expect(new Set(fixed.inv.map((x) => x.u)).size).toBe(3);
    expect(fixed.uid).toBeGreaterThan(Math.max(...fixed.inv.map((x) => x.u)));
    expect(fixed.book).toHaveLength(m.ITEMS.length);
    expect(plain(fixed.claimed)).toEqual([0]);
    expect(plain(fixed.ach)).toEqual(['click1']);
    expect(fixed.stats.clicks).toBe(12);
    expect(fixed.stats.byRarity).toHaveLength(m.RARITIES.length);
    expect(fixed.showcase).toBe(0); // pointed at an item that was dropped
    expect(fixed.lastSeen).toBe(T0); // no earnings from a clock in the future
    expect(plain(fixed.bought)).toEqual(['a', 'b']);
    expect(fixed.sound).toBe(false);
    expect(fixed.v).toBe(m.SAVE_VERSION);
    // a save from a newer version still loads what it can
    expect(m.migrateSave(JSON.stringify({ ...plain(st), v: m.SAVE_VERSION + 3, extra: 1 }), T0 + 1).inv).toHaveLength(20);
    // a full inventory stays under the app's 1 MB save limit
    const full = m.newState(T0);
    full.inv = Array.from({ length: m.INVENTORY_MAX }, (_, k) => item(m.ITEMS.length - 1, { u: k + 1, w: 0.123456, s: 999, t: 123456, l: 1 }));
    expect(JSON.stringify(full).length).toBeLessThan(1024 * 1024 / 4);
  });

  it('reports a score within the app’s limit', () => {
    const st = m.newState(T0);
    st.stats.earned = 1234.9;
    expect(m.scoreOf(st)).toBe(1234);
    st.stats.earned = 1e20;
    expect(m.scoreOf(st)).toBe(m.SCORE_MAX);
    expect(m.SCORE_MAX).toBeLessThan(1e12);
  });
});
