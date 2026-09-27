import { describe, expect, it } from 'vitest';
import { breakDue, buyWatchTime, countsTime, describeRules, NO_RULES, tickWatch, watchGate, watchMinutesLeft, type WatchUsage } from './limits';

const today = '2026-09-27';
const fresh: WatchUsage = { byDay: {}, creditMin: 0 };

describe('watch rules', () => {
  it('lets everything through with no rules (the default)', () => {
    expect(watchGate(NO_RULES, fresh, today, false)).toEqual({ ok: true, minutesLeft: Infinity });
    expect(countsTime(NO_RULES)).toBe(false);
    expect(describeRules(NO_RULES, fresh, today)).toEqual([]);
    expect(tickWatch(NO_RULES, fresh, today)).toEqual(fresh);
  });

  it("waits for today's ring", () => {
    const rules = { ...NO_RULES, ringFirst: true };
    expect(watchGate(rules, fresh, today, false)).toMatchObject({ ok: false, reason: 'ring' });
    expect(watchGate(rules, fresh, today, true).ok).toBe(true);
  });

  it('counts minutes against the daily limit', () => {
    const rules = { ...NO_RULES, dailyLimitMin: 30 };
    let u = fresh;
    for (let i = 0; i < 29; i++) u = tickWatch(rules, u, today);
    expect(watchGate(rules, u, today, false)).toEqual({ ok: true, minutesLeft: 1 });
    u = tickWatch(rules, u, today);
    expect(watchGate(rules, u, today, false)).toMatchObject({ ok: false, reason: 'limit' });
    // a new day starts over
    expect(watchGate(rules, u, '2026-09-28', false).ok).toBe(true);
  });

  it('sells watch time for vouchers', () => {
    const rules = { ...NO_RULES, voucherMin: 30 };
    expect(countsTime(rules)).toBe(true);
    expect(watchGate(rules, fresh, today, false)).toMatchObject({ ok: false, reason: 'voucher' });
    let u = buyWatchTime(rules, fresh);
    expect(u.creditMin).toBe(30);
    expect(watchGate(rules, u, today, false)).toEqual({ ok: true, minutesLeft: 30 });
    for (let i = 0; i < 30; i++) u = tickWatch(rules, u, today);
    expect(u.creditMin).toBe(0);
    expect(watchGate(rules, u, today, false)).toMatchObject({ ok: false, reason: 'voucher' });
  });

  it('the daily limit wins over vouchers, and the ring over both', () => {
    const rules = { voucherMin: 30, ringFirst: true, dailyLimitMin: 10, breakMin: 0 };
    const spent: WatchUsage = { byDay: { [today]: 10 }, creditMin: 0 };
    expect(watchGate(rules, spent, today, true)).toMatchObject({ ok: false, reason: 'limit' });
    expect(watchGate(rules, spent, today, false)).toMatchObject({ ok: false, reason: 'ring' });
    expect(watchMinutesLeft(rules, { byDay: { [today]: 5 }, creditMin: 20 }, today)).toBe(5);
    expect(describeRules(rules, { byDay: { [today]: 5 }, creditMin: 20 }, today)).toEqual([
      "Finish today's ring first",
      '1 🎟️ = 30 min (20 min paid for)',
      '5 of 10 min left today',
    ]);
  });

  it('reminds about a study break once per sitting', () => {
    const rules = { ...NO_RULES, breakMin: 45 };
    expect(breakDue(rules, 44 * 60_000, false)).toBe(false);
    expect(breakDue(rules, 45 * 60_000, false)).toBe(true);
    expect(breakDue(rules, 90 * 60_000, true)).toBe(false);
    expect(breakDue(NO_RULES, 999 * 60_000, false)).toBe(false);
  });
});
