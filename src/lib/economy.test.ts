import { describe, expect, it } from 'vitest';
import {
  balance,
  balances,
  canBuy,
  cashedOutOn,
  cashoutEntries,
  cashoutQuote,
  CASHOUT_DAILY_MAX,
  CASHOUT_RATE,
  coinsForXp,
  lifetimeEarned,
  parsePowerup,
  POWERUP_MAX_COST,
  purchaseEntries,
  SHOP,
  shopItem,
} from './economy';
import type { LedgerEntry } from './types';

let n = 0;
const entry = (e: Omit<LedgerEntry, 'id' | 'at'>): LedgerEntry => ({ ...e, id: String(n++), at: '2026-09-20T00:00:00.000Z' });
const apply = (ledger: LedgerEntry[], es: Omit<LedgerEntry, 'id' | 'at'>[]) => [...ledger, ...es.map(entry)];

describe('economy', () => {
  it('coins scale with XP and never pay zero', () => {
    expect(coinsForXp(0)).toBe(1);
    expect(coinsForXp(10)).toBe(2);
    expect(coinsForXp(60)).toBe(12);
  });
  it('balances sum per currency and items', () => {
    const l = [
      entry({ currency: 'coins', amount: 50, reason: 'task' }),
      entry({ currency: 'coins', amount: -20, reason: 'shop:x' }),
      entry({ currency: 'item:booster', amount: 3, reason: 'shop:booster' }),
      entry({ currency: 'item:booster', amount: -1, reason: 'booster' }),
    ];
    const b = balances(l);
    expect(b.coins).toBe(30);
    expect(b.items.booster).toBe(2);
    expect(balance(l, 'chips')).toBe(0);
  });
  it('buying chips spends coins and grants chips', () => {
    let l = [entry({ currency: 'coins', amount: 10, reason: 'task' })];
    const item = shopItem('chips-100')!;
    expect(canBuy(l, item, { freezes: 0, maxFreezes: 2 }).ok).toBe(true);
    l = apply(l, purchaseEntries(item));
    expect(balances(l)).toMatchObject({ coins: 0, chips: 100 });
    expect(canBuy(l, item, { freezes: 0, maxFreezes: 2 })).toEqual({ ok: false, reason: 'Need 10 more' });
  });
  it('unique items can only be bought once', () => {
    let l = [entry({ currency: 'coins', amount: 1000, reason: 'task' })];
    const item = shopItem('title-scholar')!;
    l = apply(l, purchaseEntries(item));
    expect(canBuy(l, item, { freezes: 0, maxFreezes: 2 })).toEqual({ ok: false, reason: 'Owned' });
  });
  it('freeze respects the cap and grants no item', () => {
    const l = [entry({ currency: 'coins', amount: 1000, reason: 'task' })];
    const item = shopItem('freeze')!;
    expect(canBuy(l, item, { freezes: 2, maxFreezes: 2 }).ok).toBe(false);
    expect(purchaseEntries(item)).toHaveLength(1);
  });
  it('prize counter is paid in chips', () => {
    for (const i of SHOP.filter((x) => x.section === 'prizes')) expect(i.pay).toBe('chips');
    for (const i of SHOP.filter((x) => x.section !== 'prizes')) expect(i.pay).toBe('coins');
  });
  it('no shop item turns chips into coins', () => {
    for (const i of SHOP) expect(i.pay === 'chips' && i.grant?.currency === 'coins').toBe(false);
  });
});

describe('cashing chips out and coin power-ups', () => {
  const at = (day: string) => `${day}T12:00:00.000Z`;
  const e = (currency: LedgerEntry['currency'], amount: number, reason: string, day = '2026-09-27'): LedgerEntry => ({
    id: `${reason}${amount}${day}`,
    at: at(day),
    currency,
    amount,
    reason,
  });

  it('quotes whole coins at half value within the daily limit', () => {
    const ledger = [e('chips', 5000, 'shop:chips-550')];
    expect(cashoutQuote(ledger, 450, '2026-09-27')).toEqual({ coins: 22, chips: 440, leftToday: CASHOUT_DAILY_MAX });
    expect(cashoutQuote(ledger, 99999, '2026-09-27').coins).toBe(CASHOUT_DAILY_MAX);
    const used = [...ledger, e('coins', 90, 'cashout')];
    expect(cashedOutOn(used, '2026-09-27')).toBe(90);
    expect(cashoutQuote(used, 5000, '2026-09-27').coins).toBe(10);
    expect(cashoutQuote(used, 5000, '2026-09-28').coins).toBe(CASHOUT_DAILY_MAX);
    expect(cashoutQuote([], 1000, '2026-09-27').coins).toBe(0);
  });
  it('makes balanced ledger entries that do not count as earned', () => {
    const entries = cashoutEntries(5);
    expect(entries).toEqual([
      { currency: 'chips', amount: -5 * CASHOUT_RATE, reason: 'cashout' },
      { currency: 'coins', amount: 5, reason: 'cashout' },
    ]);
    const ledger = [e('coins', 30, 'task'), e('coins', 5, 'cashout'), e('coins', -10, 'game:blocks')];
    expect(lifetimeEarned(ledger)).toBe(30);
  });
  it('accepts only well-formed power-up requests from games', () => {
    expect(parsePowerup({ type: 'hwtodo:buy', id: 'reroll-1', label: 'Reroll pieces', cost: 5 })).toEqual({ id: 'reroll-1', label: 'Reroll pieces', cost: 5 });
    expect(parsePowerup({ type: 'hwtodo:buy', id: 'x', label: 'x', cost: POWERUP_MAX_COST + 1 })).toBeNull();
    expect(parsePowerup({ type: 'hwtodo:buy', id: 'x', label: 'x', cost: 2.5 })).toBeNull();
    expect(parsePowerup({ type: 'hwtodo:buy', id: 'BAD ID', label: 'x', cost: 1 })).toBeNull();
    expect(parsePowerup({ type: 'hwtodo:buy', id: 'x', label: '   ', cost: 1 })).toBeNull();
    expect(parsePowerup({ type: 'hwtodo:score', score: 1 })).toBeNull();
    expect(parsePowerup({ type: 'hwtodo:buy', id: 'x', label: 'a‮b', cost: 1 })?.label).toBe('ab');
  });
});
