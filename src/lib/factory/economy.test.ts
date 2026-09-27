import { describe, expect, it } from 'vitest';
import { bankStudy, bankTask, readPending, takePending, PENDING_KEY } from './bridge';
import { MARKET_DAILY_CAP, PHASES } from './data';
import { coinsPaidToday, roomToday, sellQuote } from './market';
import { applyOffer, boughtToday, canBuyOffer, COIN_SHOP, crateFor, NIGHT_SHIFT, OFFER, RUSH_CAP } from './shop';
import { newGame } from './state';

const day = '2026-09-27';

describe('market', () => {
  it('counts only market payouts for today', () => {
    const ledger = [
      { currency: 'coins', amount: 5, reason: 'factory', ref: `${day}:1` },
      { currency: 'coins', amount: 3, reason: 'factory', ref: `2026-09-26:1` },
      { currency: 'coins', amount: -15, reason: 'factory:crate', ref: day },
      { currency: 'coins', amount: 9, reason: 'task', ref: 'x' },
    ];
    expect(coinsPaidToday(ledger, day)).toBe(5);
    expect(roomToday(ledger, day)).toBe(MARKET_DAILY_CAP - 5);
  });

  it('pays whole coins and carries the fraction', () => {
    expect(sellQuote('motor', 10, 3, 0, 20)).toEqual({ qty: 3, coins: 1, credit: 0.5 });
    expect(sellQuote('motor', 10, 1, 0.5, 20)).toEqual({ qty: 1, coins: 1, credit: 0 });
    expect(sellQuote('ironPlate', 100, 100, 0, 20).qty).toBe(0); // not sellable
    expect(sellQuote('motor', 2, 50, 0, 20).qty).toBe(2); // only what you have
  });

  it('never pays past the daily cap', () => {
    const q = sellQuote('supercomputer', 100, 100, 0, 20);
    expect(q.coins).toBe(20);
    expect(q.qty).toBe(2);
    expect(sellQuote('supercomputer', 100, 100, 0, 0).qty).toBe(0);
    expect(sellQuote('motor', 100, 100, 0, 3)).toEqual({ qty: 7, coins: 3, credit: 0.5 });
  });
});

describe('coin shop', () => {
  it('prices offers between 5 and 50 coins with daily limits', () => {
    for (const o of COIN_SHOP) {
      expect(o.price).toBeGreaterThanOrEqual(5);
      expect(o.price).toBeLessThanOrEqual(50);
      expect(o.perDay).toBeGreaterThan(0);
    }
  });

  it('checks coins, daily limits and whether the offer still makes sense', () => {
    const s = newGame(0);
    expect(canBuyOffer(s, 'crate', 10, 0)).toMatchObject({ ok: false, error: 'Needs 15 coins' });
    expect(canBuyOffer(s, 'crate', 100, 3)).toMatchObject({ ok: false });
    expect(canBuyOffer(s, 'crate', 100, 2).ok).toBe(true);
    s.rushLeft = RUSH_CAP;
    expect(canBuyOffer(s, 'rush', 100, 0).ok).toBe(false);
    s.extraOffline = NIGHT_SHIFT;
    expect(canBuyOffer(s, 'nightShift', 100, 0).ok).toBe(false);
    s.phase = PHASES.length;
    expect(canBuyOffer(s, 'cargo', 100, 0).ok).toBe(false);
  });

  it('counts purchases per day from the ledger', () => {
    const ledger = [
      { currency: 'coins', amount: -15, reason: 'factory:crate', ref: day },
      { currency: 'coins', amount: -15, reason: 'factory:crate', ref: day },
      { currency: 'coins', amount: -15, reason: 'factory:crate', ref: '2026-09-01' },
      { currency: 'coins', amount: -25, reason: 'factory:rush', ref: day },
    ];
    expect(boughtToday(ledger, 'crate', day)).toBe(2);
    expect(boughtToday(ledger, 'rush', day)).toBe(1);
    expect(boughtToday(ledger, 'shard', day)).toBe(0);
  });

  it('applies each offer', () => {
    const s = newGame(0);
    applyOffer(s, 'crate');
    expect(s.inv.wire).toBe(crateFor(0).wire);
    applyOffer(s, 'rush');
    expect(s.rushLeft).toBe(30 * 60);
    applyOffer(s, 'rush');
    applyOffer(s, 'rush');
    expect(s.rushLeft).toBe(RUSH_CAP);
    applyOffer(s, 'nightShift');
    expect(s.extraOffline).toBe(NIGHT_SHIFT);
    applyOffer(s, 'shard');
    applyOffer(s, 'grant');
    expect([s.shards, s.insight]).toEqual([1, 1]);
    expect(OFFER.cargo.price).toBeLessThanOrEqual(50);
  });

  it('a cargo lift delivers a fifth of the phase and can finish it', () => {
    const s = newGame(0);
    applyOffer(s, 'cargo');
    expect(s.delivered.ironPlate).toBe(Math.ceil(PHASES[0].cost.ironPlate! * 0.2));
    for (let i = 0; i < 4; i++) applyOffer(s, 'cargo');
    expect(s.phase).toBe(1);
    expect(s.delivered).toEqual({});
  });
});

describe('homework bridge', () => {
  function memory() {
    const data = new Map<string, string>();
    return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), data };
  }

  it('banks each task once and study sessions, then hands them over', () => {
    const st = memory();
    bankTask(st, 't1');
    bankTask(st, 't1');
    bankTask(st, 't2');
    bankStudy(st);
    expect(readPending(st)).toMatchObject({ tasks: 2, study: 1 });
    expect(takePending(st)).toEqual({ tasks: 2, study: 1 });
    expect(takePending(st)).toEqual({ tasks: 0, study: 0 });
    bankTask(st, 't1'); // re-completed: already paid
    expect(readPending(st).tasks).toBe(0);
  });

  it('survives junk in storage', () => {
    const st = memory();
    st.setItem(PENDING_KEY, '{"tasks":"x","ids":5}');
    expect(readPending(st)).toEqual({ tasks: 0, study: 0, ids: [] });
    st.setItem(PENDING_KEY, 'nope');
    expect(readPending(st).tasks).toBe(0);
  });
});
