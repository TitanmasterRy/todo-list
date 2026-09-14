import { describe, expect, it } from 'vitest';
import { mergeBundles, parseBundle } from './backup';
import type { ExportBundle, Task } from './types';
import { DEFAULT_STATS } from './types';

function task(id: string, updatedAt: string, title = id): Task {
  return { id, title, tags: [], priority: 'normal', subtasks: [], createdAt: updatedAt, updatedAt, order: 0, deferredCount: 0 };
}
function bundle(tasks: Task[], xp = 0): ExportBundle {
  return { version: 1, exportedAt: '', tasks, courses: [], templates: [], stats: { ...structuredClone(DEFAULT_STATS), xp }, dayNotes: [] };
}

describe('parseBundle', () => {
  it('rejects garbage', () => {
    expect(() => parseBundle('nope')).toThrow();
    expect(() => parseBundle({})).toThrow();
  });
  it('normalizes partial tasks', () => {
    const b = parseBundle({ tasks: [{ id: 'a', title: 'A' }], courses: [] });
    expect(b.tasks[0].priority).toBe('normal');
    expect(b.tasks[0].subtasks).toEqual([]);
    expect(b.stats.level).toBe(1);
  });
});

describe('mergeBundles', () => {
  it('last write wins per task', () => {
    const local = bundle([task('a', '2026-09-14T10:00:00.000Z', 'old'), task('b', '2026-09-14T10:00:00.000Z')]);
    const remote = bundle([task('a', '2026-09-14T11:00:00.000Z', 'new'), task('c', '2026-09-14T10:00:00.000Z')]);
    const { merged, conflicts } = mergeBundles(local, remote);
    expect(merged.tasks.find((t) => t.id === 'a')?.title).toBe('new');
    expect(merged.tasks.map((t) => t.id).sort()).toEqual(['a', 'b', 'c']);
    expect(conflicts).toEqual([]);
  });
  it('flags same-second clashes', () => {
    const local = bundle([task('a', '2026-09-14T10:00:00.100Z', 'x')]);
    const remote = bundle([task('a', '2026-09-14T10:00:00.900Z', 'y')]);
    const { merged, conflicts } = mergeBundles(local, remote);
    expect(conflicts).toEqual(['a']);
    expect(merged.tasks[0].title).toBe('y');
  });
  it('merges stats by max', () => {
    const local = bundle([], 50);
    local.stats.completionsByDay = { '2026-09-13': 2 };
    const remote = bundle([], 80);
    remote.stats.completionsByDay = { '2026-09-13': 1, '2026-09-14': 3 };
    const { merged } = mergeBundles(local, remote);
    expect(merged.stats.xp).toBe(80);
    expect(merged.stats.completionsByDay).toEqual({ '2026-09-13': 2, '2026-09-14': 3 });
  });
});
