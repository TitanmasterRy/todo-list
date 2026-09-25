import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import * as storage from './storage';
import type { Task } from './types';

function task(id: string, over: Partial<Task> = {}): Task {
  return {
    id,
    title: id,
    tags: [],
    priority: 'normal',
    subtasks: [],
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    order: 0,
    deferredCount: 0,
    ...over,
  };
}

describe('storage', () => {
  beforeEach(() => {
    Object.assign(globalThis, { indexedDB: new IDBFactory() });
    storage.resetDBCache();
  });

  it('round-trips tasks', async () => {
    await storage.putTask(task('a'));
    await storage.putTasks([task('b'), task('c')]);
    const all = await storage.getAllTasks();
    expect(all.map((t) => t.id).sort()).toEqual(['a', 'b', 'c']);
    await storage.deleteTask('a');
    await storage.deleteTasks(['b']);
    expect((await storage.getAllTasks()).map((t) => t.id)).toEqual(['c']);
  });

  it('stores stats with defaults', async () => {
    const s = await storage.getStats();
    expect(s.level).toBe(1);
    await storage.putStats({ ...s, xp: 42 });
    expect((await storage.getStats()).xp).toBe(42);
  });

  it('replaces everything atomically', async () => {
    await storage.putTask(task('old'));
    await storage.replaceAll({
      tasks: [task('new')],
      courses: [{ id: 'c', name: 'Calc', color: '#fff', archived: false }],
      templates: [],
      stats: await storage.getStats(),
      dayNotes: [{ date: '2026-09-14', note: 'good' }],
    });
    expect((await storage.getAllTasks()).map((t) => t.id)).toEqual(['new']);
    expect((await storage.getAllCourses()).length).toBe(1);
    expect((await storage.getAllDayNotes())[0].note).toBe('good');
  });

  it('clears all data', async () => {
    await storage.putTask(task('a'));
    await storage.clearAllData();
    expect(await storage.getAllTasks()).toEqual([]);
  });
});
