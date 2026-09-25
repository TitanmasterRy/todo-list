import { describe, expect, it } from 'vitest';
import { pinsFor, planWeek } from './weekplan';
import type { Task } from './types';

let order = 0;
const t = (id: string, extra: Partial<Task> = {}): Task => ({
  id,
  title: id,
  tags: [],
  priority: 'normal',
  subtasks: [],
  createdAt: '',
  updatedAt: '',
  order: order++,
  deferredCount: 0,
  ...extra,
});
const today = '2026-10-05';
const cap = () => 60;
const where = (p: ReturnType<typeof planWeek>) => Object.fromEntries(p.days.flatMap((d) => d.items.map((i) => [i.task.id, d.key])));

describe('planWeek', () => {
  it('fills days earliest deadline first within capacity', () => {
    const p = planWeek(
      [t('essay', { dueAt: '2026-10-08', estimateMin: 45 }), t('quiz', { dueAt: '2026-10-06', estimateMin: 30 }), t('read', { dueAt: '2026-10-07', estimateMin: 30 })],
      { today, capacity: cap },
    );
    expect(where(p)).toEqual({ quiz: '2026-10-05', read: '2026-10-05', essay: '2026-10-06' });
    expect(p.days[0].used).toBe(60);
  });
  it('never plans after the due day; overflow is flagged', () => {
    const p = planWeek([t('a', { dueAt: '2026-10-05', estimateMin: 50 }), t('b', { dueAt: '2026-10-05', estimateMin: 50 })], { today, capacity: cap });
    expect(where(p)).toEqual({ a: '2026-10-05', b: '2026-10-05' });
    expect(p.days[0].items.find((i) => i.task.id === 'b')?.late).toBe(true);
  });
  it('puts overdue work on today and guesses missing estimates', () => {
    const p = planWeek([t('old', { dueAt: '2026-10-01' })], { today, capacity: cap });
    expect(where(p)).toEqual({ old: '2026-10-05' });
    expect(p.days[0].items[0]).toMatchObject({ min: 30, guessed: true });
  });
  it('schedules after blockers and respects priority on the same due day', () => {
    const p = planWeek(
      [
        t('draft', { dueAt: '2026-10-09', estimateMin: 60, blockedBy: ['outline'] }),
        t('outline', { dueAt: '2026-10-09', estimateMin: 60 }),
        t('lab', { dueAt: '2026-10-09', estimateMin: 60, priority: 'urgent' }),
      ],
      { today, capacity: cap },
    );
    expect(where(p)).toEqual({ lab: '2026-10-05', outline: '2026-10-06', draft: '2026-10-07' });
  });
  it('fits undated work into leftover time only when asked, and skips far-off work', () => {
    const tasks = [t('someday', { estimateMin: 30 }), t('big', { estimateMin: 500 }), t('later', { dueAt: '2026-11-01', estimateMin: 30 })];
    expect(where(planWeek(tasks, { today, capacity: cap }))).toEqual({});
    const p = planWeek(tasks, { today, capacity: cap, includeUndated: true });
    expect(where(p)).toEqual({ someday: '2026-10-05' });
    expect(p.unplaced.map((x) => x.id)).toEqual(['big']);
  });
  it('pins only work planned before its due day', () => {
    const p = planWeek([t('a', { dueAt: '2026-10-05', estimateMin: 30 }), t('b', { dueAt: '2026-10-09', estimateMin: 30 }), t('c', { estimateMin: 10 })], {
      today,
      capacity: cap,
      includeUndated: true,
    });
    expect(pinsFor(p)).toEqual({ a: undefined, b: '2026-10-05', c: '2026-10-06' }); // Monday is full by the time undated work comes up
  });
  it('respects per-day capacity (e.g. a busy day)', () => {
    const p = planWeek([t('x', { dueAt: '2026-10-09', estimateMin: 40 })], { today, capacity: (k) => (k === today ? 20 : 60) });
    expect(where(p)).toEqual({ x: '2026-10-06' });
  });
});
