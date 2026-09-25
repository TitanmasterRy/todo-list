// Friends by share code: a friend card is a tiny snapshot (name, emoji, streak, best streak, this week's XP,
// level, when it was made) packed into a versioned base64url code. Nothing else is in it. Pure, so it's unit-tested.
import { cleanText, decodeJson, paramFrom, toB64url } from './b64url';

export interface FriendCard {
  id: string; // random per person, so a fresh code replaces the old one
  name: string;
  emoji: string;
  streak: number;
  best: number;
  wxp: number; // XP earned this week…
  wk: string; // …in the week starting on this day (YYYY-MM-DD)
  lvl: number;
  at: number; // when the card was made, epoch seconds
  pid?: string; // public id of the live copy (friend_cards table), when live updates are on
}

export interface Friend {
  card: FriendCard;
  addedAt: number; // epoch seconds
}

export const CODE_PREFIX = 'HWF1.';
export const MAX_FRIENDS = 50;
/** A card older than this gets the "swap fresh codes" nudge. */
export const STALE_SECONDS = 3 * 24 * 3600;
const ID_RE = /^[a-z0-9]{8,40}$/;

const num = (v: unknown, max: number, min = 0): number | null => (typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : null);

/** Check and clean an untrusted card (from a code or the live table). `now` in epoch seconds. */
export function validateCard(v: unknown, now = Math.floor(Date.now() / 1000)): FriendCard | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const j = v as Record<string, unknown>;
  if (typeof j.id !== 'string' || !ID_RE.test(j.id)) return null;
  const name = cleanText(j.name, 24);
  if (!name) return null;
  const streak = num(j.streak, 100_000);
  const best = num(j.best, 100_000);
  const wxp = num(j.wxp, 10_000_000);
  const lvl = num(j.lvl, 10_000, 1);
  const at = num(j.at, now + 24 * 3600, 1_577_836_800); // 2020-01-01 … a day of clock skew
  if (streak === null || best === null || wxp === null || lvl === null || at === null) return null;
  if (typeof j.wk !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(j.wk)) return null;
  const card: FriendCard = { id: j.id, name, emoji: cleanText(j.emoji, 8) || '🙂', streak, best: Math.max(best, streak), wxp, wk: j.wk, lvl, at: Math.min(at, now) };
  if (typeof j.pid === 'string' && ID_RE.test(j.pid)) card.pid = j.pid;
  return card;
}

export function encodeCard(c: FriendCard): string {
  const { id, name, emoji, streak, best, wxp, wk, lvl, at, pid } = c;
  return CODE_PREFIX + toB64url(JSON.stringify(pid ? { id, name, emoji, streak, best, wxp, wk, lvl, at, pid } : { id, name, emoji, streak, best, wxp, wk, lvl, at }));
}

/** Read a card from a code or a pasted link (`#friend=…`). Null for anything invalid or from a newer version. */
export function decodeCard(input: string, now?: number): FriendCard | null {
  const code = paramFrom(input, 'friend').replace(/\s+/g, '');
  if (!code.startsWith(CODE_PREFIX)) return null;
  return validateCard(decodeJson(code.slice(CODE_PREFIX.length), 1024), now);
}

export function friendLink(c: FriendCard, base: string): string {
  return `${base.replace(/#.*$/, '')}#friend=${encodeCard(c)}`;
}

export type AddResult = 'added' | 'updated' | 'older' | 'self' | 'full';

/** Add or refresh a friend. An older code for someone already on the list is ignored. */
export function addFriend(list: Friend[], card: FriendCard, myId: string, now = Math.floor(Date.now() / 1000)): { list: Friend[]; result: AddResult } {
  if (card.id === myId) return { list, result: 'self' };
  const i = list.findIndex((f) => f.card.id === card.id);
  if (i >= 0) {
    if (card.at < list[i].card.at) return { list, result: 'older' };
    const next = [...list];
    next[i] = { ...list[i], card };
    return { list: next, result: 'updated' };
  }
  if (list.length >= MAX_FRIENDS) return { list, result: 'full' };
  return { list: [...list, { card, addedAt: now }], result: 'added' };
}

/** Weekly XP only counts in the week it was earned: a card from last week shows 0 for this week. */
export function weekXp(c: FriendCard, weekKey: string): number {
  return c.wk === weekKey ? c.wxp : 0;
}

export function isStale(c: FriendCard, now = Math.floor(Date.now() / 1000)): boolean {
  return now - c.at > STALE_SECONDS;
}

export interface BoardRow {
  card: FriendCard;
  me: boolean;
  rank: number;
  weekXp: number;
  lastWeek: boolean; // the card is from an earlier week
  stale: boolean;
}

/** Leaderboard: this week's XP, then streak, then name. Ties share a rank. */
export function leaderboard(me: FriendCard, friends: Friend[], weekKey: string, now = Math.floor(Date.now() / 1000)): BoardRow[] {
  const rows = [{ card: me, me: true }, ...friends.map((f) => ({ card: f.card, me: false }))].map((r) => ({
    ...r,
    weekXp: weekXp(r.card, weekKey),
    lastWeek: r.card.wk < weekKey,
    stale: !r.me && isStale(r.card, now),
    rank: 0,
  }));
  rows.sort((a, b) => b.weekXp - a.weekXp || b.card.streak - a.card.streak || a.card.name.localeCompare(b.card.name) || Number(b.me) - Number(a.me));
  rows.forEach((r, i) => {
    const prev = rows[i - 1];
    r.rank = prev && prev.weekXp === r.weekXp && prev.card.streak === r.card.streak ? prev.rank : i + 1;
  });
  return rows;
}

/** "just now", "5 min ago", "3 h ago", "2 days ago". */
export function ago(at: number, now = Math.floor(Date.now() / 1000)): string {
  const s = Math.max(0, now - at);
  if (s < 90) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 36 * 3600) return `${Math.round(s / 3600)} h ago`;
  const d = Math.round(s / 86400);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}
