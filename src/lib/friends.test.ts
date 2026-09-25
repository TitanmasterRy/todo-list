import { describe, expect, it } from 'vitest';
import { addFriend, ago, decodeCard, encodeCard, friendLink, isStale, leaderboard, MAX_FRIENDS, validateCard, weekXp, type FriendCard, type Friend } from './friends';
import { toB64url } from './b64url';

const NOW = 1_790_000_000; // epoch seconds
const card = (o: Partial<FriendCard> = {}): FriendCard => ({
  id: 'me0000000001',
  name: 'Sam',
  emoji: '🦊',
  streak: 5,
  best: 9,
  wxp: 120,
  wk: '2026-09-21',
  lvl: 4,
  at: NOW - 60,
  ...o,
});

describe('friend codes', () => {
  it('round-trips through a short, versioned code and a link', () => {
    const c = card({ pid: 'live0000000000000001' });
    const code = encodeCard(c);
    expect(code.startsWith('HWF1.')).toBe(true);
    expect(code.length).toBeLessThan(260);
    expect(decodeCard(code, NOW)).toEqual(c);
    expect(decodeCard(friendLink(c, 'https://x.example/#old'), NOW)).toEqual(c);
    // pasted with line breaks from a chat app
    expect(decodeCard(code.slice(0, 20) + '\n ' + code.slice(20), NOW)).toEqual(c);
  });

  it('carries only the snapshot fields', () => {
    const extra = { ...card(), tasks: ['secret'], email: 'a@b.c' };
    const code = 'HWF1.' + toB64url(JSON.stringify(extra));
    expect(Object.keys(decodeCard(code, NOW)!).sort()).toEqual(['at', 'best', 'emoji', 'id', 'lvl', 'name', 'streak', 'wk', 'wxp']);
  });

  it('rejects bad codes and cleans the text fields', () => {
    const enc = (o: unknown) => 'HWF1.' + toB64url(JSON.stringify(o));
    expect(decodeCard('', NOW)).toBeNull();
    expect(decodeCard('HWF2.' + toB64url(JSON.stringify(card())), NOW)).toBeNull();
    expect(decodeCard(enc({ ...card(), id: 'x' }), NOW)).toBeNull();
    expect(decodeCard(enc({ ...card(), name: '   ' }), NOW)).toBeNull();
    expect(decodeCard(enc({ ...card(), streak: -1 }), NOW)).toBeNull();
    expect(decodeCard(enc({ ...card(), wxp: 1.5 }), NOW)).toBeNull();
    expect(decodeCard(enc({ ...card(), lvl: 0 }), NOW)).toBeNull();
    expect(decodeCard(enc({ ...card(), wk: 'monday' }), NOW)).toBeNull();
    expect(decodeCard(enc({ ...card(), at: NOW + 3 * 86400 }), NOW)).toBeNull();
    expect(decodeCard(enc({ ...card(), pid: 'BAD ID' }), NOW)!.pid).toBeUndefined();
    const c = decodeCard(enc({ ...card(), name: '\u0007<img src=x onerror=alert(1)>' + 'y'.repeat(40), emoji: '', best: 1, at: NOW + 100 }), NOW)!;
    expect(c.name).toHaveLength(24);
    expect(c.emoji).toBe('🙂');
    expect(c.best).toBe(5); // never below the current streak
    expect(c.at).toBe(NOW); // small clock skew is clamped
    expect(validateCard(null)).toBeNull();
  });
});

describe('friends list and leaderboard', () => {
  const f = (o: Partial<FriendCard>): FriendCard => card({ id: `friend${o.name ?? 'x'}000000`.toLowerCase().slice(0, 16), ...o });

  it('adds, refreshes with newer codes, ignores older ones and itself', () => {
    let list: Friend[] = [];
    ({ list } = addFriend(list, f({ name: 'Ana', at: NOW - 100 }), 'me0000000001', NOW));
    expect(list).toHaveLength(1);
    expect(addFriend(list, f({ name: 'Ana', at: NOW - 200 }), 'me0000000001', NOW).result).toBe('older');
    const upd = addFriend(list, f({ name: 'Ana', streak: 7, at: NOW }), 'me0000000001', NOW);
    expect(upd.result).toBe('updated');
    expect(upd.list[0].card.streak).toBe(7);
    expect(upd.list[0].addedAt).toBe(NOW);
    expect(addFriend(list, card(), 'me0000000001', NOW).result).toBe('self');
    const full = Array.from({ length: MAX_FRIENDS }, (_, i) => ({ card: f({ id: `friend${String(i).padStart(6, '0')}` }), addedAt: NOW }));
    expect(addFriend(full, f({ id: 'newfriend0000' }), 'me0000000001', NOW).result).toBe('full');
  });

  it('sorts by this week XP, then streak, then name; last week counts as 0', () => {
    const wk = '2026-09-21';
    const me = card({ wxp: 120, streak: 5 });
    const friends: Friend[] = [
      { card: f({ name: 'Ana', wxp: 300, streak: 1 }), addedAt: NOW },
      { card: f({ name: 'Ben', wxp: 120, streak: 9 }), addedAt: NOW },
      { card: f({ name: 'Cy', wxp: 999, wk: '2026-09-14', streak: 30, at: NOW - 8 * 86400 }), addedAt: NOW },
      { card: f({ name: 'Di', wxp: 120, streak: 5 }), addedAt: NOW },
    ];
    const rows = leaderboard(me, friends, wk, NOW);
    expect(rows.map((r) => r.card.name)).toEqual(['Ana', 'Ben', 'Di', 'Sam', 'Cy']);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3, 3, 5]);
    expect(rows.find((r) => r.me)!.card.name).toBe('Sam');
    const cy = rows.find((r) => r.card.name === 'Cy')!;
    expect(cy).toMatchObject({ weekXp: 0, lastWeek: true, stale: true });
    expect(weekXp(cy.card, '2026-09-14')).toBe(999);
    expect(isStale(card({ at: NOW - 60 }), NOW)).toBe(false);
  });

  it('says how long ago', () => {
    expect(ago(NOW - 10, NOW)).toBe('just now');
    expect(ago(NOW - 600, NOW)).toBe('10 min ago');
    expect(ago(NOW - 5 * 3600, NOW)).toBe('5 h ago');
    expect(ago(NOW - 86400 * 2, NOW)).toBe('2 days ago');
  });
});
