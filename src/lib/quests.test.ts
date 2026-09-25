import { describe, expect, it } from 'vitest';
import { dealOfDay, QUESTS, questsFor, type QuestContext } from './quests';
import { DEFAULT_STATS, type Task } from './types';

const t = (over: Partial<Task>): Task => ({
  id: Math.random().toString(36),
  title: 'x',
  tags: [],
  priority: 'normal',
  subtasks: [],
  createdAt: '',
  updatedAt: '',
  order: 0,
  deferredCount: 0,
  ...over,
});
const ctx = (over: Partial<QuestContext> = {}): QuestContext => ({ today: '2026-09-24', tasks: [], stats: structuredClone(DEFAULT_STATS), cards: [], dailyGoal: 3, ...over });
const at = (h: number) => new Date(2026, 8, 24, h).toISOString();

describe('daily quests', () => {
  it('picks three, the same for the same day, different across days', () => {
    const a = questsFor(ctx()).map((q) => q.id);
    expect(a).toHaveLength(3);
    expect(questsFor(ctx()).map((q) => q.id)).toEqual(a);
    const days = new Set(
      Array.from({ length: 10 }, (_, i) =>
        questsFor(ctx({ today: `2026-10-${String(i + 1).padStart(2, '0')}` }))
          .map((q) => q.id)
          .join(),
      ),
    );
    expect(days.size).toBeGreaterThan(3);
  });
  it('never offers finish-3 with finish-5, and skips quests that are impossible', () => {
    for (let d = 1; d <= 28; d++) {
      const ids = questsFor(ctx({ today: `2026-11-${String(d).padStart(2, '0')}` })).map((q) => q.id);
      expect(ids.includes('finish3') && ids.includes('finish5')).toBe(false);
      expect(ids).not.toContain('cards'); // no notecards
      expect(ids).not.toContain('frog'); // no frog picked
    }
  });
  it('measures progress from real data', () => {
    const c = ctx({
      tasks: [
        t({ completedAt: at(10) }),
        t({ completedAt: at(11), dueAt: '2026-09-30', priority: 'high' }),
        t({ completedAt: at(12), dueAt: '2026-09-20' }),
        t({ completedAt: '2026-09-23T10:00:00.000Z' }),
      ],
    });
    c.stats.pomodorosByDay['2026-09-24'] = 2;
    const p = (id: string) => QUESTS.find((q) => q.id === id)!.progress(c);
    expect(p('finish3')).toBe(3);
    expect(p('early')).toBe(1);
    expect(p('high')).toBe(1);
    expect(p('overdue')).toBe(1);
    expect(p('pomodoro3')).toBe(2);
  });
});

describe('deal of the day', () => {
  it('rotates daily and skips owned items', () => {
    const a = dealOfDay('2026-09-24', () => false);
    expect(a).toBeDefined();
    expect(dealOfDay('2026-09-24', () => false)).toBe(a);
    expect(dealOfDay('2026-09-24', (id) => id === a)).not.toBe(a);
    expect(dealOfDay('2026-09-24', () => true)).toBeUndefined();
  });
});

import { addCasinoMinutes, casinoMinutesLeft, checkPin, hashPin, validPin } from './parental';
describe('parent lock', () => {
  it('hashes and checks PINs', async () => {
    const h = await hashPin('4321');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(await checkPin('4321', h)).toBe(true);
    expect(await checkPin('1234', h)).toBe(false);
    expect(await checkPin('4321', '')).toBe(false);
    expect(validPin('12')).toBe(false);
    expect(validPin('123456')).toBe(true);
  });
  it('tracks casino minutes per day', () => {
    let d = addCasinoMinutes({}, '2026-09-24', 5);
    d = addCasinoMinutes(d, '2026-09-24', 10);
    expect(casinoMinutesLeft(30, d, '2026-09-24')).toBe(15);
    expect(casinoMinutesLeft(30, d, '2026-09-25')).toBe(30);
    expect(casinoMinutesLeft(0, d, '2026-09-24')).toBe(Infinity);
    expect(casinoMinutesLeft(10, d, '2026-09-24')).toBe(0);
  });
});
