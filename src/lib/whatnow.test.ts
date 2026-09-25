import { describe, expect, it } from 'vitest';
import { whatNow, scoreTask } from './whatnow';
import type { Task } from './types';

const base = (id: string, over: Partial<Task> = {}): Task => ({
  id,
  title: id,
  tags: [],
  priority: 'normal',
  subtasks: [],
  createdAt: '',
  updatedAt: '',
  order: 0,
  deferredCount: 0,
  ...over,
});
const now = new Date('2026-09-24T15:00:00');
const today = '2026-09-24';

describe('whatNow', () => {
  it('puts overdue before due today before later', () => {
    const picks = whatNow([base('later', { dueAt: '2026-10-10' }), base('today', { dueAt: today }), base('late', { dueAt: '2026-09-22' })], now, { today });
    expect(picks.map((p) => p.task.id)).toEqual(['late', 'today', 'later']);
    expect(picks[0].reasons[0]).toBe('overdue by 2 days');
  });
  it('urgent priority beats a normal task due tomorrow', () => {
    const picks = whatNow([base('tomorrow', { dueAt: '2026-09-25' }), base('urgent', { priority: 'urgent', dueAt: '2026-09-25' })], now, { today });
    expect(picks[0].task.id).toBe('urgent');
  });
  it('gives exams a head start and counts grade weight', () => {
    const exam = scoreTask(base('exam', { type: 'exam', dueAt: '2026-09-29' }), now, { today });
    const hw = scoreTask(base('hw', { type: 'homework', dueAt: '2026-09-29' }), now, { today });
    expect(exam.score).toBeGreaterThan(hw.score);
    expect(scoreTask(base('w', { weight: 30 }), now, { today }).reasons).toContain('30% of the grade');
  });
  it('skips completed tasks and prefers what fits the free time', () => {
    const picks = whatNow([base('done', { completedAt: 'x', dueAt: today }), base('long', { estimateMin: 180 }), base('short', { estimateMin: 20 })], now, {
      today,
      minutesFree: 30,
    });
    expect(picks.map((p) => p.task.id)).toEqual(['short', 'long']);
  });
  it('mentions a deadline in the next few hours', () => {
    expect(scoreTask(base('soon', { dueAt: '2026-09-24T16:00:00' }), now, { today }).reasons[0]).toBe('due in 60 min');
  });
});

import { monthGrid, shiftMonth } from './calendar';
describe('month grid', () => {
  it('starts on the week start and covers 6 weeks', () => {
    const g = monthGrid(2026, 8, 1); // September 2026 starts on a Tuesday
    expect(g).toHaveLength(42);
    expect(g[0]).toBe('2026-08-31'); // Monday before
    expect(g).toContain('2026-09-30');
    expect(monthGrid(2026, 8, 0)[0]).toBe('2026-08-30'); // Sunday start
  });
  it('shifts across years', () => {
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
  });
});
