import { describe, expect, it } from 'vitest';
import { spreadDays, spreadOrder, spreadPlan } from './spread';
import type { Task } from './types';

const task = (id: string, p: Partial<Task> = {}): Pick<Task, 'id' | 'priority' | 'dueAt' | 'estimateMin' | 'type' | 'weight'> => ({
  id,
  priority: 'normal',
  dueAt: '2026-09-28',
  ...p,
});

describe('spreadOrder', () => {
  it('puts urgent before normal, exams before homework, then the oldest due first', () => {
    const list = [task('old', { dueAt: '2026-09-20' }), task('exam', { type: 'exam' }), task('urgent', { priority: 'urgent' }), task('new', { dueAt: '2026-09-29' })];
    expect([...list].sort(spreadOrder).map((t) => t.id)).toEqual(['urgent', 'exam', 'old', 'new']);
  });
});

describe('spreadPlan', () => {
  it('fills today up to the budget, then moves to tomorrow', () => {
    const plan = spreadPlan([task('a', { estimateMin: 60 }), task('b', { estimateMin: 60 }), task('c', { estimateMin: 60 }), task('d', { estimateMin: 60 })], '2026-10-01', {
      budgetMin: 120,
    });
    expect(plan).toEqual([
      { id: 'a', day: '2026-10-01' },
      { id: 'b', day: '2026-10-01' },
      { id: 'c', day: '2026-10-02' },
      { id: 'd', day: '2026-10-02' },
    ]);
    expect(spreadDays(plan)).toBe(2);
  });
  it('counts what is already due that day', () => {
    const plan = spreadPlan([task('a', { estimateMin: 30 })], '2026-10-01', { budgetMin: 60, usedMin: { '2026-10-01': 45 } });
    expect(plan[0].day).toBe('2026-10-02');
  });
  it('a task bigger than any day still lands on a free day, the rest on the last', () => {
    const plan = spreadPlan([task('big', { estimateMin: 500 }), task('huge', { estimateMin: 500 }), task('giant', { estimateMin: 500 })], '2026-10-01', { budgetMin: 60, days: 2 });
    expect(plan.map((p) => p.day)).toEqual(['2026-10-01', '2026-10-02', '2026-10-02']);
  });
  it('uses the weekday capacity when one is set', () => {
    // 2026-10-03 is a Saturday
    const plan = spreadPlan([task('a', { estimateMin: 90 }), task('b', { estimateMin: 90 })], '2026-10-03', { budgetMin: 60, weekdayBudget: { 6: 200 } });
    expect(plan.every((p) => p.day === '2026-10-03')).toBe(true);
  });
  it('tasks without an estimate count as 30 minutes', () => {
    const plan = spreadPlan([task('a'), task('b'), task('c')], '2026-10-01', { budgetMin: 60 });
    expect(plan.map((p) => p.day)).toEqual(['2026-10-01', '2026-10-01', '2026-10-02']);
  });
});
