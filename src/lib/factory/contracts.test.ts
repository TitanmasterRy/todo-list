import { describe, expect, it } from 'vitest';
import { CONTRACT_COUNT, canClaim, claimContract, contractProgress, contractsFor, hash01, isClaimed, trackStocked, type ContractState } from './contracts';
import { ITEM } from './data';
import { newGame } from './state';

const DAY = '2026-09-28';
const NEXT = '2026-09-29';

function fresh(phase = 0): ContractState {
  const s = newGame(0) as ContractState;
  s.phase = phase;
  s.contracts = { day: DAY, done: [], progress: {} };
  s.lifetime = { launches: 0, contracts: 0, relaunches: 0 };
  return s;
}

describe('contractsFor', () => {
  it('hashes deterministically into [0, 1)', () => {
    expect(hash01('a')).toBe(hash01('a'));
    expect(hash01('a')).not.toBe(hash01('b'));
    for (const k of ['', 'x', '2026-09-28:ironPlate']) {
      expect(hash01(k)).toBeGreaterThanOrEqual(0);
      expect(hash01(k)).toBeLessThan(1);
    }
  });

  it('gives the same three contracts for the same day and different ones on other days', () => {
    const a = contractsFor(DAY, 2);
    expect(a).toHaveLength(CONTRACT_COUNT);
    expect(a).toEqual(contractsFor(DAY, 2));
    expect(new Set(a.map((c) => c.item)).size).toBe(CONTRACT_COUNT);
    const days = ['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03'];
    const seen = new Set(
      days.map((d) =>
        contractsFor(d, 2)
          .map((c) => c.item)
          .join(),
      ),
    );
    expect(seen.size).toBeGreaterThan(1);
    expect(contractsFor(NEXT, 2).map((c) => c.item)).not.toEqual(a.map((c) => c.item));
  });

  it('gates items by tier: crafted parts only, up to one tier above the player', () => {
    for (let tier = 0; tier <= 5; tier++) {
      for (const d of [DAY, NEXT, '2026-12-25']) {
        for (const c of contractsFor(d, tier)) {
          expect(ITEM[c.item].tier).toBeGreaterThanOrEqual(1);
          expect(ITEM[c.item].tier).toBeLessThanOrEqual(tier + 1);
        }
      }
    }
  });

  it('asks for 20–200 units, rewards shards or insight and never coins', () => {
    for (let tier = 0; tier <= 5; tier++) {
      for (const c of contractsFor(DAY, tier)) {
        expect(c.id).toBe(`${DAY}:${c.item}`);
        expect(c.qty).toBeGreaterThanOrEqual(20);
        expect(c.qty).toBeLessThanOrEqual(200);
        expect(Object.keys(c.reward)).toHaveLength(1);
        if (c.reward.shards !== undefined) expect([1, 2]).toContain(c.reward.shards);
        else expect([2, 3, 4]).toContain(c.reward.insight);
        expect('coins' in c.reward).toBe(false);
      }
    }
  });
});

describe('progress', () => {
  it('accumulates stocked contract items and ignores the rest', () => {
    const s = fresh();
    const [c] = contractsFor(DAY, 0);
    trackStocked(s, { [c.item]: 2.5, ironOre: 100 }, DAY);
    trackStocked(s, { [c.item]: 2.5 }, DAY);
    expect(contractProgress(s, c)).toBe(5);
    expect(s.contracts.progress.ironOre).toBeUndefined();
    expect(canClaim(s, c)).toBe(false);
  });

  it('caps progress at the quantity and rolls over to a new day', () => {
    const s = fresh();
    const [c] = contractsFor(DAY, 0);
    trackStocked(s, { [c.item]: c.qty + 50 }, DAY);
    expect(contractProgress(s, c)).toBe(c.qty);
    expect(canClaim(s, c)).toBe(true);
    trackStocked(s, {}, NEXT);
    expect(s.contracts).toEqual({ day: NEXT, done: [], progress: {} });
    expect(canClaim(s, c)).toBe(false); // yesterday's contract
  });
});

describe('claimContract', () => {
  it('pays once, bumps the lifetime count and refuses early or repeat claims', () => {
    const s = fresh();
    const [c] = contractsFor(DAY, 0);
    expect(claimContract(s, c, DAY)).toMatchObject({ ok: false, error: expect.stringContaining('Deliver') });
    trackStocked(s, { [c.item]: c.qty }, DAY);
    expect(claimContract(s, c, DAY)).toEqual({ ok: true });
    expect(isClaimed(s, c)).toBe(true);
    expect(s.shards).toBe(c.reward.shards ?? 0);
    expect(s.insight).toBe(c.reward.insight ?? 0);
    expect(s.lifetime.contracts).toBe(1);
    expect(claimContract(s, c, DAY)).toMatchObject({ ok: false, error: 'Already claimed' });
    expect(s.shards + s.insight).toBe((c.reward.shards ?? 0) + (c.reward.insight ?? 0));
  });

  it('expires yesterday’s contracts when the day changes', () => {
    const s = fresh();
    const [c] = contractsFor(DAY, 0);
    trackStocked(s, { [c.item]: c.qty }, DAY);
    expect(claimContract(s, c, NEXT)).toMatchObject({ ok: false, error: expect.stringContaining('expired') });
    expect(s.contracts.day).toBe(NEXT);
    expect(s.lifetime.contracts).toBe(0);
  });
});
