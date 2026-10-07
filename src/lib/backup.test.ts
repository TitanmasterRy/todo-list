import { describe, expect, it } from 'vitest';
import { bundlesDiffer, externalDuplicates, mergeBundles, parseBundle } from './backup';
import { sealEntry } from './ledgerSeal';
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

describe('deletions and wallets across devices', () => {
  const now = new Date('2026-09-20T12:00:00.000Z');
  it('a task deleted on one device stays deleted after sync', () => {
    const local = bundle([]);
    local.tombstones = [{ kind: 'task', id: 'a', deletedAt: '2026-09-15T12:00:00.000Z' }];
    const remote = bundle([task('a', '2026-09-14T10:00:00.000Z'), task('b', '2026-09-14T10:00:00.000Z')]);
    const { merged } = mergeBundles(local, remote, now);
    expect(merged.tasks.map((t) => t.id)).toEqual(['b']);
    expect(merged.tombstones?.map((t) => t.id)).toEqual(['a']);
  });
  it('an edit made after the deletion wins (restored task)', () => {
    const local = bundle([task('a', '2026-09-16T10:00:00.000Z', 'restored')]);
    const remote = bundle([]);
    remote.tombstones = [{ kind: 'task', id: 'a', deletedAt: '2026-09-15T12:00:00.000Z' }];
    const { merged } = mergeBundles(local, remote, now);
    expect(merged.tasks[0]?.title).toBe('restored');
  });
  it('forgets old tombstones and old trash snapshots', () => {
    const local = bundle([]);
    local.tombstones = [
      { kind: 'task', id: 'old', deletedAt: '2026-06-01T00:00:00.000Z' },
      { kind: 'task', id: 'mid', deletedAt: '2026-08-10T00:00:00.000Z', task: task('mid', '2026-08-01T00:00:00.000Z') },
      { kind: 'task', id: 'new', deletedAt: '2026-09-19T00:00:00.000Z', task: task('new', '2026-09-01T00:00:00.000Z') },
    ];
    const { merged } = mergeBundles(local, bundle([]), now);
    const byId = new Map(merged.tombstones!.map((t) => [t.id, t]));
    expect(byId.has('old')).toBe(false);
    expect(byId.get('mid')?.task).toBeUndefined();
    expect(byId.get('new')?.task?.id).toBe('new');
  });
  it('courses merge last-write-wins', () => {
    const local = bundle([]);
    const remote = bundle([]);
    local.courses = [{ id: 'c', name: 'Old name', color: '#000', archived: false, updatedAt: '2026-09-14T10:00:00.000Z' }];
    remote.courses = [{ id: 'c', name: 'New name', color: '#000', archived: false, updatedAt: '2026-09-15T10:00:00.000Z' }];
    expect(mergeBundles(local, remote, now).merged.courses[0].name).toBe('New name');
    expect(mergeBundles(remote, local, now).merged.courses[0].name).toBe('New name');
  });
  it('drops cards of a deleted deck', () => {
    const local = bundle([]);
    local.decks = [];
    local.tombstones = [{ kind: 'deck', id: 'd', deletedAt: '2026-09-15T00:00:00.000Z' }];
    const remote = bundle([]);
    remote.decks = [{ id: 'd', name: 'D', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' }];
    remote.cards = [{ id: 'k', deckId: 'd', front: 'a', back: 'b', box: 1, due: '2026-09-01', reps: 0, lapses: 0, createdAt: '', updatedAt: '2026-09-01T00:00:00.000Z' }];
    const { merged } = mergeBundles(local, remote, now);
    expect(merged.decks).toEqual([]);
    expect(merged.cards).toEqual([]);
  });
  it('ledgers union by id without double counting', () => {
    const e = (id: string, amount: number) => ({ id, at: '2026-09-15T00:00:00.000Z', currency: 'coins' as const, amount, reason: 'task' });
    const local = bundle([]);
    const remote = bundle([]);
    local.ledger = [e('1', 5), e('2', -3)];
    remote.ledger = [e('1', 5), e('3', 7)];
    const { merged } = mergeBundles(local, remote, now);
    expect(merged.ledger!.reduce((a, x) => a + x.amount, 0)).toBe(9);
  });
  it('parseBundle keeps valid tombstones and ledger entries only', () => {
    const b = parseBundle({
      tasks: [],
      courses: [],
      tombstones: [{ kind: 'task', id: 'a', deletedAt: 'x' }, { id: 'bad' }],
      ledger: [
        { id: 'l', at: '', currency: 'coins', amount: 3, reason: 'r' },
        { id: 'n', currency: 'coins', amount: 'NaN' },
      ],
    });
    expect(b.tombstones).toHaveLength(1);
    expect(b.ledger).toHaveLength(1);
  });
});

describe('new task fields survive import and sync', () => {
  it('keeps dependencies, reminders and tracked time', () => {
    const b = parseBundle({
      tasks: [{ id: 'a', title: 'A', blockedBy: ['b', 7], reminders: [{ before: 30 }, { nightBefore: true }], timeSpentMin: 45, timerStartedAt: '2026-09-24T10:00:00.000Z' }],
      courses: [],
    });
    expect(b.tasks[0]).toMatchObject({ blockedBy: ['b'], reminders: [{ before: 30 }, { nightBefore: true }], timeSpentMin: 45, timerStartedAt: '2026-09-24T10:00:00.000Z' });
  });
});

describe('timetable in bundles', () => {
  it('round-trips, merges last-write-wins, and counts as a change', async () => {
    const { emptySchedule } = await import('./timetable');
    const base = parseBundle({ tasks: [], courses: [] });
    const older = { ...emptySchedule(), updatedAt: '2026-10-01T00:00:00Z', rotation: ['A', 'B'] };
    const newer = { ...emptySchedule(), updatedAt: '2026-10-02T00:00:00Z', rotation: ['1', '2', '3'] };
    const withOld = parseBundle({ ...base, schedule: older });
    expect(withOld.schedule?.rotation).toEqual(['A', 'B']);
    expect(parseBundle({ ...base, schedule: { bells: 'nope' } }).schedule).toBeUndefined();
    const { merged } = mergeBundles(withOld, { ...base, schedule: newer });
    expect(merged.schedule?.rotation).toEqual(['1', '2', '3']);
    expect(mergeBundles(base, withOld).merged.schedule?.rotation).toEqual(['A', 'B']);
    expect(bundlesDiffer(base, withOld)).toBe(true);
  });
});

describe('field-level task merge in bundles', () => {
  it('keeps a due-date change from one device and a notes change from another', async () => {
    const { stampChanges } = await import('./fieldmerge');
    const t0 = stampChanges(undefined, {
      id: 't',
      title: 'Lab',
      tags: [],
      priority: 'normal',
      subtasks: [],
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
      order: 1,
      deferredCount: 0,
    });
    const phone = stampChanges(t0, { ...t0, dueAt: '2026-10-09', updatedAt: '2026-10-02T08:00:00.000Z' }, '2026-10-02T08:00:00.000Z');
    const laptop = stampChanges(t0, { ...t0, notes: 'Bring goggles', updatedAt: '2026-10-02T09:00:00.000Z' }, '2026-10-02T09:00:00.000Z');
    const b = (tasks: (typeof t0)[]) => parseBundle({ tasks, courses: [] });
    const { merged, conflicts } = mergeBundles(b([phone]), b([laptop]));
    expect(conflicts).toEqual([]);
    expect(merged.tasks[0]).toMatchObject({ dueAt: '2026-10-09', notes: 'Bring goggles' });
    // and the result survives another round trip
    expect(parseBundle(JSON.parse(JSON.stringify(merged))).tasks[0].fieldAt).toEqual(merged.tasks[0].fieldAt);
  });
});

describe('mergeBundles and the ledger seal', () => {
  it("an edited copy of an entry can't replace this device's sealed one", () => {
    const real = sealEntry({ id: 'l1', at: '2026-10-02T10:00:00.000Z', currency: 'coins', amount: 5, reason: 'task' });
    const { merged } = mergeBundles({ ...bundle([]), ledger: [real] }, { ...bundle([]), ledger: [{ ...real, amount: 5000 }] });
    expect(merged.ledger).toEqual([real]);
  });
});

describe('copies of one imported assignment', () => {
  const ext = (id: string, createdAt: string, extra: Partial<Task> = {}): Task => ({ ...task(id, createdAt), externalId: 'canvas:42', ...extra });

  it('keeps the completed copy, else the oldest; repeating tasks are left alone', () => {
    expect(externalDuplicates([ext('a', '2026-09-02T00:00:00.000Z'), ext('b', '2026-09-01T00:00:00.000Z')])).toEqual(['a']);
    expect(externalDuplicates([ext('a', '2026-09-02T00:00:00.000Z', { completedAt: '2026-09-03T00:00:00.000Z' }), ext('b', '2026-09-01T00:00:00.000Z')])).toEqual(['b']);
    expect(
      externalDuplicates([ext('a', '2026-09-01T00:00:00.000Z', { recurrence: { kind: 'weekly' } }), ext('b', '2026-09-08T00:00:00.000Z', { recurrence: { kind: 'weekly' } })]),
    ).toEqual([]);
    expect(externalDuplicates([task('c', '2026-09-01T00:00:00.000Z'), task('d', '2026-09-01T00:00:00.000Z')])).toEqual([]);
  });

  it('two devices that each imported it end up with the one that was finished, on both', () => {
    const done = ext('a', '2026-09-02T00:00:00.000Z', { completedAt: '2026-09-03T00:00:00.000Z', updatedAt: '2026-09-03T00:00:00.000Z' });
    const open = ext('b', '2026-09-01T00:00:00.000Z');
    const now = new Date('2026-09-04T00:00:00.000Z');
    const one = mergeBundles(bundle([done]), bundle([open]), now).merged;
    const two = mergeBundles(bundle([open]), bundle([done]), now).merged;
    expect(one.tasks.map((t) => t.id)).toEqual(['a']);
    expect(two.tasks.map((t) => t.id)).toEqual(['a']);
    expect(one.tombstones).toContainEqual({ kind: 'task', id: 'b', deletedAt: now.toISOString() });
  });

  it("a fresh import doesn't bring back an assignment deleted on another device", () => {
    const now = new Date('2026-09-10T00:00:00.000Z');
    const reimported = ext('x', '2026-09-09T00:00:00.000Z');
    const deleted = { ...bundle([]), tombstones: [{ kind: 'task' as const, id: 'x', deletedAt: '2026-09-05T00:00:00.000Z' }] };
    expect(mergeBundles(bundle([reimported]), deleted, now).merged.tasks).toEqual([]);
    // but one restored or edited after the deletion stays
    const edited = { ...reimported, updatedAt: '2026-09-09T12:00:00.000Z' };
    expect(mergeBundles(bundle([edited]), deleted, now).merged.tasks.map((t) => t.id)).toEqual(['x']);
  });
});
