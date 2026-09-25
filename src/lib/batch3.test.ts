import { describe, expect, it } from 'vitest';
import { applyFilter, EMPTY_FILTER } from './filters';
import { dependents, isBlocked, openBlockers, wouldCycle } from './deps';
import { dueReminders, fireTime } from './remind';
import { calibrated, estimateAccuracy } from './estimates';
import { describeRecurrence, nextOccurrenceKey, nthWeekdayKey } from './recurrence';
import { parseQuickAdd } from './parser';
import type { Task } from './types';

const t = (id: string, over: Partial<Task> = {}): Task => ({
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
const map = (ts: Task[]) => new Map(ts.map((x) => [x.id, x]));

describe('dependencies', () => {
  it('blocks until blockers are done, ignores deleted blockers', () => {
    const a = t('a');
    const b = t('b', { blockedBy: ['a', 'gone'] });
    expect(isBlocked(b, map([a, b]))).toBe(true);
    expect(openBlockers(b, map([a, b])).map((x) => x.id)).toEqual(['a']);
    expect(isBlocked(b, map([{ ...a, completedAt: 'x' }, b]))).toBe(false);
    expect(dependents('a', [a, b]).map((x) => x.id)).toEqual(['b']);
  });
  it('detects cycles', () => {
    const ts = [t('a', { blockedBy: ['b'] }), t('b', { blockedBy: ['c'] }), t('c')];
    expect(wouldCycle('c', 'a', map(ts))).toBe(true);
    expect(wouldCycle('a', 'c', map(ts))).toBe(false);
    expect(wouldCycle('a', 'a', map(ts))).toBe(true);
  });
});

describe('filters', () => {
  const ctx = { today: '2026-09-24', courseName: () => '' };
  const tasks = [
    t('exam', { type: 'exam', dueAt: '2026-10-01' }),
    t('late', { dueAt: '2026-09-20' }),
    t('far', { type: 'exam', dueAt: '2026-12-01' }),
    t('hi', { priority: 'urgent' }),
    t('wait', { blockedBy: ['hi'] }),
  ];
  it('relative windows, overdue, priority and blocked', () => {
    expect(applyFilter(tasks, { ...EMPTY_FILTER, type: 'exam', withinDays: 14 }, ctx).map((x) => x.id)).toEqual(['exam']);
    expect(applyFilter(tasks, { ...EMPTY_FILTER, overdue: true }, ctx).map((x) => x.id)).toEqual(['late']);
    expect(applyFilter(tasks, { ...EMPTY_FILTER, priorities: ['urgent'] }, ctx).map((x) => x.id)).toEqual(['hi']);
    expect(applyFilter(tasks, { ...EMPTY_FILTER, blocked: 'only' }, ctx).map((x) => x.id)).toEqual(['wait']);
    expect(applyFilter(tasks, { ...EMPTY_FILTER, blocked: 'hide' }, ctx)).toHaveLength(4);
  });
});

describe('reminders', () => {
  const task = t('r', { dueAt: new Date(2026, 8, 25, 14, 0).toISOString(), reminders: [{ before: 30 }, { nightBefore: true }] });
  it('computes fire times', () => {
    expect(fireTime(task, { before: 30 })!.getHours()).toBe(13);
    expect(fireTime(task, { nightBefore: true })!.getDate()).toBe(24);
    expect(fireTime(task, { nightBefore: true })!.getHours()).toBe(20);
    expect(fireTime(t('x'), { before: 10 })).toBeNull();
    expect(fireTime(t('d', { dueAt: '2026-09-25' }), { morningOf: true })!.getHours()).toBe(8);
  });
  it('fires once within the grace window', () => {
    const sent = new Set<string>();
    const now = new Date(2026, 8, 25, 13, 32);
    const due = dueReminders([task], now, sent);
    expect(due).toHaveLength(1);
    sent.add(due[0].key);
    expect(dueReminders([task], now, sent)).toHaveLength(0);
    expect(dueReminders([task], new Date(2026, 8, 25, 13, 50), new Set())).toHaveLength(0); // too late
    expect(dueReminders([{ ...task, completedAt: 'x' }], now, new Set())).toHaveLength(0);
  });
});

describe('estimates', () => {
  it('reports the median overrun and calibrates', () => {
    const done = [30, 40, 60, 45, 50].map((spent, i) => t(`e${i}`, { completedAt: 'x', estimateMin: 30, timeSpentMin: spent }));
    const acc = estimateAccuracy(done)!;
    expect(acc.medianRatio).toBe(1.5);
    expect(acc.message).toContain('50% longer');
    expect(calibrated(40, acc)).toBe(60);
    expect(estimateAccuracy(done.slice(0, 2))).toBeNull();
  });
});

describe('recurrence', () => {
  it('nth weekday of a month', () => {
    expect(nthWeekdayKey(2026, 8, 2, 2)).toBe('2026-09-08'); // 2nd Tuesday of Sep 2026
    expect(nthWeekdayKey(2026, 8, 5, -1)).toBe('2026-09-25'); // last Friday
    expect(nthWeekdayKey(2026, 1, 1, 5)).toBeUndefined(); // no 5th Monday in Feb 2026
  });
  it('monthly, monthlyNth and every other week', () => {
    expect(nextOccurrenceKey({ kind: 'monthly' }, '2026-01-31', '2026-01-31')).toBe('2026-02-28');
    expect(nextOccurrenceKey({ kind: 'monthlyNth', nth: 2, weekday: 2 }, '2026-09-08', '2026-09-08')).toBe('2026-10-13');
    expect(nextOccurrenceKey({ kind: 'weekly', days: [2], n: 2 }, '2026-09-08', '2026-09-08')).toBe('2026-09-22');
    expect(nextOccurrenceKey({ kind: 'weekly', days: [2], n: 2 }, '2026-09-08', '2026-09-16')).toBe('2026-09-22');
    expect(describeRecurrence({ kind: 'monthlyNth', nth: 2, weekday: 2 })).toBe('Every 2nd Tuesday');
    expect(describeRecurrence({ kind: 'weekly', days: [2], n: 2 })).toBe('Every other week on Tue');
  });
  it('quick add understands the new phrases', () => {
    const now = new Date(2026, 8, 24, 10);
    expect(parseQuickAdd('Club meeting every 2nd tue', { now }).recurrence).toEqual({ kind: 'monthlyNth', nth: 2, weekday: 2 });
    expect(parseQuickAdd('Chem lab every other thu', { now }).recurrence).toEqual({ kind: 'weekly', days: [4], n: 2 });
    expect(parseQuickAdd('Pay phone bill monthly', { now }).recurrence).toEqual({ kind: 'monthly' });
    expect(parseQuickAdd('Journal every 3 weeks', { now }).recurrence).toEqual({ kind: 'weekly', n: 3 });
  });
});
