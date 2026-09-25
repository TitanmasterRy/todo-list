// The service-worker add-on is plain JS in public/; load it in a sandbox with a fake worker scope.
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

function load() {
  const listeners: Record<string, unknown> = {};
  const mod = { exports: {} as { todayCounts: (tasks: unknown[], now: Date) => { due: number; overdue: number; titles: string[] }; dayKey: (d: Date) => string } };
  runInNewContext(readFileSync(new URL('../../public/sw-extra.js', import.meta.url), 'utf8'), {
    self: { addEventListener: (t: string, f: unknown) => (listeners[t] = f) },
    module: mod,
    Date,
  });
  return { ...mod.exports, listeners };
}

describe('sw-extra', () => {
  it('listens for notification clicks and periodic sync', () => {
    const { listeners } = load();
    expect(Object.keys(listeners).sort()).toEqual(['notificationclick', 'periodicsync']);
  });
  it('counts open tasks due today and overdue, like the Today view', () => {
    const { todayCounts } = load();
    const now = new Date(2026, 9, 5, 9, 0);
    const c = todayCounts(
      [
        { title: 'Due today', dueAt: '2026-10-05' },
        { title: 'Timed today', dueAt: new Date(2026, 9, 5, 15, 0).toISOString() },
        { title: 'Overdue', dueAt: '2026-10-01' },
        { title: 'Done', dueAt: '2026-10-05', completedAt: '2026-10-05T08:00:00Z' },
        { title: 'Pinned', pinnedDay: '2026-10-05' },
        { title: 'Later', dueAt: '2026-10-09' },
        { title: 'No date' },
      ],
      now,
    );
    expect(c).toEqual({ due: 3, overdue: 1, titles: ['Due today', 'Timed today', 'Pinned'] });
  });
});
