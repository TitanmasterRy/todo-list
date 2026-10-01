import { describe, expect, it } from 'vitest';
import { buildMatrix, classify, isImportant, isUrgent, quadrantMinutes } from './matrix';
import type { Task } from './types';

const TODAY = '2026-10-01';
const task = (p: Partial<Task> = {}): Pick<Task, 'id' | 'priority' | 'dueAt' | 'type' | 'weight' | 'frog' | 'frogDate' | 'pinnedDay' | 'estimateMin'> => ({
  id: p.id ?? 'x',
  priority: 'normal',
  ...p,
});

describe('isImportant', () => {
  it('counts priority, graded types and heavy weights', () => {
    expect(isImportant(task({ priority: 'high' }))).toBe(true);
    expect(isImportant(task({ type: 'exam' }))).toBe(true);
    expect(isImportant(task({ weight: 15 }))).toBe(true);
    expect(isImportant(task({ type: 'reading', weight: 5 }))).toBe(false);
  });
});

describe('isUrgent', () => {
  it('is due within two days, overdue, the frog or pinned into today', () => {
    expect(isUrgent(task({ dueAt: '2026-10-03' }), TODAY)).toBe(true);
    expect(isUrgent(task({ dueAt: '2026-10-04' }), TODAY)).toBe(false);
    expect(isUrgent(task({ dueAt: '2026-09-20' }), TODAY)).toBe(true);
    expect(isUrgent(task({ frog: true, frogDate: TODAY }), TODAY)).toBe(true);
    expect(isUrgent(task({ pinnedDay: TODAY }), TODAY)).toBe(true);
    expect(isUrgent(task({}), TODAY)).toBe(false);
  });
  it('takes a wider window when asked', () => {
    expect(isUrgent(task({ dueAt: '2026-10-05' }), TODAY, 4)).toBe(true);
  });
});

describe('classify / buildMatrix', () => {
  it('puts each task in its box', () => {
    expect(classify(task({ type: 'exam', dueAt: '2026-10-02' }), TODAY)).toBe('do');
    expect(classify(task({ type: 'project', dueAt: '2026-10-20' }), TODAY)).toBe('plan');
    expect(classify(task({ dueAt: '2026-10-01' }), TODAY)).toBe('quick');
    expect(classify(task({ type: 'reading' }), TODAY)).toBe('later');
  });
  it('orders a box by due date, then priority', () => {
    const m = buildMatrix(
      [
        task({ id: 'b', dueAt: '2026-10-02' }),
        task({ id: 'c' }),
        task({ id: 'a', dueAt: '2026-10-01', priority: 'low' }),
        task({ id: 'a2', dueAt: '2026-10-01', priority: 'high' }),
      ],
      TODAY,
    );
    expect(m.quick.map((t) => t.id)).toEqual(['a', 'b']);
    expect(m.do.map((t) => t.id)).toEqual(['a2']);
    expect(m.later.map((t) => t.id)).toEqual(['c']);
    expect(m.plan).toEqual([]);
  });
});

describe('quadrantMinutes', () => {
  it('sums estimates with 30 for the unknown ones', () => {
    expect(quadrantMinutes([task({ estimateMin: 45 }), task({})])).toBe(75);
  });
});
