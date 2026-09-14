import type { Course, Task } from './types';
import { addDaysKey, combineDateTime, todayKey } from './dates';

/** Demo dataset for first run. All ids are prefixed `demo_` so "Clear demo data" can remove them. */
export function seedDemoData(now: Date = new Date()): { courses: Course[]; tasks: Task[] } {
  const today = todayKey(now);
  const iso = now.toISOString();
  const courses: Course[] = [
    { id: 'demo_c1', name: 'Calc II', color: '#3b82f6', emoji: '📐', archived: false },
    { id: 'demo_c2', name: 'Chem', color: '#10b981', emoji: '🧪', archived: false },
    { id: 'demo_c3', name: 'History', color: '#f59e0b', emoji: '🏛️', archived: false },
  ];
  const mk = (i: number, t: Partial<Task> & { title: string }): Task => ({
    id: `demo_t${i}`,
    tags: [],
    priority: 'normal',
    subtasks: [],
    createdAt: iso,
    updatedAt: iso,
    order: i,
    deferredCount: 0,
    ...t,
  });
  const tasks: Task[] = [
    mk(1, {
      title: 'Problem set 4: integrals by parts',
      courseId: 'demo_c1',
      priority: 'high',
      dueAt: today,
      estimateMin: 90,
      type: 'homework',
      subtasks: [
        { id: 'demo_t1_s1', title: 'Problems 1–10', done: true },
        { id: 'demo_t1_s2', title: 'Problems 11–20', done: false },
        { id: 'demo_t1_s3', title: 'Check answers', done: false },
      ],
    }),
    mk(2, { title: 'Read chapter 6 (kinetics)', courseId: 'demo_c2', dueAt: today, estimateMin: 45, type: 'reading', tags: ['reading'] }),
    mk(3, { title: 'Email TA about lab report extension', courseId: 'demo_c2', priority: 'low', dueAt: addDaysKey(today, -1), estimateMin: 10 }),
    mk(4, {
      title: 'Quiz: French Revolution',
      courseId: 'demo_c3',
      priority: 'urgent',
      dueAt: combineDateTime(addDaysKey(today, 2), 10, 0),
      estimateMin: 60,
      type: 'quiz',
      weight: 10,
    }),
    mk(5, { title: 'Draft essay outline', courseId: 'demo_c3', dueAt: addDaysKey(today, 4), estimateMin: 60, type: 'project', tags: ['essay'] }),
    mk(6, { title: 'Midterm exam', courseId: 'demo_c1', priority: 'urgent', dueAt: addDaysKey(today, 9), estimateMin: 180, type: 'exam', weight: 25 }),
    mk(7, { title: 'Review flashcards', courseId: 'demo_c2', priority: 'low', dueAt: addDaysKey(today, 1), estimateMin: 20, recurrence: { kind: 'weekdays' } }),
    mk(8, { title: 'Buy graph paper', tags: ['errand'], priority: 'low' }),
    mk(9, { title: 'Try quick add: type "Read ch 4 tomorrow 8pm #calc !high ~45m"', tags: ['tip'] }),
  ];
  return { courses, tasks };
}
