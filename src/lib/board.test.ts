import { describe, expect, it } from 'vitest';
import { boardColumns, columnOf, neighbor } from './board';
import type { Task } from './types';

const t = (id: string, extra: Partial<Task> = {}): Task => ({
  id,
  title: id,
  tags: [],
  priority: 'normal',
  subtasks: [],
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
  order: 0,
  deferredCount: 0,
  ...extra,
});

describe('board', () => {
  it('puts tasks in columns', () => {
    expect(columnOf(t('a'))).toBe('todo');
    expect(columnOf(t('b', { doing: true }))).toBe('doing');
    expect(columnOf(t('c', { timerStartedAt: '2026-10-05T10:00:00Z' }))).toBe('doing');
    expect(columnOf(t('d', { doing: true, completedAt: '2026-10-05T10:00:00Z' }))).toBe('done');
  });
  it('sorts by due date and drops old completions and archived tasks', () => {
    const cols = boardColumns(
      [
        t('late', { dueAt: '2026-10-20' }),
        t('soon', { dueAt: '2026-10-06' }),
        t('nodate'),
        t('recent', { completedAt: '2026-10-04T10:00:00Z' }),
        t('newest', { completedAt: '2026-10-05T10:00:00Z' }),
        t('old', { completedAt: '2026-09-01T10:00:00Z' }),
        t('arch', { completedAt: '2026-10-05T09:00:00Z', archived: true }),
      ],
      '2026-10-05',
    );
    expect(cols.todo.map((x) => x.id)).toEqual(['soon', 'late', 'nodate']);
    expect(cols.done.map((x) => x.id)).toEqual(['newest', 'recent']);
  });
  it('finds neighbouring columns', () => {
    expect(neighbor('todo', 1)).toBe('doing');
    expect(neighbor('todo', -1)).toBeUndefined();
    expect(neighbor('done', -1)).toBe('doing');
  });
});
