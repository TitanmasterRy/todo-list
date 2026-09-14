import { describe, expect, it } from 'vitest';
import { nextOccurrenceKey, spawnNextInstance } from './recurrence';
import type { Task } from './types';

describe('nextOccurrenceKey', () => {
  it('daily', () => {
    expect(nextOccurrenceKey({ kind: 'daily' }, '2026-09-14', '2026-09-14')).toBe('2026-09-15');
  });
  it('weekdays skips weekends', () => {
    // 2026-09-18 is a Friday
    expect(nextOccurrenceKey({ kind: 'weekdays' }, '2026-09-18', '2026-09-18')).toBe('2026-09-21');
  });
  it('weekly picks next listed day', () => {
    // 2026-09-14 is Monday; days Mon(1) Wed(3)
    expect(nextOccurrenceKey({ kind: 'weekly', days: [1, 3] }, '2026-09-14', '2026-09-14')).toBe('2026-09-16');
    expect(nextOccurrenceKey({ kind: 'weekly', days: [1, 3] }, '2026-09-14', '2026-09-16')).toBe('2026-09-21');
  });
  it('every N days steps from anchor', () => {
    expect(nextOccurrenceKey({ kind: 'everyNDays', n: 3 }, '2026-09-10', '2026-09-14')).toBe('2026-09-16');
  });
  it('respects until', () => {
    expect(nextOccurrenceKey({ kind: 'daily', until: '2026-09-14' }, '2026-09-14', '2026-09-14')).toBeUndefined();
  });
});

describe('spawnNextInstance', () => {
  const base: Task = {
    id: 'a',
    title: 'Practice',
    tags: [],
    priority: 'normal',
    subtasks: [{ id: 's1', title: 'warmup', done: true }],
    recurrence: { kind: 'daily' },
    dueAt: '2026-09-14',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    order: 0,
    deferredCount: 3,
    completedAt: '2026-09-14T10:00:00.000Z',
  };
  it('creates a fresh instance with reset state', () => {
    const next = spawnNextInstance(base, new Date(2026, 8, 14, 10), 'b');
    expect(next?.id).toBe('b');
    expect(next?.dueAt).toBe('2026-09-15');
    expect(next?.completedAt).toBeUndefined();
    expect(next?.deferredCount).toBe(0);
    expect(next?.subtasks[0].done).toBe(false);
  });
  it('schedules after today when overdue', () => {
    const next = spawnNextInstance({ ...base, dueAt: '2026-09-01' }, new Date(2026, 8, 14, 10), 'b');
    expect(next?.dueAt).toBe('2026-09-15');
  });
  it('keeps time of day', () => {
    const due = new Date(2026, 8, 14, 20, 0).toISOString();
    const next = spawnNextInstance({ ...base, dueAt: due }, new Date(2026, 8, 14, 10), 'b');
    const d = new Date(next!.dueAt!);
    expect(d.getDate()).toBe(15);
    expect(d.getHours()).toBe(20);
  });
  it('returns undefined when not recurring', () => {
    expect(spawnNextInstance({ ...base, recurrence: undefined }, new Date(), 'b')).toBeUndefined();
  });
});
