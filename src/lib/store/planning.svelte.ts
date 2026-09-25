// Store methods: Rescheduling, recurrence skips, time tracking, pins and the frog.
// Attached to Store.prototype in store.svelte.ts, so they're called as store.method(...) like the rest.
import type { Task } from '../types';
import { uid } from '../id';
import { addDaysKey, dueKey, isDateOnly, isoNow, nextWeekKey, thisWeekendKey } from '../dates';
import { nextOccurrenceKey } from '../recurrence';
import { undo } from '../undo.svelte';
import { toasts } from '../toast.svelte';
import { playSound } from '../sounds';
import type { Store } from '../store.svelte';

export const planningMethods = {
  /** Snooze: reschedule to a day, keeping the time of day if there was one. */
  snoozeTask(this: Store, id: string, toKey: string, label = 'Snoozed'): void {
    const task = this.tasks.find((t) => t.id === id);
    if (!task) return;
    const snapshot = structuredClone($state.snapshot(task)) as Task;
    let dueAt: string = toKey;
    if (task.dueAt && !isDateOnly(task.dueAt)) {
      const d = new Date(task.dueAt);
      const n = new Date(toKey + 'T00:00:00');
      n.setHours(d.getHours(), d.getMinutes(), 0, 0);
      dueAt = n.toISOString();
    }
    const next: Task = { ...task, dueAt, deferredCount: task.deferredCount + 1, updatedAt: isoNow(), pinnedDay: undefined };
    this.tasks = this.tasks.map((t) => (t.id === id ? next : t));
    this.persistTask(next);
    undo.push({ label: `${label} “${task.title}”`, undo: () => this.restoreTaskInternal(snapshot) });
  },

  snoozeTomorrow(this: Store, id: string): void {
    this.snoozeTask(id, addDaysKey(this.today, 1), 'Snoozed to tomorrow');
  },
  snoozeWeekend(this: Store, id: string): void {
    this.snoozeTask(id, thisWeekendKey(this.now), 'Snoozed to the weekend');
  },
  snoozeNextWeek(this: Store, id: string): void {
    this.snoozeTask(id, nextWeekKey(this.now, this.settings.weekStart), 'Snoozed to next week');
  },

  rollOverdueToToday(this: Store): void {
    const overdue = this.overdueTasks;
    if (!overdue.length) return;
    const snaps = overdue.map((t) => structuredClone($state.snapshot(t)) as Task);
    const now = isoNow();
    const updated = overdue.map((t) => {
      let dueAt: string = this.today;
      if (t.dueAt && !isDateOnly(t.dueAt)) {
        const d = new Date(t.dueAt);
        const n = new Date();
        n.setHours(d.getHours(), d.getMinutes(), 0, 0);
        dueAt = n.toISOString();
      }
      return { ...t, dueAt, deferredCount: t.deferredCount + 1, updatedAt: now };
    });
    const map = new Map(updated.map((t) => [t.id, t]));
    this.tasks = this.tasks.map((t) => map.get(t.id) ?? t);
    this.persistTasks(updated);
    undo.push({
      label: `Rolled ${updated.length} overdue to today`,
      undo: () => {
        const now = isoNow();
        const back = snaps.map((t) => ({ ...t, updatedAt: now }));
        const m = new Map(back.map((t) => [t.id, t]));
        this.tasks = this.tasks.map((t) => m.get(t.id) ?? t);
        this.persistTasks(back);
      },
    });
  },

  toggleSubtask(this: Store, taskId: string, subId: string): void {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) return;
    const subtasks = task.subtasks.map((s) => (s.id === subId ? { ...s, done: !s.done } : s));
    this.updateTask(taskId, { subtasks });
    playSound('tick');
  },

  addSubtask(this: Store, taskId: string, title: string): void {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task || !title.trim()) return;
    this.updateTask(taskId, { subtasks: [...task.subtasks, { id: uid('s'), title: title.trim(), done: false }] });
  },

  removeSubtask(this: Store, taskId: string, subId: string): void {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) return;
    this.updateTask(taskId, { subtasks: task.subtasks.filter((s) => s.id !== subId) }, { undoable: true, label: 'Removed subtask' });
  },

  /** Reorder: assign sequential `order` to the given ids (in new order). Other tasks keep theirs. */
  reorder(this: Store, orderedIds: string[]): void {
    const set = new Set(orderedIds);
    const involved = this.tasks.filter((t) => set.has(t.id));
    if (involved.length < 2) return;
    const orders = involved.map((t) => t.order).sort((a, b) => a - b);
    const now = isoNow();
    const byId = new Map(this.tasks.map((t) => [t.id, t]));
    const updated: Task[] = [];
    orderedIds.forEach((id, i) => {
      const t = byId.get(id);
      if (t) updated.push({ ...t, order: orders[i] ?? i, updatedAt: now });
    });
    const map = new Map(updated.map((t) => [t.id, t]));
    this.tasks = this.tasks.map((t) => map.get(t.id) ?? t);
    this.persistTasks(updated);
  },

  /** Move a task to a day (drag between days in Upcoming, drag into Today). */
  moveTaskToDay(this: Store, id: string, toKey: string | null): void {
    const task = this.tasks.find((t) => t.id === id);
    if (!task) return;
    if (toKey === null) {
      this.updateTask(id, { dueAt: undefined, pinnedDay: undefined }, { undoable: true, label: `Removed date from “${task.title}”` });
      return;
    }
    if (task.dueAt && dueKey(task.dueAt) === toKey) return;
    let dueAt: string = toKey;
    if (task.dueAt && !isDateOnly(task.dueAt)) {
      const d = new Date(task.dueAt);
      const n = new Date(toKey + 'T00:00:00');
      n.setHours(d.getHours(), d.getMinutes(), 0, 0);
      dueAt = n.toISOString();
    }
    this.updateTask(id, { dueAt, pinnedDay: undefined }, { undoable: true, label: `Rescheduled “${task.title}”` });
  },

  // ---------- recurrence ----------
  /** Skip the current occurrence of a repeating task: move it to the next date without completing it. */
  skipOccurrence(this: Store, id: string): void {
    const task = this.tasks.find((t) => t.id === id);
    if (!task?.recurrence) return;
    const from = task.dueAt ? dueKey(task.dueAt) : this.today;
    const next = nextOccurrenceKey(task.recurrence, from, from);
    if (!next) {
      toasts.push({ message: 'This was the last one in the series', kind: 'info' });
      return;
    }
    let dueAt: string = next;
    if (task.dueAt && !isDateOnly(task.dueAt)) {
      const d = new Date(task.dueAt);
      const n = new Date(next + 'T00:00:00');
      n.setHours(d.getHours(), d.getMinutes(), 0, 0);
      dueAt = n.toISOString();
    }
    this.updateTask(
      id,
      { dueAt, pinnedDay: undefined, subtasks: task.subtasks.map((st) => ({ ...st, done: false })) },
      { undoable: true, label: `Skipped “${task.title}” to ${next}` },
    );
  },

  startTimer(this: Store, id: string): void {
    const running = this.runningTimer;
    if (running && running.id !== id) this.stopTimer(running.id);
    const t = this.tasks.find((x) => x.id === id);
    if (!t || t.timerStartedAt) return;
    this.updateTask(id, { timerStartedAt: isoNow() });
  },

  /** Stop a task's timer and add the elapsed minutes. Returns the minutes added. */
  stopTimer(this: Store, id: string): number {
    const t = this.tasks.find((x) => x.id === id);
    if (!t?.timerStartedAt) return 0;
    const min = Math.round((Date.now() - new Date(t.timerStartedAt).getTime()) / 60_000);
    this.updateTask(id, { timerStartedAt: undefined, timeSpentMin: (t.timeSpentMin ?? 0) + Math.max(0, min) });
    return min;
  },

  addTimeSpent(this: Store, id: string, minutes: number): void {
    const t = this.tasks.find((x) => x.id === id);
    if (!t || minutes <= 0) return;
    this.updateTask(id, { timeSpentMin: (t.timeSpentMin ?? 0) + Math.round(minutes) });
  },

  /** Move a task earlier or later by whole days (keyboard [ and ]). Undated tasks start from today. */
  shiftTaskDays(this: Store, id: string, delta: number): void {
    const task = this.tasks.find((t) => t.id === id);
    if (!task) return;
    const from = task.dueAt ? dueKey(task.dueAt) : this.today;
    this.moveTaskToDay(id, addDaysKey(from, delta));
  },

  pinToToday(this: Store, id: string): void {
    const task = this.tasks.find((t) => t.id === id);
    if (!task) return;
    this.updateTask(id, { pinnedDay: this.today }, { undoable: true, label: `Added “${task.title}” to Today` });
  },

  unpinToday(this: Store, id: string): void {
    const task = this.tasks.find((t) => t.id === id);
    if (!task) return;
    this.updateTask(id, { pinnedDay: undefined }, { undoable: true, label: `Removed “${task.title}” from Today` });
  },

  setFrog(this: Store, id: string | null): void {
    const prevFrog = this.frogTask;
    if (prevFrog && prevFrog.id !== id) this.updateTask(prevFrog.id, { frog: false, frogDate: undefined });
    if (id) this.updateTask(id, { frog: true, frogDate: this.today });
  },

  // ---------- board ----------
  /** Move a task between board columns (to Done completes it; out of Done reopens it). */
  moveToColumn(this: Store, id: string, col: 'todo' | 'doing' | 'done'): void {
    const task = this.taskById(id);
    if (!task) return;
    if (col === 'done') {
      if (!task.completedAt) this.completeTask(id);
      return;
    }
    if (task.completedAt) this.uncompleteTask(id);
    if (col === 'todo' && task.timerStartedAt) this.stopTimer(id);
    this.updateTask(id, { doing: col === 'doing' ? true : undefined });
  },

  // ---------- work-back plans ----------
  /**
   * Add the steps of a plan for a bigger task (milestones or exam study sessions) with one undo.
   * With `chain`, each step waits on the one before and the big task waits on the last step.
   */
  addPlan(this: Store, parentId: string, steps: { title: string; dateKey: string; estimateMin?: number; deckId?: string }[], opts: { chain?: boolean; label: string }): Task[] {
    const parent = this.taskById(parentId);
    if (!parent || !steps.length) return [];
    const before = structuredClone($state.snapshot(parent)) as Task;
    const created: Task[] = [];
    for (const s of steps) {
      const prev = created[created.length - 1];
      created.push(
        this.addTask(
          {
            title: s.title,
            dueAt: s.dateKey,
            estimateMin: s.estimateMin,
            courseId: parent.courseId,
            priority: parent.priority === 'urgent' ? 'high' : parent.priority,
            tags: [...parent.tags],
            parentId,
            deckId: s.deckId,
            blockedBy: opts.chain && prev ? [prev.id] : undefined,
          },
          { undoable: false, describe: false },
        ),
      );
    }
    const last = created[created.length - 1];
    if (opts.chain) this.updateTask(parentId, { blockedBy: [...new Set([...(before.blockedBy ?? []), last.id])] });
    undo.push(
      {
        label: opts.label,
        undo: () => {
          for (const t of created) this.removeTaskInternal(t.id);
          if (opts.chain) this.restoreTaskInternal(before);
        },
      },
      { timeout: 6000 },
    );
    return created;
  },
};
