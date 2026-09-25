import { describe, expect, it } from 'vitest';
import { balance, balances, canBuy, coinsForXp, purchaseEntries, SHOP, shopItem } from './economy';
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
    const l = [entry({ currency: 'coins', amount: 50, reason: 'task' }), entry({ currency: 'coins', amount: -20, reason: 'shop:x' }), entry({ currency: 'item:booster', amount: 3, reason: 'shop:booster' }), entry({ currency: 'item:booster', amount: -1, reason: 'booster' })];
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
