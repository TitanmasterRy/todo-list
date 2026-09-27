// Coins economy: pure rules (catalog, rewards, balances). No real money anywhere: coins are earned
// by doing schoolwork, chips are bought with coins (and can be cashed back at half value, a little a day),
// vouchers pay for arcade games, and some games sell power-ups for coins.
import type { Currency, LedgerCurrency, LedgerEntry } from './types';
import { todayKey } from './dates';
import { cleanText } from './b64url';
import { inSeason, seasonById, type SeasonId } from './seasons';

export const CURRENCY_EMOJI: Record<Currency, string> = { coins: '🪙', chips: '🎰', vouchers: '🎟️' };
export const CURRENCY_LABEL: Record<Currency, string> = { coins: 'Coins', chips: 'Chips', vouchers: 'Vouchers' };

// ---------- earning ----------
export const REWARDS = {
  ring: 10, // closing the daily ring
  pomodoro: 3,
  levelUpPerLevel: 5, // level × this
  dailyChipBonus: 100, // chips when the ring closes (once a day)
};

/** A casino payout this many times the bet (stake included) makes it rain coins. */
export const BIG_WIN_MULTIPLE = 10;

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
  for (const e of ledger) if (e.currency === 'coins' && !e.reason.startsWith('shop:') && !SPENDING.test(e.reason) && e.reason !== CASHOUT_REASON) n += e.amount;
  return Math.max(0, n);
}
/** Coins spent inside games (power-ups) aren't "earned" going backwards. */
const SPENDING = /^(game|factory):/;

// ---------- cashing chips back into coins ----------
/** Chips per coin when cashing out. Buying is 10 chips per coin, so cashing out returns half. */
export const CASHOUT_RATE = 20;
/** At most this many coins a day from chips, so homework stays the way to earn. */
export const CASHOUT_DAILY_MAX = 100;
export const CASHOUT_REASON = 'cashout';

/** Coins already cashed out on `day` (YYYY-MM-DD, local). */
export function cashedOutOn(ledger: LedgerEntry[], day: string): number {
  let n = 0;
  for (const e of ledger) if (e.reason === CASHOUT_REASON && e.currency === 'coins' && e.amount > 0 && todayKey(new Date(e.at)) === day) n += e.amount;
  return n;
}

/** What cashing out up to `chips` would give today: whole coins only, within the daily limit. */
export function cashoutQuote(ledger: LedgerEntry[], chips: number, day: string): { coins: number; chips: number; leftToday: number } {
  const leftToday = Math.max(0, CASHOUT_DAILY_MAX - cashedOutOn(ledger, day));
  const have = Math.min(Math.max(0, Math.floor(chips)), balance(ledger, 'chips'));
  const coins = Math.min(Math.floor(have / CASHOUT_RATE), leftToday);
  return { coins, chips: coins * CASHOUT_RATE, leftToday };
}

export function cashoutEntries(coins: number): Omit<LedgerEntry, 'id' | 'at'>[] {
  return [
    { currency: 'chips', amount: -coins * CASHOUT_RATE, reason: CASHOUT_REASON },
    { currency: 'coins', amount: coins, reason: CASHOUT_REASON },
  ];
}

// ---------- coin power-ups in games ----------
/** Most a game can charge for one power-up, and in one sitting. */
export const POWERUP_MAX_COST = 50;
export const POWERUP_SESSION_MAX = 200;

export interface PowerupRequest {
  id: string;
  label: string;
  cost: number;
}

/** Validate a game's `hwtodo:buy` message (it comes from a sandboxed, untrusted page). */
export function parsePowerup(data: unknown): PowerupRequest | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (d.type !== 'hwtodo:buy') return null;
  if (typeof d.id !== 'string' || !/^[a-z0-9-]{1,40}$/.test(d.id)) return null;
  const label = cleanText(d.label, 60);
  if (!label) return null;
  if (typeof d.cost !== 'number' || !Number.isInteger(d.cost) || d.cost < 1 || d.cost > POWERUP_MAX_COST) return null;
  return { id: d.id, label, cost: d.cost };
}

// ---------- shop ----------
export type ShopKind = 'chips' | 'vouchers' | 'freeze' | 'booster' | 'title' | 'frame' | 'confetti' | 'trophy';
export type ShopSection = 'currency' | 'boosts' | 'cosmetics' | 'seasonal' | 'prizes';

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
  season?: SeasonId; // limited: only for sale during this event's window (owners keep it)
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
  // limited seasonal cosmetics (for sale only during their event, see seasons.ts)
  {
    id: 'frame-pumpkin',
    name: 'Pumpkin frame',
    emoji: '🎃',
    description: 'A glowing jack-o’-lantern ring.',
    price: 150,
    pay: 'coins',
    kind: 'frame',
    section: 'seasonal',
    unique: true,
    season: 'halloween',
  },
  {
    id: 'confetti-spooky',
    name: 'Spooky confetti',
    emoji: '👻',
    description: 'Celebrations rain ghosts and bats.',
    price: 120,
    pay: 'coins',
    kind: 'confetti',
    section: 'seasonal',
    unique: true,
    season: 'halloween',
  },
  {
    id: 'title-spellcaster',
    name: 'Title: Spellcaster',
    emoji: '🧙',
    description: 'Limited Halloween title.',
    price: 180,
    pay: 'coins',
    kind: 'title',
    section: 'seasonal',
    unique: true,
    season: 'halloween',
  },
  {
    id: 'frame-frost',
    name: 'Frost frame',
    emoji: '❄️',
    description: 'An icy blue ring.',
    price: 150,
    pay: 'coins',
    kind: 'frame',
    section: 'seasonal',
    unique: true,
    season: 'winter',
  },
  {
    id: 'confetti-snow',
    name: 'Snowfall confetti',
    emoji: '☃️',
    description: 'Celebrations rain snowflakes.',
    price: 120,
    pay: 'coins',
    kind: 'confetti',
    section: 'seasonal',
    unique: true,
    season: 'winter',
  },
  {
    id: 'title-cocoa',
    name: 'Title: Cocoa Scholar',
    emoji: '☕',
    description: 'Limited winter title.',
    price: 180,
    pay: 'coins',
    kind: 'title',
    section: 'seasonal',
    unique: true,
    season: 'winter',
  },
  {
    id: 'title-finalist',
    name: 'Title: Finals Survivor',
    emoji: '📝',
    description: 'Limited finals-week title.',
    price: 200,
    pay: 'coins',
    kind: 'title',
    section: 'seasonal',
    unique: true,
    season: 'finals',
  },
  {
    id: 'frame-ink',
    name: 'Ink frame',
    emoji: '🖋️',
    description: 'A deep ink-blue ring.',
    price: 150,
    pay: 'coins',
    kind: 'frame',
    section: 'seasonal',
    unique: true,
    season: 'finals',
  },
  {
    id: 'frame-sunny',
    name: 'Sunny frame',
    emoji: '🌞',
    description: 'A warm golden-orange ring.',
    price: 150,
    pay: 'coins',
    kind: 'frame',
    section: 'seasonal',
    unique: true,
    season: 'summer',
  },
  {
    id: 'confetti-beach',
    name: 'Beach confetti',
    emoji: '🏖️',
    description: 'Celebrations rain shells and watermelon.',
    price: 120,
    pay: 'coins',
    kind: 'confetti',
    section: 'seasonal',
    unique: true,
    season: 'summer',
  },
  {
    id: 'title-sunny',
    name: 'Title: Summer Scholar',
    emoji: '🕶️',
    description: 'Limited summer title.',
    price: 180,
    pay: 'coins',
    kind: 'title',
    section: 'seasonal',
    unique: true,
    season: 'summer',
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

export const SECTION_LABEL: Record<ShopSection, string> = {
  currency: 'Chips and vouchers',
  boosts: 'Boosts',
  cosmetics: 'Cosmetics',
  seasonal: 'Limited items',
  prizes: 'Prize counter (chips)',
};

export function shopItem(id: string): ShopItem | undefined {
  return SHOP.find((i) => i.id === id);
}

/** Owned count for an item (unique items: 0 or 1). */
export function owned(ledger: LedgerEntry[], id: string): number {
  return balance(ledger, `item:${id}`);
}

export type BuyCheck = { ok: true } | { ok: false; reason: string };

export function canBuy(ledger: LedgerEntry[], item: ShopItem, ctx: { freezes: number; maxFreezes: number; price?: number; today?: string }): BuyCheck {
  const price = ctx.price ?? item.price;
  if (item.unique && owned(ledger, item.id) > 0) return { ok: false, reason: 'Owned' };
  if (item.season && !(ctx.today && inSeason(item.season, ctx.today))) return { ok: false, reason: `Only during ${seasonById(item.season)?.name ?? 'its event'}` };
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
  'title-spellcaster': 'Spellcaster',
  'title-cocoa': 'Cocoa Scholar',
  'title-finalist': 'Finals Survivor',
  'title-sunny': 'Summer Scholar',
};

export const CONFETTI_STYLES: Record<string, { colors: string[]; emoji: string[] }> = {
  'confetti-coins': { colors: ['#f5c542', '#e0a800', '#ffd966'], emoji: ['🪙', '💰', '✨'] },
  'confetti-hearts': { colors: ['#ff6fae', '#ff9ecb', '#ffd1e6'], emoji: ['💖', '💗', '💕'] },
  'confetti-stars': { colors: ['#ffe066', '#9ad0ff', '#ffffff'], emoji: ['🌟', '⭐', '✨'] },
  'confetti-books': { colors: ['#6c5ce7', '#00b894', '#fdcb6e'], emoji: ['📚', '✏️', '📐', '📓'] },
  'confetti-spooky': { colors: ['#ff7518', '#6a0dad', '#1b1b1b'], emoji: ['👻', '🦇', '🎃', '🕸️'] },
  'confetti-snow': { colors: ['#e0f2ff', '#9ad0ff', '#ffffff'], emoji: ['❄️', '☃️', '✨'] },
  'confetti-beach': { colors: ['#ffd166', '#06d6a0', '#ef476f'], emoji: ['🐚', '🍉', '🏖️', '🌊'] },
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
  if (r === CASHOUT_REASON) return e.currency === 'coins' ? 'Chips cashed out' : 'Cashed out for coins';
  if (r === 'admin') return 'Adjusted by the admin';
  if (r.startsWith('game:')) return `Power-up: ${r.slice(5)}`;
  if (r.startsWith('factory:')) return `Factory: ${r.slice(8)}`;
  if (r.startsWith('shop:')) return `Shop: ${shopItem(r.slice(5))?.name ?? r.slice(5)}`;
  if (r.startsWith('casino:')) return `Casino: ${r.slice(7)}`;
  if (r.startsWith('arcade:')) return `Arcade: ${r.slice(7)}`;
  if (r === 'gift:sent' || r === 'gift:received') {
    const name = shopItem(e.currency.slice(5))?.name ?? e.currency.slice(5);
    return r === 'gift:sent' ? `Gift sent: ${name}` : `Gift received: ${name}`;
  }
  if (r.startsWith('pet:')) return `Pet snack: ${r.slice(4)}`;
  if (r === 'quest' && e.ref?.startsWith('event:')) return 'Event quest';
  if (r === 'quest') return 'Daily quest';
  return r;
}
