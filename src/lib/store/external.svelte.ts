// Store methods: Bulk imports: CSV import, Schoology sync, pomodoro stats.
// Attached to Store.prototype in store.svelte.ts, so they're called as store.method(...) like the rest.
import * as db from '../storage';
import type { Priority, Stats, Task } from '../types';
import { uid } from '../id';
import { isoNow } from '../dates';
import { evaluateBadges } from '../gamification';
import type { ExternalAssignment, SyncDiff } from '../schoology';
import { undo } from '../undo.svelte';
import { emit } from '../events';
import type { Store } from '../store.svelte';
import { t as tr } from '../i18n/index.svelte';

export const externalMethods = {
  /** Add imported tasks (CSV import) in one undoable step. Course names are matched or created. Done tasks arrive completed without XP. */
  importTasks(
    this: Store,
    items: {
      title: string;
      notes?: string;
      dueAt?: string;
      priority: Priority;
      course?: string;
      tags: string[];
      type?: Task['type'];
      estimateMin?: number;
      done: boolean;
      subtasks: string[];
    }[],
  ): Task[] {
    const now = isoNow();
    let order = this.nextOrder();
    const courseIds = new Map<string, string>();
    const courseFor = (name?: string): string | undefined => {
      if (!name) return undefined;
      const key = name.trim().toLowerCase();
      if (!courseIds.has(key)) courseIds.set(key, (this.findCourseByName(name) ?? this.addCourse({ name: name.trim().slice(0, 40), color: '#6c5ce7' })).id);
      return courseIds.get(key);
    };
    const created: Task[] = items.map((i) => {
      const id = uid('t');
      return {
        id,
        title: i.title,
        notes: i.notes,
        courseId: courseFor(i.course),
        tags: i.tags,
        priority: i.priority,
        dueAt: i.dueAt,
        estimateMin: i.estimateMin,
        type: i.type,
        subtasks: i.subtasks.map((s, k) => ({ id: `${id}_s${k}`, title: s, done: i.done })),
        createdAt: now,
        updatedAt: now,
        completedAt: i.done ? now : undefined,
        order: order++,
        deferredCount: 0,
      };
    });
    if (!created.length) return [];
    this.tasks = [...this.tasks, ...created];
    this.persistTasks(created);
    undo.push(
      {
        label: tr('toast.imported', { count: created.length }),
        undo: () => {
          const ids = new Set(created.map((t) => t.id));
          this.tasks = this.tasks.filter((t) => !ids.has(t.id));
          db.deleteTasks([...ids]).catch(() => {});
          this.bury('task', [...ids]);
        },
      },
      { timeout: 8000 },
    );
    return created;
  },

  /** Duplicate a task (same fields, not completed, placed right after the original). */
  /** Apply a sync diff: create new assignment tasks, update changed ones. Returns counts. */
  applySyncDiff(
    this: Store,
    diff: SyncDiff,
    resolveCourse: (a: ExternalAssignment) => string | undefined,
    describe?: (a: ExternalAssignment) => Partial<Task>,
  ): { created: number; updated: number } {
    const now = isoNow();
    const created: Task[] = [];
    let order = this.nextOrder();
    for (const a of diff.create) {
      const id = uid('t');
      const extra = describe?.(a) ?? {};
      const task: Task = {
        id,
        title: a.title,
        notes: a.notes || extra.notes,
        courseId: resolveCourse(a),
        tags: extra.tags ?? [],
        priority: a.type === 'exam' ? 'high' : 'normal',
        dueAt: a.dueAt,
        estimateMin: extra.estimateMin,
        type: a.type,
        subtasks: (extra.subtasks ?? []).map((s, i) => ({ id: `${id}_s${i}`, title: s.title, done: false })),
        createdAt: now,
        updatedAt: now,
        order: order++,
        deferredCount: 0,
        source: 'schoology',
        externalId: a.externalId,
        url: a.url,
        syncedAt: now,
        autoDescribed: !!extra.notes,
      };
      created.push(task);
    }
    const byExt = new Map(this.tasks.filter((t) => t.externalId).map((t) => [t.externalId!, t]));
    const updated: Task[] = [];
    for (const u of diff.update) {
      const t = byExt.get(u.externalId);
      if (!t) continue;
      updated.push({ ...t, ...u.patch, syncedAt: now, updatedAt: now });
    }
    const map = new Map(updated.map((t) => [t.id, t]));
    this.tasks = [...this.tasks.map((t) => map.get(t.id) ?? t), ...created];
    const all = [...created, ...updated];
    if (all.length) this.persistTasks(all);
    if (created.length || updated.length) {
      const stats = structuredClone($state.snapshot(this.stats)) as Stats;
      stats.syncedCount = (stats.syncedCount ?? 0) + created.length;
      const newBadges = evaluateBadges(stats, { openTasksRemaining: this.openTasks.length, today: this.today });
      stats.badges = [...stats.badges, ...newBadges];
      this.stats = stats;
      this.persistStats();
      for (const b of newBadges) emit('badge', { id: b });
    }
    emit('synced', { created: created.length, updated: updated.length });
    return { created: created.length, updated: updated.length };
  },

  // ---------- pomodoro ----------
  recordPomodoro(this: Store): void {
    const stats = structuredClone($state.snapshot(this.stats)) as Stats;
    stats.pomodorosByDay[this.today] = (stats.pomodorosByDay[this.today] ?? 0) + 1;
    const newBadges = evaluateBadges(stats, { openTasksRemaining: this.openTasks.length, today: this.today });
    stats.badges = [...stats.badges, ...newBadges];
    this.stats = stats;
    this.persistStats();
    emit('pomodoroDone', { day: this.today, count: stats.pomodorosByDay[this.today] });
    for (const b of newBadges) emit('badge', { id: b });
  },
};
