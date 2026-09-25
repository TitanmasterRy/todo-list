import { describe, expect, it } from 'vitest';
import { mergeTask, stampChanges } from './fieldmerge';
import type { Task } from './types';

const base: Task = {
  id: 't1',
  title: 'Essay',
  tags: [],
  priority: 'normal',
  subtasks: [],
  createdAt: '2026-10-01T10:00:00.000Z',
  updatedAt: '2026-10-01T10:00:00.000Z',
  order: 1,
  deferredCount: 0,
  fieldBase: '2026-10-01T10:00:00.000Z',
};
const edit = (t: Task, patch: Partial<Task>, at: string) => stampChanges(t, { ...t, ...patch, updatedAt: at }, at);

describe('field-level merge', () => {
  it('stamps only the fields that changed', () => {
    const t = edit(base, { title: 'Essay draft', dueAt: '2026-10-09' }, '2026-10-02T09:00:00.000Z');
    expect(t.fieldAt).toEqual({ title: '2026-10-02T09:00:00.000Z', dueAt: '2026-10-02T09:00:00.000Z' });
    expect(edit(t, {}, '2026-10-02T09:05:00.000Z').fieldAt).toEqual(t.fieldAt);
    expect(stampChanges(undefined, { ...base, fieldBase: undefined }).fieldBase).toBe(base.createdAt);
  });

  it('keeps both devices’ edits to different fields', () => {
    const phone = edit(base, { dueAt: '2026-10-09' }, '2026-10-02T09:00:00.000Z');
    const laptop = edit(base, { notes: 'Use three sources', priority: 'high' }, '2026-10-02T12:00:00.000Z');
    const a = mergeTask(phone, laptop);
    const b = mergeTask(laptop, phone);
    for (const { task, conflict } of [a, b]) {
      expect(conflict).toBe(false);
      expect(task).toMatchObject({ dueAt: '2026-10-09', notes: 'Use three sources', priority: 'high', updatedAt: '2026-10-02T12:00:00.000Z' });
    }
    expect(a.task).toEqual(b.task);
  });

  it('newest change wins for the same field, and removals carry over', () => {
    const one = edit(base, { title: 'Old title', notes: 'x' }, '2026-10-02T09:00:00.000Z');
    const two = edit(base, { title: 'New title' }, '2026-10-03T09:00:00.000Z');
    expect(mergeTask(one, two).task.title).toBe('New title');
    const cleared = edit(one, { notes: undefined }, '2026-10-04T09:00:00.000Z');
    const m = mergeTask(two, cleared).task;
    expect(m.notes).toBeUndefined();
    expect(m.title).toBe('New title');
  });

  it('completion on one device and a rename on another both survive', () => {
    const done = edit(base, { completedAt: '2026-10-02T15:00:00.000Z' }, '2026-10-02T15:00:00.000Z');
    const renamed = edit(base, { title: 'Essay (final)' }, '2026-10-02T16:00:00.000Z');
    expect(mergeTask(done, renamed).task).toMatchObject({ completedAt: '2026-10-02T15:00:00.000Z', title: 'Essay (final)' });
  });

  it('flags a real conflict: same field, different values, same second', () => {
    const a = edit(base, { title: 'A' }, '2026-10-02T09:00:00.100Z');
    const b = edit(base, { title: 'B' }, '2026-10-02T09:00:00.900Z');
    const m = mergeTask(a, b);
    expect(m.conflict).toBe(true);
    expect(m.task.title).toBe('B');
  });

  it('falls back to whole-task last-write-wins for tasks from older versions', () => {
    const old = { ...base, fieldBase: undefined, title: 'Old', updatedAt: '2026-10-02T09:00:00.000Z' };
    const newer = { ...base, fieldBase: undefined, notes: 'n', updatedAt: '2026-10-03T09:00:00.000Z' };
    expect(mergeTask(old, newer).task).toBe(newer);
  });

  it('a legacy task starts tracking on its next save', () => {
    const legacy = { ...base, fieldBase: undefined, updatedAt: '2026-10-02T09:00:00.000Z' };
    const t = stampChanges(legacy, { ...legacy, title: 'Renamed', updatedAt: '2026-10-05T09:00:00.000Z' }, '2026-10-05T09:00:00.000Z');
    expect(t.fieldBase).toBe('2026-10-02T09:00:00.000Z');
    expect(t.fieldAt).toEqual({ title: '2026-10-05T09:00:00.000Z' });
  });
});
