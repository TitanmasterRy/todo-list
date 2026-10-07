import 'fake-indexeddb/auto';
import { beforeAll, describe, expect, it } from 'vitest';
import { externalTaskId } from './id';
import { addDaysKey } from './dates';
import type { ExternalAssignment } from './schoology';
import type { Task } from './types';

// A real (in-memory) localStorage, installed before the modules read it.
const mem = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) },
});

let store: typeof import('./store.svelte').store;
let db: typeof import('./storage');
let applySyncDiff: typeof import('./syncImport.svelte').applySyncDiff;
beforeAll(async () => {
  store = (await import('./store.svelte')).store;
  db = await import('./storage');
  applySyncDiff = (await import('./syncImport.svelte')).applySyncDiff;
});

const assignment = (externalId: string, dueAt: string, title = externalId): ExternalAssignment => ({ externalId, title, dueAt }) as ExternalAssignment;
const importFeed = (list: ExternalAssignment[]) => applySyncDiff(store, { create: list, update: [], unchanged: 0 }, () => undefined, undefined, 'canvas');

describe('imported assignments', () => {
  it('get the same id on every device', () => {
    expect(externalTaskId('canvas:42')).toBe(externalTaskId('canvas:42'));
    expect(externalTaskId('canvas:42')).not.toBe(externalTaskId('canvas:43'));
    importFeed([assignment('canvas:42', addDaysKey(store.today, 3))]);
    expect(store.taskById(externalTaskId('canvas:42'))?.title).toBe('canvas:42');
  });

  it('long past due ones arrive done, without XP, and reopening them pays nothing', () => {
    const xp = store.stats.xp;
    importFeed([assignment('canvas:old', addDaysKey(store.today, -60)), assignment('canvas:recent', addDaysKey(store.today, -3))]);
    const old = store.taskById(externalTaskId('canvas:old'))!;
    expect(old.completedAt).toBeDefined();
    expect(old.rewardedAt).toBe(old.completedAt);
    expect(store.taskById(externalTaskId('canvas:recent'))!.completedAt).toBeUndefined();
    expect(store.todayTasks.some((t) => t.id === old.id)).toBe(false);
    store.uncompleteTask(old.id);
    store.completeTask(old.id);
    expect(store.stats.xp).toBe(xp);
  });

  it("an assignment deleted on any device isn't imported again", () => {
    const id = externalTaskId('canvas:gone');
    store.bury('task', [id]);
    expect(importFeed([assignment('canvas:gone', addDaysKey(store.today, 2))]).created).toBe(0);
    expect(store.settings.schoologyIgnored).toContain('canvas:gone');
  });

  it('copies made on two devices before they synced are folded into one at startup', async () => {
    const base: Omit<Task, 'id' | 'createdAt' | 'updatedAt'> = {
      tags: [],
      priority: 'normal',
      subtasks: [],
      order: 0,
      deferredCount: 0,
      externalId: 'schoology:7',
      title: 'Essay',
    };
    const done: Task = { ...base, id: 't_a', createdAt: '2026-09-02T00:00:00.000Z', updatedAt: '2026-09-03T00:00:00.000Z', completedAt: '2026-09-03T00:00:00.000Z' };
    const open: Task = { ...base, id: 't_b', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z', dueAt: '2026-09-04' };
    await db.putTasks([done, open]);
    await store.init();
    expect(store.taskById('t_a')?.completedAt).toBeDefined();
    expect(store.taskById('t_b')).toBeUndefined();
    expect(store.tombstones.some((t) => t.id === 't_b')).toBe(true);
    expect((await db.getAllTasks()).some((t) => t.id === 't_b')).toBe(false);
  });
});
