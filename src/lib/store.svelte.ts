import * as db from './storage';
import type { Course, DayNote, Priority, Settings, Stats, Subtask, Task, Template } from './types';
import { DEFAULT_STATS } from './types';
import { uid } from './id';
import { addDaysKey, dueKey, isDateOnly, isDueToday, isOverdue, isoNow, nextWeekKey, thisWeekendKey, todayKey, daysAgoKey } from './dates';
import { applyCompletion, effectiveStreak, evaluateBadges, type ComboState } from './gamification';
import { spawnNextInstance } from './recurrence';
import { undo } from './undo.svelte';
import { emit } from './events';
import { toasts } from './toast.svelte';
import { configureSounds, playSound } from './sounds';
import { seedDemoData } from './seed';

export type View = 'today' | 'upcoming' | 'courses' | 'inbox' | 'focus' | 'stats' | 'settings';
export const VIEWS: { id: View; label: string; icon: string; key: string }[] = [
  { id: 'today', label: 'Today', icon: '☀️', key: '1' },
  { id: 'upcoming', label: 'Upcoming', icon: '📅', key: '2' },
  { id: 'courses', label: 'Courses', icon: '📚', key: '3' },
  { id: 'inbox', label: 'Inbox', icon: '📥', key: '4' },
  { id: 'focus', label: 'Focus', icon: '🎯', key: '5' },
  { id: 'stats', label: 'Stats', icon: '📈', key: '6' },
  { id: 'settings', label: 'Settings', icon: '⚙️', key: '' },
];

export type NewTaskInput = Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'order' | 'deferredCount' | 'subtasks' | 'tags'>> & {
  title: string;
  tags?: string[];
  subtasks?: (Subtask | string)[];
};

const LINGER_MS = 700;

class Store {
  tasks = $state<Task[]>([]);
  courses = $state<Course[]>([]);
  templates = $state<Template[]>([]);
  dayNotes = $state<DayNote[]>([]);
  stats = $state<Stats>(structuredClone(DEFAULT_STATS));
  settings = $state<Settings>(db.loadSettings());
  ready = $state(false);
  loadError = $state<string | null>(null);

  // UI state
  view = $state<View>('today');
  courseFilter = $state<string | null>(null); // for courses view
  focusTaskId = $state<string | null>(null);
  editingTaskId = $state<string | null>(null);
  selectedTaskId = $state<string | null>(null); // keyboard cursor
  selection = $state<Set<string>>(new Set()); // bulk select
  bulkMode = $state(false);
  lingering = $state<Set<string>>(new Set()); // recently completed ids still shown
  combo = $state<ComboState | undefined>(undefined);
  today = $state(todayKey());
  now = $state(new Date());

  // ---------- derived ----------
  openTasks = $derived(this.tasks.filter((t) => !t.completedAt));
  completedTasks = $derived(this.tasks.filter((t) => !!t.completedAt));
  activeCourses = $derived(this.courses.filter((c) => !c.archived));
  streak = $derived(effectiveStreak(this.stats, this.today));
  completedToday = $derived(this.stats.completionsByDay[this.today] ?? 0);
  ringClosedToday = $derived(this.completedToday >= (this.settings.dailyGoal || 3));
  overdueTasks = $derived(
    this.openTasks.filter((t) => isOverdue(t.dueAt, this.now) && !isDueToday(t.dueAt, this.now)).sort(byDueThenOrder),
  );
  dueTodayTasks = $derived(this.openTasks.filter((t) => isDueToday(t.dueAt, this.now)).sort(byFrogThenOrder));
  pinnedTodayTasks = $derived(this.openTasks.filter((t) => !t.dueAt && t.pinnedDay === this.today).sort(byOrder));
  todayTasks = $derived([...this.overdueTasks, ...this.dueTodayTasks, ...this.pinnedTodayTasks]);
  noDateTasks = $derived(this.openTasks.filter((t) => !t.dueAt && t.pinnedDay !== this.today).sort(byOrder));
  todayEstimateMin = $derived(this.todayTasks.reduce((a, t) => a + (t.estimateMin ?? 0), 0));
  weekEstimateMin = $derived(
    this.openTasks
      .filter((t) => t.dueAt && dueKey(t.dueAt) >= this.today && dueKey(t.dueAt) <= addDaysKey(this.today, 6))
      .reduce((a, t) => a + (t.estimateMin ?? 0), 0),
  );
  frogTask = $derived(this.openTasks.find((t) => t.frog && t.frogDate === this.today));
  allTags = $derived(Array.from(new Set(this.tasks.flatMap((t) => t.tags))).sort());

  courseById(id: string | undefined): Course | undefined {
    return id ? this.courses.find((c) => c.id === id) : undefined;
  }

  taskById(id: string | null | undefined): Task | undefined {
    return id ? this.tasks.find((t) => t.id === id) : undefined;
  }

  // ---------- init ----------
  async init(): Promise<void> {
    try {
      const [tasks, courses, templates, stats, notes] = await Promise.all([
        db.getAllTasks(),
        db.getAllCourses(),
        db.getAllTemplates(),
        db.getStats(),
        db.getAllDayNotes(),
      ]);
      this.tasks = tasks;
      this.courses = courses;
      this.templates = templates;
      this.stats = { ...stats, dailyGoal: this.settings.dailyGoal };
      this.dayNotes = notes;
      if (!this.settings.demoSeeded && tasks.length === 0 && courses.length === 0) {
        const seeded = seedDemoData();
        this.courses = seeded.courses;
        this.tasks = seeded.tasks;
        await Promise.all([...seeded.courses.map((c) => db.putCourse(c)), db.putTasks(seeded.tasks)]);
        this.updateSettings({ demoSeeded: true });
      }
      this.applyTheme();
      configureSounds({ enabled: this.settings.soundsEnabled, pack: this.settings.soundPack });
      await this.archiveOldCompleted();
      this.ready = true;
      this.startClock();
    } catch (e) {
      console.error(e);
      this.loadError = e instanceof Error ? e.message : String(e);
      this.ready = true;
    }
  }

  private clockTimer: ReturnType<typeof setInterval> | undefined;
  startClock(): void {
    if (this.clockTimer) return;
    this.clockTimer = setInterval(() => {
      this.now = new Date();
      const t = todayKey(this.now);
      if (t !== this.today) this.today = t;
    }, 30_000);
  }

  // ---------- settings ----------
  updateSettings(patch: Partial<Settings>): void {
    this.settings = { ...this.settings, ...patch };
    db.saveSettings(this.settings);
    if ('dailyGoal' in patch) {
      this.stats = { ...this.stats, dailyGoal: this.settings.dailyGoal };
      void db.putStats($state.snapshot(this.stats));
    }
    if ('theme' in patch || 'accent' in patch || 'reducedMotion' in patch) this.applyTheme();
    if ('soundsEnabled' in patch || 'soundPack' in patch) {
      configureSounds({ enabled: this.settings.soundsEnabled, pack: this.settings.soundPack });
    }
  }

  applyTheme(): void {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const { theme, accent, reducedMotion } = this.settings;
    root.dataset.theme = theme;
    root.style.setProperty('--accent', accent);
    root.classList.toggle('reduced-motion', reducedMotion);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', accent);
  }

  // ---------- persistence helpers ----------
  private persistTask(task: Task): void {
    db.putTask($state.snapshot(task) as Task).catch((e) => console.error('save failed', e));
    emit('changed', { reason: 'task' });
  }
  private persistTasks(tasks: Task[]): void {
    db.putTasks(tasks.map((t) => $state.snapshot(t) as Task)).catch((e) => console.error('save failed', e));
    emit('changed', { reason: 'tasks' });
  }
  private persistStats(): void {
    db.putStats($state.snapshot(this.stats) as Stats).catch((e) => console.error('save failed', e));
    emit('changed', { reason: 'stats' });
  }

  // ---------- tasks ----------
  private nextOrder(): number {
    return this.tasks.reduce((m, t) => Math.max(m, t.order), 0) + 1;
  }

  addTask(input: NewTaskInput, opts: { undoable?: boolean; silent?: boolean } = {}): Task {
    const now = isoNow();
    const id = uid('t');
    const subtasks: Subtask[] = (input.subtasks ?? []).map((s, i) =>
      typeof s === 'string' ? { id: `${id}_s${i}`, title: s, done: false } : s,
    );
    const task: Task = {
      id,
      title: input.title.trim(),
      notes: input.notes,
      courseId: input.courseId,
      tags: input.tags ?? [],
      priority: input.priority ?? 'normal',
      dueAt: input.dueAt,
      estimateMin: input.estimateMin,
      type: input.type,
      weight: input.weight,
      subtasks,
      recurrence: input.recurrence,
      createdAt: now,
      updatedAt: now,
      order: this.nextOrder(),
      deferredCount: 0,
      pinnedDay: input.pinnedDay,
      templateId: input.templateId,
    };
    this.tasks = [...this.tasks, task];
    this.persistTask(task);
    if (opts.undoable !== false) {
      undo.push(
        { label: `Added “${task.title}”`, undo: () => this.removeTaskInternal(task.id) },
        { toast: !opts.silent, timeout: 3500 },
      );
    }
    return task;
  }

  private removeTaskInternal(id: string): void {
    this.tasks = this.tasks.filter((t) => t.id !== id);
    db.deleteTask(id).catch((e) => console.error(e));
    emit('changed', { reason: 'task' });
  }

  private restoreTaskInternal(task: Task): void {
    if (this.tasks.some((t) => t.id === task.id)) {
      this.tasks = this.tasks.map((t) => (t.id === task.id ? task : t));
    } else {
      this.tasks = [...this.tasks, task];
    }
    this.persistTask(task);
  }

  updateTask(id: string, patch: Partial<Task>, opts: { undoable?: boolean; label?: string } = {}): Task | undefined {
    const prev = this.tasks.find((t) => t.id === id);
    if (!prev) return undefined;
    const snapshot = structuredClone($state.snapshot(prev)) as Task;
    const next: Task = { ...prev, ...patch, updatedAt: isoNow() };
    this.tasks = this.tasks.map((t) => (t.id === id ? next : t));
    this.persistTask(next);
    if (opts.undoable) {
      undo.push({ label: opts.label ?? `Edited “${snapshot.title}”`, undo: () => this.restoreTaskInternal(snapshot) }, { timeout: 4000 });
    }
    return next;
  }

  /** Complete a task: stats, XP, streak, badges, recurrence, undo. */
  completeTask(id: string): void {
    const task = this.tasks.find((t) => t.id === id);
    if (!task || task.completedAt) return;
    const completedAt = new Date();
    const prevTask = structuredClone($state.snapshot(task)) as Task;
    const prevStats = structuredClone($state.snapshot(this.stats)) as Stats;
    const prevCombo = this.combo ? { ...this.combo } : undefined;

    const done: Task = {
      ...task,
      completedAt: completedAt.toISOString(),
      updatedAt: completedAt.toISOString(),
      subtasks: task.subtasks.map((s) => ({ ...s, done: true })),
    };
    const openRemaining = this.openTasks.filter((t) => t.id !== id).length;
    const result = applyCompletion(prevStats, done, completedAt, this.combo, openRemaining);

    // recurrence: spawn next instance (history untouched)
    const spawned = spawnNextInstance(done, completedAt, uid('t'));
    if (spawned) spawned.order = this.nextOrder();

    this.tasks = this.tasks.map((t) => (t.id === id ? done : t)).concat(spawned ? [spawned] : []);
    this.lingering = new Set([...this.lingering, id]);
    setTimeout(() => {
      const s = new Set(this.lingering);
      s.delete(id);
      this.lingering = s;
    }, LINGER_MS);

    this.stats = result.stats;
    this.combo = result.combo;
    this.persistTasks(spawned ? [done, spawned] : [done]);
    this.persistStats();

    if (this.selectedTaskId === id) this.selectedTaskId = null;

    undo.push(
      {
        label: `Completed “${task.title}”`,
        undo: () => {
          this.tasks = this.tasks.filter((t) => !(spawned && t.id === spawned.id)).map((t) => (t.id === id ? prevTask : t));
          if (spawned) db.deleteTask(spawned.id).catch(() => {});
          this.stats = prevStats;
          this.combo = prevCombo;
          this.persistTask(prevTask);
          this.persistStats();
          playSound('undo');
          emit('uncompleted', { task: prevTask });
        },
      },
      { toast: false },
    );

    emit('completed', {
      task: done,
      xp: result.xp,
      leveledUp: result.leveledUp,
      newLevel: result.newLevel,
      ringClosed: result.ringClosed,
      newBadges: result.newBadges,
      streakCurrent: result.stats.streak.current,
      freezeEarned: result.streak.freezeEarned,
    });
    if (result.leveledUp) emit('levelup', { level: result.newLevel });
    for (const b of result.newBadges) emit('badge', { id: b });
    if (result.ringClosed) emit('ringClosed', { day: todayKey(completedAt) });
  }

  /** Re-open a completed task (from a completed list). Does not refund XP; stats stay honest via completion counts. */
  uncompleteTask(id: string): void {
    const task = this.tasks.find((t) => t.id === id);
    if (!task || !task.completedAt) return;
    const prev = structuredClone($state.snapshot(task)) as Task;
    const day = dueKey(task.completedAt);
    const next: Task = { ...task, completedAt: undefined, archived: false, updatedAt: isoNow() };
    this.tasks = this.tasks.map((t) => (t.id === id ? next : t));
    this.persistTask(next);
    const stats = structuredClone($state.snapshot(this.stats)) as Stats;
    stats.completionsByDay[day] = Math.max(0, (stats.completionsByDay[day] ?? 1) - 1);
    stats.totalCompleted = Math.max(0, stats.totalCompleted - 1);
    this.stats = stats;
    this.persistStats();
    undo.push({ label: `Reopened “${task.title}”`, undo: () => this.restoreTaskInternal(prev) });
  }

  deleteTask(id: string): void {
    const task = this.tasks.find((t) => t.id === id);
    if (!task) return;
    const snapshot = structuredClone($state.snapshot(task)) as Task;
    this.removeTaskInternal(id);
    if (this.selectedTaskId === id) this.selectedTaskId = null;
    if (this.focusTaskId === id) this.focusTaskId = null;
    undo.push({ label: `Deleted “${task.title}”`, undo: () => this.restoreTaskInternal(snapshot) }, { kind: 'warn' });
  }

  bulkDelete(ids: string[]): void {
    const snaps = this.tasks.filter((t) => ids.includes(t.id)).map((t) => structuredClone($state.snapshot(t)) as Task);
    if (!snaps.length) return;
    this.tasks = this.tasks.filter((t) => !ids.includes(t.id));
    db.deleteTasks(ids).catch((e) => console.error(e));
    emit('changed', { reason: 'tasks' });
    this.clearSelection();
    undo.push(
      {
        label: `Deleted ${snaps.length} tasks`,
        undo: () => {
          this.tasks = [...this.tasks, ...snaps];
          this.persistTasks(snaps);
        },
      },
      { kind: 'warn' },
    );
  }

  bulkUpdate(ids: string[], patch: Partial<Task>, label: string): void {
    const targets = this.tasks.filter((t) => ids.includes(t.id));
    if (!targets.length) return;
    const snaps = targets.map((t) => structuredClone($state.snapshot(t)) as Task);
    const now = isoNow();
    const updated = targets.map((t) => ({ ...t, ...patch, updatedAt: now }));
    const map = new Map(updated.map((t) => [t.id, t]));
    this.tasks = this.tasks.map((t) => map.get(t.id) ?? t);
    this.persistTasks(updated);
    this.clearSelection();
    undo.push({
      label,
      undo: () => {
        const m = new Map(snaps.map((t) => [t.id, t]));
        this.tasks = this.tasks.map((t) => m.get(t.id) ?? t);
        this.persistTasks(snaps);
      },
    });
  }

  bulkAddTag(ids: string[], tag: string): void {
    const targets = this.tasks.filter((t) => ids.includes(t.id));
    const snaps = targets.map((t) => structuredClone($state.snapshot(t)) as Task);
    const now = isoNow();
    const updated = targets.map((t) => ({ ...t, tags: Array.from(new Set([...t.tags, tag])), updatedAt: now }));
    const map = new Map(updated.map((t) => [t.id, t]));
    this.tasks = this.tasks.map((t) => map.get(t.id) ?? t);
    this.persistTasks(updated);
    this.clearSelection();
    undo.push({
      label: `Tagged ${updated.length} tasks #${tag}`,
      undo: () => {
        const m = new Map(snaps.map((t) => [t.id, t]));
        this.tasks = this.tasks.map((t) => m.get(t.id) ?? t);
        this.persistTasks(snaps);
      },
    });
  }

  /** Snooze: reschedule to a day, keeping the time of day if there was one. */
  snoozeTask(id: string, toKey: string, label = 'Snoozed'): void {
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
  }

  snoozeTomorrow(id: string): void {
    this.snoozeTask(id, addDaysKey(this.today, 1), 'Snoozed to tomorrow');
  }
  snoozeWeekend(id: string): void {
    this.snoozeTask(id, thisWeekendKey(this.now), 'Snoozed to the weekend');
  }
  snoozeNextWeek(id: string): void {
    this.snoozeTask(id, nextWeekKey(this.now, this.settings.weekStart), 'Snoozed to next week');
  }

  rollOverdueToToday(): void {
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
        const m = new Map(snaps.map((t) => [t.id, t]));
        this.tasks = this.tasks.map((t) => m.get(t.id) ?? t);
        this.persistTasks(snaps);
      },
    });
  }

  toggleSubtask(taskId: string, subId: string): void {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) return;
    const subtasks = task.subtasks.map((s) => (s.id === subId ? { ...s, done: !s.done } : s));
    this.updateTask(taskId, { subtasks });
    playSound('tick');
  }

  addSubtask(taskId: string, title: string): void {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task || !title.trim()) return;
    this.updateTask(taskId, { subtasks: [...task.subtasks, { id: uid('s'), title: title.trim(), done: false }] });
  }

  removeSubtask(taskId: string, subId: string): void {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) return;
    this.updateTask(taskId, { subtasks: task.subtasks.filter((s) => s.id !== subId) }, { undoable: true, label: 'Removed subtask' });
  }

  /** Reorder: assign sequential `order` to the given ids (in new order). Other tasks keep theirs. */
  reorder(orderedIds: string[]): void {
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
  }

  /** Move a task to a day (drag between days in Upcoming, drag into Today). */
  moveTaskToDay(id: string, toKey: string | null): void {
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
  }

  pinToToday(id: string): void {
    const task = this.tasks.find((t) => t.id === id);
    if (!task) return;
    this.updateTask(id, { pinnedDay: this.today }, { undoable: true, label: `Added “${task.title}” to Today` });
  }

  setFrog(id: string | null): void {
    const prevFrog = this.frogTask;
    if (prevFrog && prevFrog.id !== id) this.updateTask(prevFrog.id, { frog: false, frogDate: undefined });
    if (id) this.updateTask(id, { frog: true, frogDate: this.today });
  }

  // ---------- selection ----------
  toggleSelect(id: string): void {
    const s = new Set(this.selection);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    this.selection = s;
    if (s.size > 0) this.bulkMode = true;
  }
  selectRange(ids: string[], fromId: string, toId: string): void {
    const a = ids.indexOf(fromId);
    const b = ids.indexOf(toId);
    if (a === -1 || b === -1) return this.toggleSelect(toId);
    const [lo, hi] = a < b ? [a, b] : [b, a];
    const s = new Set(this.selection);
    for (let i = lo; i <= hi; i++) s.add(ids[i]);
    this.selection = s;
    this.bulkMode = true;
  }
  clearSelection(): void {
    this.selection = new Set();
    this.bulkMode = false;
  }

  // ---------- courses ----------
  addCourse(input: { name: string; color: string; emoji?: string }): Course {
    const c: Course = { id: uid('c'), name: input.name.trim(), color: input.color, emoji: input.emoji, archived: false };
    this.courses = [...this.courses, c];
    db.putCourse(c).catch((e) => console.error(e));
    emit('changed', { reason: 'course' });
    return c;
  }
  updateCourse(id: string, patch: Partial<Course>): void {
    const prev = this.courses.find((c) => c.id === id);
    if (!prev) return;
    const next = { ...prev, ...patch };
    this.courses = this.courses.map((c) => (c.id === id ? next : c));
    db.putCourse(next).catch((e) => console.error(e));
    emit('changed', { reason: 'course' });
  }
  deleteCourse(id: string): void {
    const course = this.courses.find((c) => c.id === id);
    if (!course) return;
    const affected = this.tasks.filter((t) => t.courseId === id).map((t) => structuredClone($state.snapshot(t)) as Task);
    this.courses = this.courses.filter((c) => c.id !== id);
    db.deleteCourse(id).catch((e) => console.error(e));
    const now = isoNow();
    const updated = affected.map((t) => ({ ...t, courseId: undefined, updatedAt: now }));
    const map = new Map(updated.map((t) => [t.id, t]));
    this.tasks = this.tasks.map((t) => map.get(t.id) ?? t);
    if (updated.length) this.persistTasks(updated);
    emit('changed', { reason: 'course' });
    if (this.courseFilter === id) this.courseFilter = null;
    undo.push(
      {
        label: `Deleted course “${course.name}”`,
        undo: () => {
          this.courses = [...this.courses, course];
          db.putCourse(course).catch(() => {});
          const m = new Map(affected.map((t) => [t.id, t]));
          this.tasks = this.tasks.map((t) => m.get(t.id) ?? t);
          if (affected.length) this.persistTasks(affected);
        },
      },
      { kind: 'warn' },
    );
  }
  findCourseByName(name: string): Course | undefined {
    const n = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    return this.activeCourses.find((c) => c.name.toLowerCase().replace(/[^a-z0-9]/g, '') === n) ??
      this.activeCourses.find((c) => c.name.toLowerCase().replace(/[^a-z0-9]/g, '').startsWith(n) && n.length >= 3);
  }

  // ---------- templates ----------
  saveTemplate(task: Task, name: string): Template {
    const t: Template = {
      id: uid('tpl'),
      name: name.trim().replace(/\s+/g, '-').toLowerCase(),
      task: {
        title: task.title,
        notes: task.notes,
        courseId: task.courseId,
        tags: [...task.tags],
        priority: task.priority,
        estimateMin: task.estimateMin,
        type: task.type,
        weight: task.weight,
        subtasks: task.subtasks.map((s) => s.title),
      },
    };
    this.templates = [...this.templates.filter((x) => x.name !== t.name), t];
    db.putTemplate(t).catch((e) => console.error(e));
    emit('changed', { reason: 'template' });
    return t;
  }
  deleteTemplate(id: string): void {
    const t = this.templates.find((x) => x.id === id);
    if (!t) return;
    this.templates = this.templates.filter((x) => x.id !== id);
    db.deleteTemplate(id).catch((e) => console.error(e));
    undo.push({
      label: `Deleted template @${t.name}`,
      undo: () => {
        this.templates = [...this.templates, t];
        db.putTemplate(t).catch(() => {});
      },
    });
  }
  findTemplate(name: string): Template | undefined {
    const n = name.toLowerCase();
    return this.templates.find((t) => t.name === n) ?? this.templates.find((t) => t.name.startsWith(n));
  }

  // ---------- day notes ----------
  saveDayNote(date: string, note: string): void {
    const n: DayNote = { date, note };
    this.dayNotes = [...this.dayNotes.filter((x) => x.date !== date), n];
    db.putDayNote(n).catch((e) => console.error(e));
    emit('changed', { reason: 'note' });
  }
  dayNote(date: string): string {
    return this.dayNotes.find((n) => n.date === date)?.note ?? '';
  }

  // ---------- pomodoro ----------
  recordPomodoro(): void {
    const stats = structuredClone($state.snapshot(this.stats)) as Stats;
    stats.pomodorosByDay[this.today] = (stats.pomodorosByDay[this.today] ?? 0) + 1;
    const newBadges = evaluateBadges(stats, { openTasksRemaining: this.openTasks.length, today: this.today });
    stats.badges = [...stats.badges, ...newBadges];
    this.stats = stats;
    this.persistStats();
    emit('pomodoroDone', { day: this.today, count: stats.pomodorosByDay[this.today] });
    for (const b of newBadges) emit('badge', { id: b });
  }

  // ---------- data management ----------
  async archiveOldCompleted(): Promise<void> {
    const days = this.settings.archiveAfterDays;
    if (!days) return;
    const cutoff = daysAgoKey(days, this.now);
    const old = this.tasks.filter((t) => t.completedAt && !t.archived && dueKey(t.completedAt) < cutoff);
    if (!old.length) return;
    const updated = old.map((t) => ({ ...t, archived: true }));
    const map = new Map(updated.map((t) => [t.id, t]));
    this.tasks = this.tasks.map((t) => map.get(t.id) ?? t);
    await db.putTasks(updated.map((t) => $state.snapshot(t) as Task));
  }

  async clearDemoData(): Promise<void> {
    const demoTasks = this.tasks.filter((t) => t.id.startsWith('demo_'));
    const demoCourses = this.courses.filter((c) => c.id.startsWith('demo_'));
    this.tasks = this.tasks.filter((t) => !t.id.startsWith('demo_'));
    this.courses = this.courses.filter((c) => !c.id.startsWith('demo_'));
    await db.deleteTasks(demoTasks.map((t) => t.id));
    await Promise.all(demoCourses.map((c) => db.deleteCourse(c.id)));
    emit('changed', { reason: 'demo' });
    toasts.push({ message: 'Demo data cleared', kind: 'success' });
  }

  hasDemoData(): boolean {
    return this.tasks.some((t) => t.id.startsWith('demo_')) || this.courses.some((c) => c.id.startsWith('demo_'));
  }

  async resetAll(): Promise<void> {
    await db.clearAllData();
    db.clearSettings();
    this.tasks = [];
    this.courses = [];
    this.templates = [];
    this.dayNotes = [];
    this.stats = structuredClone(DEFAULT_STATS);
    this.settings = { ...db.loadSettings(), demoSeeded: true, onboarded: true };
    db.saveSettings(this.settings);
    undo.stack = [];
    emit('changed', { reason: 'reset' });
  }

  /** Load a full dataset (import / sync). */
  async loadBundle(data: { tasks: Task[]; courses: Course[]; templates: Template[]; stats: Stats; dayNotes: DayNote[] }): Promise<void> {
    this.tasks = data.tasks;
    this.courses = data.courses;
    this.templates = data.templates;
    this.stats = { ...structuredClone(DEFAULT_STATS), ...data.stats, dailyGoal: this.settings.dailyGoal };
    this.dayNotes = data.dayNotes;
    await db.replaceAll({
      tasks: data.tasks,
      courses: data.courses,
      templates: data.templates,
      stats: $state.snapshot(this.stats) as Stats,
      dayNotes: data.dayNotes,
    });
  }

  // ---------- navigation ----------
  go(view: View, opts: { courseId?: string | null; taskId?: string } = {}): void {
    this.view = view;
    if (opts.courseId !== undefined) this.courseFilter = opts.courseId;
    if (opts.taskId) this.focusTaskId = opts.taskId;
    this.selectedTaskId = null;
    this.clearSelection();
    emit('navigate', { view });
  }
}

export function byOrder(a: Task, b: Task): number {
  return a.order - b.order;
}

export function byDueThenOrder(a: Task, b: Task): number {
  const ad = a.dueAt ?? '';
  const bd = b.dueAt ?? '';
  if (ad !== bd) return ad < bd ? -1 : 1;
  return a.order - b.order;
}

export function byFrogThenOrder(a: Task, b: Task): number {
  if (!!a.frog !== !!b.frog) return a.frog ? -1 : 1;
  return a.order - b.order;
}

export const PRIORITY_LABEL: Record<Priority, string> = { low: 'Low', normal: 'Normal', high: 'High', urgent: 'Urgent' };

export const store = new Store();
