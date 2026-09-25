// Coins economy: pure rules (catalog, rewards, balances). No real money anywhere: coins are earned
// by doing schoolwork, chips are bought with coins and never convert back, vouchers pay for arcade games.
import type { Currency, LedgerCurrency, LedgerEntry } from './types';

export const CURRENCY_EMOJI: Record<Currency, string> = { coins: '🪙', chips: '🎰', vouchers: '🎟️' };
export const CURRENCY_LABEL: Record<Currency, string> = { coins: 'Coins', chips: 'Chips', vouchers: 'Vouchers' };

// ---------- earning ----------
export const REWARDS = {
  ring: 10, // closing the daily ring
  pomodoro: 3,
  levelUpPerLevel: 5, // level × this
  dailyChipBonus: 100, // chips when the ring closes (once a day)
};

/** Coins for an XP payout (tasks, grades, study sessions). */
export function coinsForXp(xp: number): number {
  return Math.max(1, Math.round(xp / 5));
}

/** Coins for reaching a streak milestone (7, 14, 30, …). */
export function coinsForStreak(days: number): number {
  return Math.max(5, days * 2);
}

// ---------- balances ----------
export function balance(ledger: LedgerEntry[], currency: LedgerCurrency): number {
  let n = 0;
  for (const e of ledger) if (e.currency === currency) n += e.amount;
  return Math.max(0, Math.round(n));
}

export function balances(ledger: LedgerEntry[]): Record<Currency, number> & { items: Record<string, number> } {
  const out = { coins: 0, chips: 0, vouchers: 0, items: {} as Record<string, number> };
  for (const e of ledger) {
    if (e.currency === 'coins' || e.currency === 'chips' || e.currency === 'vouchers') out[e.currency] += e.amount;
    else if (e.currency.startsWith('item:')) {
      const id = e.currency.slice(5);
      out.items[id] = (out.items[id] ?? 0) + e.amount;
    }
  }
  out.coins = Math.max(0, Math.round(out.coins));
  out.chips = Math.max(0, Math.round(out.chips));
  out.vouchers = Math.max(0, Math.round(out.vouchers));
  for (const k of Object.keys(out.items)) if (out.items[k] <= 0) delete out.items[k];
  return out;
}

/** Lifetime coins earned (positive coin entries minus reversals of them). */
export function lifetimeEarned(ledger: LedgerEntry[]): number {
  let n = 0;
  for (const e of ledger) if (e.currency === 'coins' && !e.reason.startsWith('shop:')) n += e.amount;
  return Math.max(0, n);
}

// ---------- shop ----------
export type ShopKind = 'chips' | 'vouchers' | 'freeze' | 'booster' | 'title' | 'frame' | 'confetti' | 'trophy';
export type ShopSection = 'currency' | 'boosts' | 'cosmetics' | 'prizes';

export interface ShopItem {
  id: string;
  name: string;
  emoji: string;
  description: string;
  price: number;
  pay: Currency; // coins for the shop, chips for the prize counter
  kind: ShopKind;
  section: ShopSection;
  grant?: { currency: LedgerCurrency; amount: number }; // what the buyer receives
  unique?: boolean; // can only be owned once
}

export const SHOP: ShopItem[] = [
  // currency
  {
    id: 'chips-100',
    name: '100 chips',
    emoji: '🎰',
    description: 'A starter stack for the casino.',
    price: 10,
    pay: 'coins',
    kind: 'chips',
    section: 'currency',
    grant: { currency: 'chips', amount: 100 },
  },
  {
    id: 'chips-550',
    name: '550 chips',
    emoji: '🎰',
    description: '10% bonus chips.',
    price: 50,
    pay: 'coins',
    kind: 'chips',
    section: 'currency',
    grant: { currency: 'chips', amount: 550 },
  },
  {
    id: 'chips-1200',
    name: '1,200 chips',
    emoji: '💰',
    description: '20% bonus chips.',
    price: 100,
    pay: 'coins',
    kind: 'chips',
    section: 'currency',
    grant: { currency: 'chips', amount: 1200 },
  },
  {
    id: 'voucher-1',
    name: 'Arcade voucher',
    emoji: '🎟️',
    description: 'One play of an arcade game.',
    price: 15,
    pay: 'coins',
    kind: 'vouchers',
    section: 'currency',
    grant: { currency: 'vouchers', amount: 1 },
  },
  {
    id: 'voucher-5',
    name: '5 arcade vouchers',
    emoji: '🎟️',
    description: 'Five plays, one free.',
    price: 60,
    pay: 'coins',
    kind: 'vouchers',
    section: 'currency',
    grant: { currency: 'vouchers', amount: 5 },
  },
  // boosts
  {
    id: 'freeze',
    name: 'Streak freeze',
    emoji: '🧊',
    description: 'Protects your streak for one missed day (max 2 banked).',
    price: 60,
    pay: 'coins',
    kind: 'freeze',
    section: 'boosts',
  },
  {
    id: 'booster',
    name: 'Coin booster',
    emoji: '⚡',
    description: 'Your next 3 completed tasks pay double coins.',
    price: 40,
    pay: 'coins',
    kind: 'booster',
    section: 'boosts',
    grant: { currency: 'item:booster', amount: 3 },
  },
  // cosmetics
  {
    id: 'title-scholar',
    name: 'Title: Scholar',
    emoji: '🎓',
    description: 'Shown next to your level.',
    price: 100,
    pay: 'coins',
    kind: 'title',
    section: 'cosmetics',
    unique: true,
  },
  {
    id: 'title-night-owl',
    name: 'Title: Night Owl',
    emoji: '🦉',
    description: 'Shown next to your level.',
    price: 150,
    pay: 'coins',
    kind: 'title',
    section: 'cosmetics',
    unique: true,
  },
  {
    id: 'title-speedrunner',
    name: 'Title: Speedrunner',
    emoji: '⏱️',
    description: 'Shown next to your level.',
    price: 200,
    pay: 'coins',
    kind: 'title',
    section: 'cosmetics',
    unique: true,
  },
  { id: 'title-legend', name: 'Title: Legend', emoji: '🏛️', description: 'Shown next to your level.', price: 500, pay: 'coins', kind: 'title', section: 'cosmetics', unique: true },
  {
    id: 'frame-gold',
    name: 'Gold frame',
    emoji: '🥇',
    description: 'A gold ring around your level card.',
    price: 150,
    pay: 'coins',
    kind: 'frame',
    section: 'cosmetics',
    unique: true,
  },
  { id: 'frame-neon', name: 'Neon frame', emoji: '💡', description: 'A glowing neon level card.', price: 200, pay: 'coins', kind: 'frame', section: 'cosmetics', unique: true },
  { id: 'frame-leaf', name: 'Leaf frame', emoji: '🌿', description: 'A leafy green level card.', price: 150, pay: 'coins', kind: 'frame', section: 'cosmetics', unique: true },
  {
    id: 'confetti-coins',
    name: 'Coin confetti',
    emoji: '🪙',
    description: 'Celebrations rain coins.',
    price: 120,
    pay: 'coins',
    kind: 'confetti',
    section: 'cosmetics',
    unique: true,
  },
  {
    id: 'confetti-hearts',
    name: 'Heart confetti',
    emoji: '💖',
    description: 'Celebrations rain hearts.',
    price: 120,
    pay: 'coins',
    kind: 'confetti',
    section: 'cosmetics',
    unique: true,
  },
  {
    id: 'confetti-stars',
    name: 'Star confetti',
    emoji: '🌟',
    description: 'Celebrations rain stars.',
    price: 120,
    pay: 'coins',
    kind: 'confetti',
    section: 'cosmetics',
    unique: true,
  },
  {
    id: 'confetti-books',
    name: 'Book confetti',
    emoji: '📚',
    description: 'Celebrations rain books and pencils.',
    price: 120,
    pay: 'coins',
    kind: 'confetti',
    section: 'cosmetics',
    unique: true,
  },
  // prize counter (chips)
  { id: 'trophy-dice', name: 'Bronze dice', emoji: '🎲', description: 'Casino trophy.', price: 1_000, pay: 'chips', kind: 'trophy', section: 'prizes', unique: true },
  { id: 'trophy-cards', name: 'Silver cards', emoji: '🃏', description: 'Casino trophy.', price: 5_000, pay: 'chips', kind: 'trophy', section: 'prizes', unique: true },
  { id: 'trophy-crown', name: 'Gold crown', emoji: '👑', description: 'Casino trophy.', price: 25_000, pay: 'chips', kind: 'trophy', section: 'prizes', unique: true },
  { id: 'trophy-diamond', name: 'Diamond', emoji: '💎', description: 'Casino trophy.', price: 100_000, pay: 'chips', kind: 'trophy', section: 'prizes', unique: true },
  {
    id: 'title-high-roller',
    name: 'Title: High Roller',
    emoji: '🎩',
    description: 'Casino-only title.',
    price: 50_000,
    pay: 'chips',
    kind: 'title',
    section: 'prizes',
    unique: true,
  },
];

export const SECTION_LABEL: Record<ShopSection, string> = { currency: 'Chips and vouchers', boosts: 'Boosts', cosmetics: 'Cosmetics', prizes: 'Prize counter (chips)' };

export function shopItem(id: string): ShopItem | undefined {
  return SHOP.find((i) => i.id === id);
}

/** Owned count for an item (unique items: 0 or 1). */
export function owned(ledger: LedgerEntry[], id: string): number {
  return balance(ledger, `item:${id}`);
}

export type BuyCheck = { ok: true } | { ok: false; reason: string };

export function canBuy(ledger: LedgerEntry[], item: ShopItem, ctx: { freezes: number; maxFreezes: number; price?: number }): BuyCheck {
  const price = ctx.price ?? item.price;
  if (item.unique && owned(ledger, item.id) > 0) return { ok: false, reason: 'Owned' };
  if (item.kind === 'freeze' && ctx.freezes >= ctx.maxFreezes) return { ok: false, reason: `Max ${ctx.maxFreezes} banked` };
  if (balance(ledger, item.pay) < price) return { ok: false, reason: `Need ${price - balance(ledger, item.pay)} more` };
  return { ok: true };
}

/** Ledger entries for a purchase: pay the price, receive the grant (or the item itself). */
export function purchaseEntries(item: ShopItem, price = item.price, ref?: string): Omit<LedgerEntry, 'id' | 'at'>[] {
  const out: Omit<LedgerEntry, 'id' | 'at'>[] = [{ currency: item.pay, amount: -price, reason: `shop:${item.id}`, ...(ref ? { ref } : {}) }];
  if (item.grant) out.push({ currency: item.grant.currency, amount: item.grant.amount, reason: `shop:${item.id}` });
  else if (item.kind !== 'freeze') out.push({ currency: `item:${item.id}`, amount: 1, reason: `shop:${item.id}` });
  return out;
}

// ---------- casino achievements ----------
export interface Achievement {
  id: string;
  name: string;
  emoji: string;
  description: string;
  chips: number; // reward
}
export const CASINO_ACHIEVEMENTS: Achievement[] = [
  { id: 'first-bet', name: 'Pull up a chair', emoji: '🪑', description: 'Play your first casino round.', chips: 25 },
  { id: 'natural', name: 'Natural', emoji: '🃏', description: 'Get a blackjack.', chips: 100 },
  { id: 'four-kind', name: 'Four of a kind', emoji: '🂡', description: 'Hit four of a kind or better in video poker.', chips: 150 },
  { id: 'royal', name: 'Royalty', emoji: '👑', description: 'Hit a royal flush in video poker.', chips: 2500 },
  { id: 'plinko-10', name: 'Edge case', emoji: '🔻', description: 'Land a 10× or bigger Plinko bucket.', chips: 150 },
  { id: 'hilo-5', name: 'Mind reader', emoji: '🔮', description: 'Cash out Hi-Lo at 5× or more.', chips: 150 },
  { id: 'mines-10', name: 'Gem hunter', emoji: '💎', description: 'Find 10 gems in one Mines round.', chips: 150 },
  { id: 'straight-up', name: 'On the number', emoji: '🎯', description: 'Win a straight-up bet in roulette.', chips: 150 },
  { id: 'jackpot', name: 'Jackpot', emoji: '💰', description: 'Win 50× your bet in a single round.', chips: 300 },
  { id: 'regular', name: 'Regular', emoji: '🎩', description: 'Play 100 casino rounds.', chips: 200 },
];

// ---------- cosmetics ----------
export const TITLE_TEXT: Record<string, string> = {
  'title-scholar': 'Scholar',
  'title-night-owl': 'Night Owl',
  'title-speedrunner': 'Speedrunner',
  'title-legend': 'Legend',
  'title-high-roller': 'High Roller',
};

export const CONFETTI_STYLES: Record<string, { colors: string[]; emoji: string[] }> = {
  'confetti-coins': { colors: ['#f5c542', '#e0a800', '#ffd966'], emoji: ['🪙', '💰', '✨'] },
  'confetti-hearts': { colors: ['#ff6fae', '#ff9ecb', '#ffd1e6'], emoji: ['💖', '💗', '💕'] },
  'confetti-stars': { colors: ['#ffe066', '#9ad0ff', '#ffffff'], emoji: ['🌟', '⭐', '✨'] },
  'confetti-books': { colors: ['#6c5ce7', '#00b894', '#fdcb6e'], emoji: ['📚', '✏️', '📐', '📓'] },
};

// ---------- history ----------
export function reasonLabel(e: LedgerEntry): string {
  const r = e.reason;
  if (r === 'task') return 'Task completed';
  if (r === 'undo') return 'Undo';
  if (r === 'ring') return 'Daily ring closed';
  if (r === 'ring-chips') return 'Daily chip bonus';
  if (r === 'streak') return 'Streak milestone';
  if (r === 'grade') return 'Grade entered';
  if (r === 'study') return 'Notecard study session';
  if (r === 'pomodoro') return 'Pomodoro finished';
  if (r === 'levelup') return 'Level up';
  if (r === 'booster') return 'Coin booster';
  if (r.startsWith('shop:')) return `Shop: ${shopItem(r.slice(5))?.name ?? r.slice(5)}`;
  if (r.startsWith('casino:')) return `Casino: ${r.slice(7)}`;
  if (r.startsWith('arcade:')) return `Arcade: ${r.slice(7)}`;
  return r;
}
