import { describe, expect, it } from 'vitest';
import { HISTORY_MAX, mergeHistory, normalizeHistory, recordHistory } from './history';
import { mergeTask } from './fieldmerge';
import { normalizeTask } from './backup';
import type { Task } from './types';

const base: Task = {
  id: 't1',
  title: 'Essay',
  tags: [],
  priority: 'normal',
  subtasks: [],
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
  order: 0,
  deferredCount: 0,
};

describe('task edit history', () => {
  it('records tracked fields only', () => {
    const next = { ...base, dueAt: '2026-09-10', order: 5, updatedAt: '2026-09-02T10:00:00.000Z' };
    expect(recordHistory(base, next, next.updatedAt)).toEqual([{ at: next.updatedAt, f: 'dueAt', from: undefined, to: '2026-09-10' }]);
    const reorder = { ...base, order: 9 };
    expect(recordHistory(base, reorder, 'x')).toBeUndefined();
  });
  it('summarizes subtasks, tags and long notes', () => {
    const next = {
      ...base,
      subtasks: [
        { id: 's1', title: 'a', done: true },
        { id: 's2', title: 'b', done: false },
      ],
      tags: ['lab', 'bio'],
      notes: 'x'.repeat(200),
    };
    const h = recordHistory(base, next, '2026-09-02T10:00:00.000Z')!;
    expect(h.find((e) => e.f === 'subtasks')?.to).toBe('1/2');
    expect(h.find((e) => e.f === 'tags')?.to).toBe('#lab #bio');
    expect(h.find((e) => e.f === 'notes')?.to).toHaveLength(60);
  });
  it('folds quick edits to one field into one entry, and drops a change that was undone', () => {
    const a = { ...base, title: 'Essay d' };
    const h1 = recordHistory(base, a, '2026-09-02T10:00:00.000Z')!;
    const b = { ...a, title: 'Essay draft', history: h1 };
    const h2 = recordHistory(a, b, '2026-09-02T10:01:00.000Z')!;
    expect(h2).toEqual([{ at: '2026-09-02T10:01:00.000Z', f: 'title', from: 'Essay', to: 'Essay draft' }]);
    const c = { ...b, title: 'Essay', history: h2 };
    expect(recordHistory(b, c, '2026-09-02T10:01:30.000Z')).toEqual([]);
    // later edits are separate
    const d = { ...b, title: 'Final essay', history: h2 };
    expect(recordHistory(b, d, '2026-09-02T11:00:00.000Z')).toHaveLength(2);
  });
  it('keeps completions as separate entries and caps the list', () => {
    let prev: Task = base;
    for (let i = 0; i < 40; i++) {
      const at = new Date(Date.UTC(2026, 8, 2, 10, i * 5)).toISOString();
      const next: Task = { ...prev, completedAt: prev.completedAt ? undefined : at, updatedAt: at };
      next.history = recordHistory(prev, next, at);
      prev = next;
    }
    expect(prev.history).toHaveLength(HISTORY_MAX);
  });
  it('merges two devices by time', () => {
    const a = [{ at: '2026-09-02T10:00:00Z', f: 'title', to: 'A' }];
    const b = [
      { at: '2026-09-01T10:00:00Z', f: 'dueAt', to: '2026-09-10' },
      { at: '2026-09-02T10:00:00Z', f: 'title', to: 'A' },
    ];
    expect(mergeHistory(a, b)?.map((e) => e.f)).toEqual(['dueAt', 'title']);
    expect(mergeHistory(undefined, b)).toBe(b);
    const l = { ...base, fieldBase: base.createdAt, history: a, updatedAt: '2026-09-02T10:00:00.000Z' };
    const r = { ...base, fieldBase: base.createdAt, history: b, updatedAt: '2026-09-01T10:00:00.000Z' };
    expect(mergeTask(l, r).task.history).toHaveLength(2);
  });
  it('drops malformed entries on import', () => {
    expect(normalizeHistory([{ at: 'x', f: 'title', to: 5 }, { f: 'x' }, 'junk'])).toEqual([{ at: 'x', f: 'title', from: undefined, to: undefined }]);
    expect(normalizeHistory('nope')).toBeUndefined();
    expect(normalizeTask({ ...base, history: [{ at: 'a', f: 'dueAt', to: 'b' }] } as Task).history).toHaveLength(1);
  });
});
