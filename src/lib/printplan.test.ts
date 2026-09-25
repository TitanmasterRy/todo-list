import { describe, expect, it } from 'vitest';
import { weekPlan } from './printplan';
import type { Task } from './types';

const t = (id: string, extra: Partial<Task>): Task => ({
  id,
  title: id,
  tags: [],
  priority: 'normal',
  subtasks: [],
  createdAt: '',
  updatedAt: '',
  order: 0,
  deferredCount: 0,
  ...extra,
});

describe('weekPlan', () => {
  it('buckets tasks into the seven days', () => {
    const days = weekPlan(
      [
        t('mon', { dueAt: '2026-10-05' }),
        t('wed', { dueAt: '2026-10-07' }),
        t('pinned', { pinnedDay: '2026-10-07' }),
        t('next week', { dueAt: '2026-10-12' }),
        t('archived', { dueAt: '2026-10-05', archived: true }),
      ],
      '2026-10-05',
    );
    expect(days.map((d) => d.key)).toEqual(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11']);
    expect(days[0].tasks.map((x) => x.id)).toEqual(['mon']);
    expect(days[2].tasks.map((x) => x.id)).toEqual(['wed', 'pinned']);
    expect(days.flatMap((d) => d.tasks).length).toBe(3);
  });
});
