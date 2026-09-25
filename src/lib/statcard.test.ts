import { describe, expect, it } from 'vitest';
import { weekSummary } from './statcard';
import { DEFAULT_STATS, type Task } from './types';

describe('weekly stats card', () => {
  it('sums the last 7 days and ranks courses without titles', () => {
    const stats = {
      ...structuredClone(DEFAULT_STATS),
      level: 4,
      completionsByDay: { '2026-10-05': 3, '2026-10-04': 1, '2026-09-28': 9 },
      xpByDay: { '2026-10-05': 120, '2026-10-01': 30 },
    };
    const t = (id: string, courseId: string, completedAt: string): Task => ({
      id,
      title: `secret ${id}`,
      tags: [],
      priority: 'normal',
      subtasks: [],
      createdAt: '',
      updatedAt: '',
      order: 0,
      deferredCount: 0,
      courseId,
      completedAt,
    });
    const courses = [
      { id: 'c1', name: 'Chem', color: '#000', archived: false },
      { id: 'c2', name: 'Art', color: '#000', archived: false },
    ];
    const s = weekSummary(
      stats,
      [t('a', 'c1', '2026-10-05T10:00:00'), t('b', 'c1', '2026-10-04T10:00:00'), t('c', 'c2', '2026-10-05T11:00:00'), t('d', 'c2', '2026-09-20T10:00:00')],
      courses,
      '2026-10-05',
      6,
      3,
    );
    expect(s.from).toBe('2026-09-29');
    expect(s.done).toBe(4);
    expect(s.xp).toBe(150);
    expect(s.ringDays).toBe(1);
    expect(s.days.map((d) => d.count)).toEqual([0, 0, 0, 0, 0, 1, 3]);
    expect(s.topCourses).toEqual([
      { name: 'Chem', emoji: undefined, count: 2 },
      { name: 'Art', emoji: undefined, count: 1 },
    ]);
    expect(JSON.stringify(s)).not.toContain('secret');
  });
});
