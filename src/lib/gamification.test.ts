import { describe, expect, it } from 'vitest';
import {
  applyCompletion,
  comboMultiplierFor,
  computeXp,
  effectiveStreak,
  evaluateBadges,
  levelForXp,
  levelProgress,
  updateStreak,
  xpForLevel,
} from './gamification';
import { DEFAULT_STATS, type Stats, type Task } from './types';

function task(over: Partial<Task> = {}): Task {
  return {
    id: 't1',
    title: 'x',
    tags: [],
    priority: 'normal',
    subtasks: [],
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    order: 0,
    deferredCount: 0,
    ...over,
  };
}

describe('levels', () => {
  it('follows 100 * n^1.4', () => {
    expect(xpForLevel(1)).toBe(100);
    expect(xpForLevel(2)).toBe(264);
    expect(xpForLevel(0)).toBe(0);
  });
  it('maps xp to level', () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(99)).toBe(1);
    expect(levelForXp(100)).toBe(2);
    expect(levelForXp(264)).toBe(3);
  });
  it('reports progress', () => {
    const p = levelProgress(150);
    expect(p.level).toBe(2);
    expect(p.into).toBe(50);
    expect(p.needed).toBe(164);
  });
});

describe('xp', () => {
  const at = new Date(2026, 8, 14, 10, 0);
  it('uses base by priority', () => {
    expect(computeXp(task({ priority: 'low' }), at, 0).total).toBe(5);
    expect(computeXp(task({ priority: 'normal' }), at, 0).total).toBe(10);
    expect(computeXp(task({ priority: 'high' }), at, 0).total).toBe(20);
    expect(computeXp(task({ priority: 'urgent' }), at, 0).total).toBe(30);
  });
  it('adds subtask bonus', () => {
    const t = task({ subtasks: [{ id: 'a', title: 'a', done: true }, { id: 'b', title: 'b', done: true }] });
    expect(computeXp(t, at, 0).total).toBe(20);
  });
  it('applies early bonus', () => {
    expect(computeXp(task({ dueAt: '2026-09-15' }), at, 0).total).toBe(13); // 10 * 1.25 = 12.5 -> 13
    expect(computeXp(task({ dueAt: '2026-09-14' }), at, 0).early).toBe(true); // same day counts
    expect(computeXp(task({ dueAt: '2026-09-13' }), at, 0).early).toBe(false);
  });
  it('applies long task multiplier', () => {
    expect(computeXp(task({ estimateMin: 60 }), at, 0).total).toBe(15);
    expect(computeXp(task({ estimateMin: 59 }), at, 0).total).toBe(10);
  });
  it('doubles the frog', () => {
    expect(computeXp(task({ frog: true, frogDate: '2026-09-14' }), at, 0).total).toBe(20);
    expect(computeXp(task({ frog: true, frogDate: '2026-09-13' }), at, 0).total).toBe(10);
  });
  it('combo multiplier climbs to 2', () => {
    expect(comboMultiplierFor(0)).toBe(1);
    expect(comboMultiplierFor(1)).toBe(1.1);
    expect(comboMultiplierFor(5)).toBe(1.5);
    expect(comboMultiplierFor(10)).toBe(2);
    expect(comboMultiplierFor(50)).toBe(2);
    expect(computeXp(task(), at, 2).total).toBe(12);
  });
});

describe('streak', () => {
  it('starts at 1', () => {
    const r = updateStreak({ current: 0, best: 0, lastDate: '', freezes: 0 }, '2026-09-14');
    expect(r.streak.current).toBe(1);
    expect(r.streak.lastDate).toBe('2026-09-14');
  });
  it('increments on consecutive days and ignores same day', () => {
    let s = updateStreak({ current: 0, best: 0, lastDate: '', freezes: 0 }, '2026-09-14').streak;
    s = updateStreak(s, '2026-09-14').streak;
    expect(s.current).toBe(1);
    s = updateStreak(s, '2026-09-15').streak;
    expect(s.current).toBe(2);
    expect(s.best).toBe(2);
  });
  it('consumes a freeze for a missed day', () => {
    const r = updateStreak({ current: 5, best: 5, lastDate: '2026-09-10', freezes: 1 }, '2026-09-12');
    expect(r.streak.current).toBe(6);
    expect(r.streak.freezes).toBe(0);
    expect(r.freezesUsed).toBe(1);
  });
  it('breaks without freezes', () => {
    const r = updateStreak({ current: 5, best: 5, lastDate: '2026-09-10', freezes: 0 }, '2026-09-12');
    expect(r.streak.current).toBe(1);
    expect(r.broke).toBe(true);
    expect(r.streak.best).toBe(5);
  });
  it('earns a freeze every 7 days, max 2', () => {
    const r = updateStreak({ current: 6, best: 6, lastDate: '2026-09-10', freezes: 0 }, '2026-09-11');
    expect(r.streak.current).toBe(7);
    expect(r.streak.freezes).toBe(1);
    expect(r.freezeEarned).toBe(true);
    const r2 = updateStreak({ current: 13, best: 13, lastDate: '2026-09-10', freezes: 2 }, '2026-09-11', 7);
    expect(r2.streak.freezes).toBe(2);
    expect(r2.freezeEarned).toBe(false);
  });
  it('effective streak shows 0 when broken without freezes', () => {
    const stats: Stats = { ...DEFAULT_STATS, streak: { current: 4, best: 4, lastDate: '2026-09-10', freezes: 0 } };
    expect(effectiveStreak(stats, '2026-09-11')).toBe(4);
    expect(effectiveStreak(stats, '2026-09-12')).toBe(0);
    expect(effectiveStreak({ ...stats, streak: { ...stats.streak, freezes: 1 } }, '2026-09-12')).toBe(4);
  });
});

describe('applyCompletion', () => {
  it('accumulates xp, counts, ring and badges', () => {
    const at = new Date(2026, 8, 14, 10, 0);
    let stats: Stats = structuredClone(DEFAULT_STATS);
    let combo;
    let r = applyCompletion(stats, task(), at, combo, 5);
    expect(r.xp.total).toBe(10);
    expect(r.stats.totalCompleted).toBe(1);
    expect(r.newBadges).toContain('first_task');
    expect(r.ringClosed).toBe(false);
    stats = r.stats;
    combo = r.combo;
    r = applyCompletion(stats, task(), new Date(at.getTime() + 60_000), combo, 4);
    expect(r.xp.comboMultiplier).toBe(1.1);
    stats = r.stats;
    combo = r.combo;
    r = applyCompletion(stats, task(), new Date(at.getTime() + 120_000), combo, 0);
    expect(r.ringClosed).toBe(true);
    expect(r.newBadges).toContain('inbox_zero');
    expect(r.stats.completionsByDay['2026-09-14']).toBe(3);
    expect(r.stats.streak.current).toBe(1);
  });
  it('resets combo after the window', () => {
    const at = new Date(2026, 8, 14, 10, 0);
    const r = applyCompletion(structuredClone(DEFAULT_STATS), task(), at, { count: 3, lastAt: at.getTime() - 4 * 60_000 }, 1);
    expect(r.combo.count).toBe(0);
  });
  it('levels up', () => {
    const stats: Stats = { ...structuredClone(DEFAULT_STATS), xp: 95 };
    const r = applyCompletion(stats, task(), new Date(2026, 8, 14, 10), undefined, 1);
    expect(r.leveledUp).toBe(true);
    expect(r.newLevel).toBe(2);
  });
});

describe('badges', () => {
  it('night owl and exam slayer', () => {
    const stats: Stats = { ...structuredClone(DEFAULT_STATS), totalCompleted: 1, examCount: 10 };
    const b = evaluateBadges(stats, { openTasksRemaining: 3, completedAt: new Date(2026, 8, 14, 23, 30), today: '2026-09-14' });
    expect(b).toContain('night_owl');
    expect(b).toContain('exam_slayer');
    expect(b).not.toContain('inbox_zero');
  });
  it('ring x5 needs five consecutive days', () => {
    const stats: Stats = {
      ...structuredClone(DEFAULT_STATS),
      ringDays: ['2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13', '2026-09-14'],
    };
    expect(evaluateBadges(stats, { openTasksRemaining: 1, today: '2026-09-14' })).toContain('ring_5');
    expect(evaluateBadges({ ...stats, ringDays: stats.ringDays.slice(1) }, { openTasksRemaining: 1, today: '2026-09-14' })).not.toContain('ring_5');
  });
});
