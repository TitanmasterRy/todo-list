import { describe, expect, it } from 'vitest';
import { activeSeason, daysLeft, inSeason, nextSeason, SEASONS, seasonById, seasonWindow } from './seasons';
import { EVENT_QUESTS, eventQuestRef } from './eventquests';
import { canBuy, purchaseEntries, SHOP, shopItem } from './economy';
import { canRedeem, canSend, decodeGift, encodeGift, giftable, GIFTS_PER_DAY, redeemEntries, sendEntries, type Gift } from './gifts';
import { canFeed, FOODS, FULL_AT, hoursUntilHungry, moodFor, petState, START, type PetEvent } from './pet';
import { buildGarden, BED_SIZE, STEPS_PER_PLANT, stepsToBloom, type Completion } from './garden';
import { buildDungeon, dungeonSummary, roomKind, snake } from './dungeon';
import { companionState } from './companion';
import { toB64url } from './b64url';
import { DEFAULT_STATS, type Course, type LedgerEntry, type Task } from './types';

let n = 0;
const entry = (e: Omit<LedgerEntry, 'id' | 'at'>, at = new Date(2026, 9, 20, 12).toISOString()): LedgerEntry => ({ ...e, id: `e${n++}`, at });
const task = (over: Partial<Task>): Task => ({
  id: `t${n++}`,
  title: 'x',
  tags: [],
  priority: 'normal',
  subtasks: [],
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '',
  order: 0,
  deferredCount: 0,
  ...over,
});

describe('seasonal events', () => {
  it('finds the window a day falls in, inclusive at both ends', () => {
    const hw = seasonById('halloween')!;
    expect(seasonWindow(hw, '2026-10-14')).toBeUndefined();
    expect(seasonWindow(hw, '2026-10-15')).toEqual({ start: '2026-10-15', end: '2026-11-01' });
    expect(seasonWindow(hw, '2026-11-01')).toBeDefined();
    expect(seasonWindow(hw, '2026-11-02')).toBeUndefined();
  });

  it('handles the window that crosses New Year', () => {
    const w = seasonById('winter')!;
    expect(seasonWindow(w, '2026-12-20')).toEqual({ start: '2026-12-15', end: '2027-01-05' });
    expect(seasonWindow(w, '2027-01-05')).toEqual({ start: '2026-12-15', end: '2027-01-05' });
    expect(seasonWindow(w, '2027-01-06')).toBeUndefined();
    expect(daysLeft({ start: '2026-12-15', end: '2027-01-05' }, '2026-12-31')).toBe(6);
  });

  it('supports several windows a year and never overlaps two events', () => {
    expect(activeSeason('2026-12-05')?.season.id).toBe('finals');
    expect(activeSeason('2027-05-20')?.season.id).toBe('finals');
    expect(activeSeason('2026-07-04')?.season.id).toBe('summer');
    expect(activeSeason('2026-09-27')).toBeUndefined();
    for (let d = new Date(2026, 0, 1); d.getFullYear() === 2026; d.setDate(d.getDate() + 1)) {
      const key = `2026-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      expect(SEASONS.filter((s) => seasonWindow(s, key)).length).toBeLessThanOrEqual(1);
    }
  });

  it('says which event is next', () => {
    expect(nextSeason('2026-09-27')).toMatchObject({ start: '2026-10-15', days: 18 });
    expect(nextSeason('2026-12-20').season.id).toBe('finals'); // May
    expect(nextSeason('2026-12-20').start).toBe('2027-05-15');
  });

  it('sells limited items only in their window, and owners keep them', () => {
    let l = [entry({ currency: 'coins', amount: 1000, reason: 'task' })];
    const pumpkin = shopItem('frame-pumpkin')!;
    const ctx = { freezes: 0, maxFreezes: 2 };
    expect(canBuy(l, pumpkin, { ...ctx, today: '2026-10-20' }).ok).toBe(true);
    expect(canBuy(l, pumpkin, { ...ctx, today: '2026-09-27' })).toEqual({ ok: false, reason: 'Only during Halloween' });
    expect(canBuy(l, pumpkin, ctx).ok).toBe(false);
    l = [...l, ...purchaseEntries(pumpkin).map((e) => entry(e))];
    expect(canBuy(l, pumpkin, { ...ctx, today: '2026-10-20' })).toEqual({ ok: false, reason: 'Owned' });
    for (const s of SEASONS) expect(SHOP.filter((i) => i.season === s.id).length).toBeGreaterThan(0);
    for (const i of SHOP.filter((x) => x.season)) {
      expect(i.section).toBe('seasonal');
      expect(i.unique).toBe(true);
    }
  });

  it('counts event quests over the whole window', () => {
    const window = { start: '2026-10-15', end: '2026-11-01' };
    const stats = { ...structuredClone(DEFAULT_STATS), pomodorosByDay: { '2026-10-14': 4, '2026-10-16': 2, '2026-10-30': 1 }, ringDays: ['2026-10-01', '2026-10-20'] };
    const tasks = [
      task({ completedAt: new Date(2026, 9, 16, 10).toISOString() }),
      task({ completedAt: new Date(2026, 9, 31, 22).toISOString() }),
      task({ completedAt: new Date(2026, 9, 10, 10).toISOString() }),
      task({}),
    ];
    const [t13, pomo, ring] = EVENT_QUESTS.halloween;
    const c = { tasks, stats, window };
    expect(t13.progress(c)).toBe(2);
    expect(pomo.progress(c)).toBe(3);
    expect(ring.progress(c)).toBe(1);
    expect(eventQuestRef('halloween', window, 'tasks13')).toBe('event:halloween:2026-10-15:tasks13');
    for (const qs of Object.values(EVENT_QUESTS)) expect(qs).toHaveLength(3);
    expect(inSeason('summer', '2026-08-31')).toBe(true);
  });
});

describe('gift codes', () => {
  const me = 'receiver0000001';
  const gift: Gift = { g: 'gift00000000001', item: 'title-scholar', from: 'Ana', fe: '🦊', fid: 'sender00000001', at: 1_790_000_000 };
  const day = '2026-10-20';

  it('round-trips and rejects anything that is not a cosmetic', () => {
    const code = encodeGift(gift);
    expect(code.startsWith('HWG1.')).toBe(true);
    expect(decodeGift(code, 1_790_000_100)).toEqual(gift);
    expect(decodeGift(`https://x.example/#gift=${code}`, 1_790_000_100)).toEqual(gift);
    const enc = (o: unknown) => 'HWG1.' + toB64url(JSON.stringify(o));
    expect(decodeGift(enc({ ...gift, item: 'chips-1200' }), 1_790_000_100)).toBeNull();
    expect(decodeGift(enc({ ...gift, item: 'trophy-diamond' }), 1_790_000_100)).toBeNull();
    expect(decodeGift(enc({ ...gift, item: 'nope' }), 1_790_000_100)).toBeNull();
    expect(decodeGift(enc({ ...gift, g: 'x' }), 1_790_000_100)).toBeNull();
    expect(decodeGift(enc({ ...gift, at: 1_790_000_100 + 3 * 86400 }), 1_790_000_100)).toBeNull();
    expect(decodeGift('HWF1.abc')).toBeNull();
    expect(decodeGift(enc({ ...gift, from: '\u0007<b>' + 'y'.repeat(40) }), 1_790_000_100)!.from).toHaveLength(24);
    expect(giftable(shopItem('frame-pumpkin'))).toBe(true);
    expect(giftable(shopItem('booster'))).toBe(false);
  });

  it('marks the sender item given, and lets the receiver redeem once', () => {
    let sender = [entry({ currency: 'coins', amount: 500, reason: 'task' })];
    expect(canSend(sender, 'title-scholar', day)).toEqual({ ok: false, reason: "You don't own that item" });
    sender = [...sender, ...purchaseEntries(shopItem('title-scholar')!).map((e) => entry(e))];
    expect(canSend(sender, 'title-scholar', day).ok).toBe(true);
    sender = [...sender, ...sendEntries(gift).map((e) => entry(e))];
    expect(canSend(sender, 'title-scholar', day).ok).toBe(false); // it's gone
    expect(canBuy(sender, shopItem('title-scholar')!, { freezes: 0, maxFreezes: 2 }).ok).toBe(true); // can buy it again
    // the sender can't redeem their own gift
    expect(canRedeem(sender, gift, 'sender00000001', day)).toEqual({ ok: false, reason: "That's a gift you sent" });

    let recv: LedgerEntry[] = [];
    expect(canRedeem(recv, gift, me, day).ok).toBe(true);
    recv = [...recv, ...redeemEntries(gift).map((e) => entry(e))];
    expect(canRedeem(recv, gift, me, day)).toEqual({ ok: false, reason: 'This gift was already redeemed' });
    expect(recv.filter((e) => e.currency === 'item:title-scholar').reduce((a, e) => a + e.amount, 0)).toBe(1);
  });

  it('checks the recipient, items already owned, and the daily caps', () => {
    expect(canRedeem([], { ...gift, to: 'someoneelse0001' }, me, day)).toEqual({ ok: false, reason: 'This gift is for someone else' });
    expect(canRedeem([], { ...gift, to: me }, me, day).ok).toBe(true);
    const owns = purchaseEntries(shopItem('title-scholar')!).map((e) => entry(e));
    expect(canRedeem(owns, gift, me, day)).toEqual({ ok: false, reason: 'You already own Title: Scholar' });
    const redeemed = Array.from({ length: GIFTS_PER_DAY }, (_, i) => entry({ currency: 'item:frame-gold', amount: 1, reason: 'gift:received', ref: `other${i}00000000` }));
    expect(canRedeem(redeemed, gift, me, day).ok).toBe(false);
    expect(canRedeem(redeemed, gift, me, '2026-10-21').ok).toBe(true);
    const sent = [
      ...['frame-gold', 'frame-neon', 'frame-leaf', 'title-legend'].flatMap((id) => purchaseEntries(shopItem(id)!).map((e) => entry(e))),
      ...['frame-gold', 'frame-neon', 'frame-leaf'].map((id, i) => entry({ currency: `item:${id}`, amount: -1, reason: 'gift:sent', ref: `sent${i}00000000` })),
    ];
    expect(canSend(sent, 'title-legend', day)).toEqual({ ok: false, reason: `You can send ${GIFTS_PER_DAY} gifts a day` });
  });
});

describe('virtual pet', () => {
  const H = 3_600_000;
  const born = Date.UTC(2026, 9, 1);

  it('starts fine and drifts down in real time, but never below zero', () => {
    expect(petState([], born, born)).toMatchObject({ fill: START.fill, joy: START.joy });
    const later = petState([], born, born + 10 * H);
    expect(later.fill).toBe(START.fill - 35);
    expect(later.mood).toBe('hungry');
    const week = petState([], born, born + 7 * 24 * H);
    expect(week).toEqual({ fill: 0, joy: 0, mood: 'sleepy' }); // sleepy, never gone
  });

  it('feeding, pats and finished tasks help', () => {
    const fish = FOODS.find((f) => f.id === 'fish')!;
    const events: PetEvent[] = [
      { at: born + 10 * H, kind: 'feed', food: 'fish' },
      { at: born + 10 * H, kind: 'pat' },
      { at: born + 10 * H, kind: 'task' },
      { at: born + 999 * H, kind: 'feed', food: 'fish' }, // in the future: ignored
    ];
    const s = petState(events, born, born + 10 * H);
    expect(s.fill).toBe(START.fill - 35 + fish.fill);
    expect(s.joy).toBe(START.joy - 25 + fish.joy + 5 + 4);
    expect(canFeed(s)).toBe(true);
    expect(canFeed({ fill: FULL_AT, joy: 50, mood: 'happy' })).toBe(false);
    expect(hoursUntilHungry({ fill: 45, joy: 50, mood: 'content' })).toBe(0);
  });

  it('caps at 100 and picks moods', () => {
    const lots: PetEvent[] = Array.from({ length: 10 }, (_, i) => ({ at: born + i, kind: 'feed', food: 'cupcake' }));
    expect(petState(lots, born, born + 10)).toMatchObject({ fill: 100, joy: 100, mood: 'happy' });
    expect(moodFor(10, 90)).toBe('sleepy');
    expect(moodFor(80, 10)).toBe('sad');
    expect(moodFor(50, 50)).toBe('content');
  });
});

describe('garden', () => {
  const done = (i: number, color?: string): Completion => ({ id: `c${i}`, at: new Date(2026, 9, 1, i).toISOString(), color });

  it('starts as one seed and grows a plant every four tasks', () => {
    expect(buildGarden([]).beds).toEqual([[expect.objectContaining({ stage: 0 })]]);
    const g = buildGarden([done(1, '#111111'), done(2), done(3)]);
    expect(g.beds[0]).toHaveLength(1);
    expect(g.beds[0][0]).toMatchObject({ stage: 3, color: '#111111' });
    expect(stepsToBloom(g.beds[0][0])).toBe(1);
    const g2 = buildGarden([1, 2, 3, 4].map((i) => done(i)));
    expect(g2.blooms).toBe(1);
    expect(g2.beds[0].map((p) => p.stage)).toEqual([STEPS_PER_PLANT, 0]); // next seed waiting
  });

  it('fills beds of twelve in completion order', () => {
    const all = Array.from({ length: BED_SIZE * STEPS_PER_PLANT + 5 }, (_, i) => done(i));
    const g = buildGarden([...all].reverse());
    expect(g.steps).toBe(all.length);
    expect(g.beds).toHaveLength(2);
    expect(g.beds[0]).toHaveLength(BED_SIZE);
    expect(g.beds[1].map((p) => p.stage)).toEqual([4, 1]);
    expect(g.beds[0][0].plantedAt).toBe(all[0].at);
    expect(g.blooms).toBe(BED_SIZE + 1);
  });
});

describe('homework dungeon', () => {
  const course = (id: string, over: Partial<Course> = {}): Course => ({ id, name: id.toUpperCase(), color: '#123456', archived: false, ...over });

  it('makes a floor per active course plus the commons, opening rooms for finished tasks', () => {
    const tasks = [
      task({ courseId: 'bio', completedAt: '2026-09-02T10:00:00.000Z', type: 'exam' }),
      task({ courseId: 'bio', dueAt: '2026-10-01' }),
      task({ courseId: 'bio', completedAt: '2026-09-01T10:00:00.000Z', type: 'reading' }),
      task({ courseId: 'old', completedAt: '2026-09-01T10:00:00.000Z' }),
      task({}),
      task({ courseId: 'math', completedAt: '2026-09-03T10:00:00.000Z' }),
    ];
    const floors = buildDungeon([course('bio'), course('math'), course('old', { archived: true })], tasks);
    expect(floors.map((f) => [f.id, f.level])).toEqual([
      ['bio', 1],
      ['math', 2],
      ['commons', 3],
    ]);
    const bio = floors[0];
    expect(bio.rooms.map((r) => [r.kind, r.open])).toEqual([
      ['library', true],
      ['boss', true],
      ['hall', false],
    ]);
    expect(bio).toMatchObject({ opened: 2, cleared: false });
    expect(floors[1].cleared).toBe(true);
    expect(floors[2].rooms).toHaveLength(2); // no course + archived course
    expect(dungeonSummary(floors)).toEqual({ opened: 4, rooms: 6, cleared: 1 });
  });

  it('lays rooms out in a snake so each touches the next', () => {
    expect(snake(0)).toEqual({ col: 0, row: 0 });
    expect(snake(5)).toEqual({ col: 5, row: 0 });
    expect(snake(6)).toEqual({ col: 5, row: 1 });
    expect(snake(11)).toEqual({ col: 0, row: 1 });
    for (let i = 1; i < 40; i++) {
      const a = snake(i - 1);
      const b = snake(i);
      expect(Math.abs(a.col - b.col) + Math.abs(a.row - b.row)).toBe(1);
    }
  });

  it('keeps big floors to a readable size', () => {
    const tasks = Array.from({ length: 80 }, (_, i) =>
      task({ courseId: 'bio', completedAt: i < 60 ? new Date(2026, 8, 1, 0, i).toISOString() : undefined, dueAt: i >= 60 ? '2026-10-01' : undefined }),
    );
    const [bio] = buildDungeon([course('bio')], tasks, { maxRooms: 24 });
    expect(bio.rooms).toHaveLength(24);
    expect(bio.hidden).toBe(56);
    expect(bio.rooms.filter((r) => !r.open)).toHaveLength(8);
    expect(bio.opened).toBe(60);
    expect(bio.rows).toBe(4);
    expect(roomKind({ type: 'homework', priority: 'urgent' })).toBe('treasure');
  });
});

describe('focus companion', () => {
  it('sleeps while the focus timer runs and wakes on breaks', () => {
    expect(companionState('work', true)).toBe('sleeping');
    expect(companionState('custom', true)).toBe('sleeping');
    expect(companionState('break', true)).toBe('playing');
    expect(companionState('long', true)).toBe('playing');
    expect(companionState('work', false)).toBe('waiting');
  });
});
