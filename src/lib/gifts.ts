// Gifts between friends: a code that moves ONE owned cosmetic from the sender to a friend. There's no server, so
// the code isn't signed: the sender's item is marked given (a ledger entry) and the receiver redeems a gift id once
// (another entry). Anyone holding a code could paste it on a second device, so gifts are cosmetic-only (titles,
// frames, confetti bought with coins), capped per day, and never carry coins, chips or vouchers. Pure and unit-tested.
import { cleanText, decodeJson, paramFrom, toB64url } from './b64url';
import { owned, shopItem, type ShopItem } from './economy';
import { todayKey } from './dates';
import type { LedgerEntry } from './types';

export const GIFT_PREFIX = 'HWG1.';
/** Gifts you can send, and gifts you can redeem, per day. */
export const GIFTS_PER_DAY = 3;
const ID_RE = /^[a-z0-9]{8,40}$/;

export interface Gift {
  g: string; // gift id (random), redeemed once
  item: string; // shop item id
  from: string; // sender's display name
  fe: string; // sender's emoji
  fid: string; // sender's friend-profile id
  to?: string; // the friend it's for (friend-profile id), when picked from the friends list
  at: number; // epoch seconds
}

/** Cosmetics bought with coins can be gifted; currency, boosts and casino prizes can't. */
export function giftable(item: ShopItem | undefined): item is ShopItem {
  return !!item && item.pay === 'coins' && !!item.unique && (item.kind === 'title' || item.kind === 'frame' || item.kind === 'confetti');
}

export function encodeGift(g: Gift): string {
  const { g: id, item, from, fe, fid, to, at } = g;
  return GIFT_PREFIX + toB64url(JSON.stringify(to ? { g: id, item, from, fe, fid, to, at } : { g: id, item, from, fe, fid, at }));
}

/** Read a gift code (or a link with `#gift=`). Null for anything invalid or not giftable. */
export function decodeGift(input: string, now = Math.floor(Date.now() / 1000)): Gift | null {
  const code = paramFrom(input, 'gift').replace(/\s+/g, '');
  if (!code.startsWith(GIFT_PREFIX)) return null;
  const v = decodeJson(code.slice(GIFT_PREFIX.length), 1024);
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const j = v as Record<string, unknown>;
  if (typeof j.g !== 'string' || !ID_RE.test(j.g) || typeof j.fid !== 'string' || !ID_RE.test(j.fid)) return null;
  if (typeof j.item !== 'string' || !giftable(shopItem(j.item))) return null;
  if (typeof j.at !== 'number' || !Number.isInteger(j.at) || j.at < 1_577_836_800 || j.at > now + 24 * 3600) return null;
  const gift: Gift = { g: j.g, item: j.item, from: cleanText(j.from, 24) || 'A friend', fe: cleanText(j.fe, 8) || '🎁', fid: j.fid, at: Math.min(j.at, now) };
  if (typeof j.to === 'string' && ID_RE.test(j.to)) gift.to = j.to;
  return gift;
}

const onDay = (e: LedgerEntry, day: string) => todayKey(new Date(e.at)) === day;

export function giftsSentOn(ledger: LedgerEntry[], day: string): number {
  return ledger.filter((e) => e.reason === 'gift:sent' && onDay(e, day)).length;
}
export function giftsRedeemedOn(ledger: LedgerEntry[], day: string): number {
  return ledger.filter((e) => e.reason === 'gift:received' && onDay(e, day)).length;
}

export type GiftCheck = { ok: true } | { ok: false; reason: string };

export function canSend(ledger: LedgerEntry[], itemId: string, day: string): GiftCheck {
  const item = shopItem(itemId);
  if (!giftable(item)) return { ok: false, reason: "That item can't be gifted" };
  if (owned(ledger, itemId) <= 0) return { ok: false, reason: "You don't own that item" };
  if (giftsSentOn(ledger, day) >= GIFTS_PER_DAY) return { ok: false, reason: `You can send ${GIFTS_PER_DAY} gifts a day` };
  return { ok: true };
}

/** The ledger entry that marks the sender's item as given. */
export function sendEntries(gift: Gift): Omit<LedgerEntry, 'id' | 'at'>[] {
  return [{ currency: `item:${gift.item}`, amount: -1, reason: 'gift:sent', ref: gift.g }];
}

export function canRedeem(ledger: LedgerEntry[], gift: Gift, myId: string, day: string): GiftCheck {
  if (ledger.some((e) => e.ref === gift.g && e.reason === 'gift:received')) return { ok: false, reason: 'This gift was already redeemed' };
  if (gift.fid === myId || ledger.some((e) => e.ref === gift.g && e.reason === 'gift:sent')) return { ok: false, reason: "That's a gift you sent" };
  if (gift.to && gift.to !== myId) return { ok: false, reason: 'This gift is for someone else' };
  if (owned(ledger, gift.item) > 0) return { ok: false, reason: `You already own ${shopItem(gift.item)?.name ?? 'this item'}` };
  if (giftsRedeemedOn(ledger, day) >= GIFTS_PER_DAY) return { ok: false, reason: `You can redeem ${GIFTS_PER_DAY} gifts a day` };
  return { ok: true };
}

/** The ledger entry that gives the receiver the item. */
export function redeemEntries(gift: Gift): Omit<LedgerEntry, 'id' | 'at'>[] {
  return [{ currency: `item:${gift.item}`, amount: 1, reason: 'gift:received', ref: gift.g }];
}
