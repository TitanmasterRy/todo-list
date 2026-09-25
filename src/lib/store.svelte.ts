import * as db from './storage';
import type { BreakRange, Card, Course, DayNote, Deck, ExportBundle, LedgerEntry, Priority, Settings, Stats, Subtask, Task, Template, Tombstone, TombstoneKind } from './types';
import { buildBundle, mergeTombstones, TRASH_DAYS, type BundleData } from './backup';
import { DEFAULT_STATS } from './types';
import { uid } from './id';
import { addDaysKey, dueKey, isDueToday, isOverdue, isoNow, todayKey, daysAgoKey, startOfWeekKey as startOfWeekKeyFn } from './dates';
import { activeBreak, applyCompletion, applyGrade, effectiveStreak, isPowerHour, rollCollectible, STREAK_MILESTONES, type ComboState } from './gamification';
import { applyThemePack } from './themes';
import { applyFont } from './fonts';
import { autoDescribe } from './autodescribe';
import { spawnNextInstance } from './recurrence';
import { undo } from './undo.svelte';
import { emit } from './events';
import { toasts } from './toast.svelte';
import { configureSounds, playSound } from './sounds';
import { planningMethods } from './store/planning.svelte';
import { organizeMethods } from './store/organize.svelte';
import { notecardsMethods } from './store/notecards.svelte';
import { externalMethods } from './store/external.svelte';
import { attachmentMethods } from './store/attachments.svelte';
import { afterSettingsChange, resetVault, settingsForDisk } from './secrets.svelte';

export type View = 'today' | 'upcoming' | 'courses' | 'inbox' | 'focus' | 'stats' | 'tools' | 'schoology' | 'play' | 'settings';
export const VIEWS: { id: View; label: string; icon: string; key: string }[] = [
  { id: 'today', label: 'Today', icon: '☀️', key: '1' },
  { id: 'upcoming', label: 'Upcoming', icon: '📅', key: '2' },
  { id: 'courses', label: 'Courses', icon: '📚', key: '3' },
  { id: 'inbox', label: 'Inbox', icon: '📥', key: '4' },
  { id: 'focus', label: 'Focus', icon: '🎯', key: '5' },
  { id: 'stats', label: 'Stats', icon: '📈', key: '6' },
  { id: 'tools', label: 'Tools', icon: '🧰', key: '7' },
  { id: 'schoology', label: 'Schoology', icon: '🔄', key: '8' },
  { id: 'play', label: 'Play', icon: '🎮', key: '9' },
  { id: 'settings', label: 'Settings', icon: '⚙️', key: '' },
];

export type NewTaskInput = Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'order' | 'deferredCount' | 'subtasks' | 'tags'>> & {
  title: string;
  tags?: string[];
  subtasks?: (Subtask | string)[];
};

const LINGER_MS = 700;

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging -- method groups are merged in below
export class Store {
  tasks = $state<Task[]>([]);
  courses = $state<Course[]>([]);
  templates = $state<Template[]>([]);
  decks = $state<Deck[]>([]);
  cards = $state<Card[]>([]);
  dayNotes = $state<DayNote[]>([]);
  tombstones = $state<Tombstone[]>([]);
  ledger = $state<LedgerEntry[]>([]);
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
  overdueTasks = $derived(this.openTasks.filter((t) => isOverdue(t.dueAt, this.now) && !isDueToday(t.dueAt, this.now)).sort(byDueThenOrder));
  dueTodayTasks = $derived(this.openTasks.filter((t) => isDueToday(t.dueAt, this.now)).sort(byFrogThenOrder));
  /** No-date tasks dragged into Today, plus dated tasks planned for today via the planner (deadline untouched). */
  pinnedTodayTasks = $derived(
    this.openTasks.filter((t) => t.pinnedDay === this.today && (!t.dueAt || (!isDueToday(t.dueAt, this.now) && !isOverdue(t.dueAt, this.now)))).sort(byOrder),
  );
  todayTasks = $derived([...this.overdueTasks, ...this.dueTodayTasks, ...this.pinnedTodayTasks]);
  noDateTasks = $derived(this.openTasks.filter((t) => !t.dueAt && t.pinnedDay !== this.today).sort(byOrder));
  todayEstimateMin = $derived(this.todayTasks.reduce((a, t) => a + (t.estimateMin ?? 0), 0));
  weekEstimateMin = $derived(
    this.openTasks.filter((t) => t.dueAt && dueKey(t.dueAt) >= this.today && dueKey(t.dueAt) <= addDaysKey(this.today, 6)).reduce((a, t) => a + (t.estimateMin ?? 0), 0),
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
      const [tasks, courses, templates, stats, notes, decks, cards, tombstones, ledger] = await Promise.all([
        db.getAllTasks(),
        db.getAllCourses(),
        db.getAllTemplates(),
        db.getStats(),
        db.getAllDayNotes(),
        db.getAllDecks(),
        db.getAllCards(),
        db.getTombstones(),
        db.getLedger(),
      ]);
      this.tombstones = mergeTombstones(tombstones, [], this.now);
      if (this.tombstones.length !== tombstones.length) void db.putTombstones($state.snapshot(this.tombstones) as Tombstone[]);
      this.ledger = ledger.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
      this.tasks = tasks;
      this.courses = courses;
      this.templates = templates;
      this.decks = decks;
      this.cards = cards;
      this.stats = { ...stats, dailyGoal: this.settings.dailyGoal };
      this.dayNotes = notes;
      this.applyTheme();
      configureSounds({ enabled: this.settings.soundsEnabled, pack: this.settings.soundPack });
      await this.archiveOldCompleted();
      this.ready = true;
      this.startClock();
      // tidy up files left behind by tasks deleted for good (on this or another device)
      setTimeout(() => void this.collectAttachmentGarbage(), 5000);
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
    // with the key lock on, secrets are blanked here and kept encrypted in the vault instead
    db.saveSettings(settingsForDisk(this.settings));
    afterSettingsChange(patch);
    if ('dailyGoal' in patch) {
      this.stats = { ...this.stats, dailyGoal: this.settings.dailyGoal };
      void db.putStats($state.snapshot(this.stats));
    }
    if ('theme' in patch || 'accent' in patch || 'reducedMotion' in patch || 'themePack' in patch || 'highContrast' in patch || 'fontChoice' in patch || 'textScale' in patch)
      this.applyTheme();
    if ('soundsEnabled' in patch || 'soundPack' in patch) {
      configureSounds({ enabled: this.settings.soundsEnabled, pack: this.settings.soundPack });
    }
  }

  applyTheme(): void {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const { theme, accent, reducedMotion, themePack } = this.settings;
    root.dataset.theme = theme;
    const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    applyThemePack(themePack, dark, accent);
    root.classList.toggle('reduced-motion', reducedMotion);
    root.classList.toggle('high-contrast', !!this.settings.highContrast);
    // sizes are in px throughout, so scale with zoom (like browser zoom, but only for this app)
    root.style.zoom = this.settings.textScale && this.settings.textScale !== 100 ? String(this.settings.textScale / 100) : '';
    void applyFont(this.settings.fontChoice ?? 'system');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', accent);
  }

  // ---------- persistence helpers ----------
  /** @internal */
  persistTask(task: Task): void {
    db.putTask($state.snapshot(task) as Task).catch((e) => console.error('save failed', e));
    emit('changed', { reason: 'task' });
  }
  /** @internal */
  persistTasks(tasks: Task[]): void {
    db.putTasks(tasks.map((t) => $state.snapshot(t) as Task)).catch((e) => console.error('save failed', e));
    emit('changed', { reason: 'tasks' });
  }
  /** @internal */
  persistStats(): void {
    db.putStats($state.snapshot(this.stats) as Stats).catch((e) => console.error('save failed', e));
    emit('changed', { reason: 'stats' });
  }

  // ---------- deletions (tombstones + trash) ----------
  /** Record deletions so sync removes them on other devices too. Task snapshots go to the trash. */
  /** @internal */
  bury(kind: TombstoneKind, ids: string[], snapshots: Task[] = []): void {
    if (!ids.length) return;
    const at = isoNow();
    const snap = new Map(snapshots.map((t) => [t.id, t]));
    const set = new Set(ids);
    this.tombstones = [
      ...this.tombstones.filter((t) => !(t.kind === kind && set.has(t.id))),
      ...ids.map((id) => ({ kind, id, deletedAt: at, ...(snap.has(id) ? { task: snap.get(id) } : {}) })),
    ];
    this.persistTombstones();
  }
  /** Forget deletions (undo / restore). The restored item also gets a fresh updatedAt so it outranks the tombstone elsewhere. */
  /** @internal */
  unbury(kind: TombstoneKind, ids: string[]): void {
    const set = new Set(ids);
    const next = this.tombstones.filter((t) => !(t.kind === kind && set.has(t.id)));
    if (next.length === this.tombstones.length) return;
    this.tombstones = next;
    this.persistTombstones();
  }
  /** @internal */
  persistTombstones(): void {
    db.putTombstones($state.snapshot(this.tombstones) as Tombstone[]).catch((e) => console.error('save failed', e));
    emit('changed', { reason: 'tombstones' });
  }

  /** Deleted tasks still restorable, newest first. */
  trash = $derived.by(() => {
    const cutoff = new Date(this.now.getTime() - TRASH_DAYS * 86_400_000).toISOString();
    return this.tombstones
      .filter((t): t is Tombstone & { task: Task } => t.kind === 'task' && !!t.task && t.deletedAt >= cutoff)
      .sort((a, b) => (a.deletedAt < b.deletedAt ? 1 : -1));
  });

  restoreFromTrash(id: string): void {
    const t = this.trash.find((x) => x.id === id);
    if (!t) return;
    this.restoreTaskInternal(structuredClone($state.snapshot(t.task)) as Task);
    toasts.push({ message: `Restored “${t.task.title}”`, kind: 'success' });
  }

  emptyTrash(): void {
    this.tombstones = this.tombstones.map((t) => (t.task ? { kind: t.kind, id: t.id, deletedAt: t.deletedAt } : t));
    this.persistTombstones();
    void this.collectAttachmentGarbage();
  }

  // ---------- economy ledger ----------
  /** Append ledger entries (earn / spend). Entries are never edited; reversals are new entries. */
  addLedger(entries: Omit<LedgerEntry, 'id' | 'at'>[]): LedgerEntry[] {
    const at = isoNow();
    const made = entries.filter((e) => e.amount !== 0).map((e) => ({ ...e, id: uid('l'), at }));
    if (!made.length) return [];
    this.ledger = [...this.ledger, ...made];
    db.putLedgerEntries(made).catch((e) => console.error('save failed', e));
    emit('changed', { reason: 'ledger' });
    return made;
  }

  /** Grant a streak freeze (shop). Returns false when already at the cap. */
  addStreakFreeze(max: number): boolean {
    if (this.stats.streak.freezes >= max) return false;
    this.stats = { ...this.stats, streak: { ...this.stats.streak, freezes: this.stats.streak.freezes + 1 } };
    this.persistStats();
    return true;
  }

  // ---------- break mode ----------
  /** The school break covering today, if any (streak paused). */
  currentBreak = $derived(activeBreak(this.stats.breaks, this.today));

  addBreak(from: string, to: string, name?: string): BreakRange | undefined {
    if (!from || !to) return undefined;
    const b: BreakRange = { id: uid('brk'), from: from <= to ? from : to, to: from <= to ? to : from, name: name?.trim().slice(0, 40) || undefined };
    this.stats = { ...this.stats, breaks: [...(this.stats.breaks ?? []), b] };
    this.persistStats();
    return b;
  }

  removeBreak(id: string): void {
    this.stats = { ...this.stats, breaks: (this.stats.breaks ?? []).map((b) => (b.id === id ? { ...b, deleted: true } : b)) };
    this.persistStats();
  }

  // ---------- bundle ----------
  /** Plain (non-reactive) copy of everything that export, backup and sync carry. */
  snapshotBundle(): ExportBundle {
    return buildBundle(this.snapshotData());
  }
  /** @internal */
  snapshotData(): BundleData {
    return {
      tasks: $state.snapshot(this.tasks) as Task[],
      courses: $state.snapshot(this.courses) as Course[],
      templates: $state.snapshot(this.templates) as Template[],
      stats: $state.snapshot(this.stats) as Stats,
      dayNotes: $state.snapshot(this.dayNotes) as DayNote[],
      decks: $state.snapshot(this.decks) as Deck[],
      cards: $state.snapshot(this.cards) as Card[],
      tombstones: $state.snapshot(this.tombstones) as Tombstone[],
      ledger: $state.snapshot(this.ledger) as LedgerEntry[],
    };
  }

  // ---------- tasks ----------
  /** @internal */
  nextOrder(): number {
    return this.tasks.reduce((m, t) => Math.max(m, t.order), 0) + 1;
  }

  addTask(input: NewTaskInput, opts: { undoable?: boolean; silent?: boolean; describe?: boolean } = {}): Task {
    const now = isoNow();
    const id = uid('t');
    // Auto-describe: fill in a plan, steps and an estimate when the task arrives bare.
    let described = false;
    if ((opts.describe ?? this.settings.autoDescribe) && !input.notes && !input.subtasks?.length && !input.templateId && input.title.trim()) {
      const d = autoDescribe(input.title, { courseName: this.courseById(input.courseId)?.name, type: input.type, estimateMin: input.estimateMin });
      input = {
        ...input,
        notes: d.notes,
        subtasks: d.subtasks,
        estimateMin: input.estimateMin ?? d.estimateMin,
        type: input.type ?? d.type,
        tags: Array.from(new Set([...(input.tags ?? []), ...d.tags])),
      };
      described = true;
    }
    const subtasks: Subtask[] = (input.subtasks ?? []).map((s, i) => (typeof s === 'string' ? { id: `${id}_s${i}`, title: s, done: false } : s));
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
      autoDescribed: described || undefined,
      blockedBy: input.blockedBy?.length ? input.blockedBy : undefined,
      deckId: input.deckId,
      parentId: input.parentId,
    };
    this.tasks = [...this.tasks, task];
    this.persistTask(task);
    if (opts.undoable !== false) {
      undo.push(
        { label: `Added “${task.title}”`, undo: () => this.removeTaskInternal(task.id) },
        { toast: !opts.silent, timeout: 3500, detail: described ? `Planned: ${task.subtasks.length} steps · ~${task.estimateMin} min` : undefined },
      );
    }
    return task;
  }

  /** Add several tasks at once (one per line) with a single undo. */
  addTasks(inputs: NewTaskInput[]): Task[] {
    const created = inputs.filter((i) => i.title.trim()).map((i) => this.addTask(i, { undoable: false }));
    if (created.length) {
      undo.push({
        label: `Added ${created.length} tasks`,
        undo: () => {
          const ids = new Set(created.map((t) => t.id));
          this.tasks = this.tasks.filter((t) => !ids.has(t.id));
          db.deleteTasks([...ids]).catch(() => {});
          this.bury('task', [...ids]);
          emit('changed', { reason: 'tasks' });
        },
      });
    }
    return created;
  }

  /** @internal */
  removeTaskInternal(id: string, toTrash = false): void {
    const snap = toTrash ? this.tasks.find((t) => t.id === id) : undefined;
    this.tasks = this.tasks.filter((t) => t.id !== id);
    db.deleteTask(id).catch((e) => console.error(e));
    this.bury('task', [id], snap ? [structuredClone($state.snapshot(snap)) as Task] : []);
    emit('changed', { reason: 'task' });
  }

  /** @internal */
  restoreTaskInternal(task: Task): void {
    // a fresh updatedAt makes the restored version win over older copies (and tombstones) on other devices
    task = { ...task, updatedAt: isoNow() };
    this.unbury('task', [task.id]);
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
    // First score entered on a task pays grade XP (once per task).
    const gradeNow = this.settings.gamification && typeof patch.score === 'number' && !prev.gradedXpAt && typeof prev.score !== 'number';
    if (gradeNow) next.gradedXpAt = next.updatedAt;
    this.tasks = this.tasks.map((t) => (t.id === id ? next : t));
    this.persistTask(next);
    if (gradeNow) {
      const r = applyGrade($state.snapshot(this.stats) as Stats, patch.score!, next.weight, this.today, this.openTasks.length);
      this.stats = r.stats;
      this.persistStats();
      emit('graded', { task: next, xp: r.xp.xp, label: r.xp.label, tier: r.xp.tier, leveledUp: r.leveledUp, newLevel: r.newLevel, newBadges: r.newBadges });
      if (r.leveledUp) emit('levelup', { level: r.newLevel });
      for (const b of r.newBadges) emit('badge', { id: b });
    }
    if (opts.undoable) {
      undo.push({ label: opts.label ?? `Edited “${snapshot.title}”`, undo: () => this.restoreTaskInternal(snapshot) }, { timeout: 4000 });
    }
    return next;
  }

  /** Complete a task: stats, XP, streak, badges, recurrence, undo. */
  completeTask(id: string): void {
    if (this.tasks.find((t) => t.id === id)?.timerStartedAt) this.stopTimer(id);
    const task = this.tasks.find((t) => t.id === id);
    if (!task || task.completedAt) return;
    const completedAt = new Date();
    const prevTask = structuredClone($state.snapshot(task)) as Task;
    const prevStats = structuredClone($state.snapshot(this.stats)) as Stats;
    const prevCombo = this.combo ? { ...this.combo } : undefined;

    const done: Task = {
      ...structuredClone(prevTask),
      completedAt: completedAt.toISOString(),
      updatedAt: completedAt.toISOString(),
      subtasks: prevTask.subtasks.map((s) => ({ ...s, done: true })),
    };
    const openRemaining = this.openTasks.filter((t) => t.id !== id).length;
    const powerHour = this.settings.gamification && this.settings.powerHourEnabled && isPowerHour(completedAt, todayKey(completedAt));
    const result = applyCompletion(prevStats, done, completedAt, this.combo, openRemaining, Math.random, powerHour);
    const prevStreak = prevStats.streak.current;
    const milestone = STREAK_MILESTONES.includes(result.stats.streak.current) && result.stats.streak.current !== prevStreak ? result.stats.streak.current : 0;

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
          // fresh updatedAt so sync treats the undo as the latest edit
          const reopened = { ...prevTask, updatedAt: isoNow() };
          this.tasks = this.tasks.filter((t) => !(spawned && t.id === spawned.id)).map((t) => (t.id === id ? reopened : t));
          if (spawned) {
            db.deleteTask(spawned.id).catch(() => {});
            this.bury('task', [spawned.id]);
          }
          this.stats = prevStats;
          this.combo = prevCombo;
          this.persistTask(reopened);
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
    if (result.ringClosed) {
      emit('ringClosed', { day: todayKey(completedAt) });
      // mystery reward: a collectible for closing the ring
      const c = rollCollectible(this.settings.collection, completedAt.getTime());
      if (c && this.settings.gamification) {
        this.updateSettings({ collection: [...this.settings.collection, c.id] });
        emit('collectible', { id: c.id, name: c.name, emoji: c.emoji, kind: c.kind });
      }
    }
    if (milestone) emit('streakMilestone', { days: milestone });
  }

  duplicateTask(id: string): Task | undefined {
    const t = this.tasks.find((x) => x.id === id);
    if (!t) return undefined;
    const snap = structuredClone($state.snapshot(t)) as Task;
    return this.addTask(
      {
        title: snap.title,
        notes: snap.notes,
        courseId: snap.courseId,
        tags: [...snap.tags],
        priority: snap.priority,
        dueAt: snap.dueAt,
        estimateMin: snap.estimateMin,
        type: snap.type,
        weight: snap.weight,
        subtasks: snap.subtasks.map((s) => s.title),
        recurrence: snap.recurrence,
      },
      { describe: false },
    );
  }

  /** XP earned since the start of the current week (from completion days × approximate). Tracked exactly via xpByDay. */
  weeklyXp = $derived.by(() => {
    const start = startOfWeekKeyFn(this.today, this.settings.weekStart);
    let sum = 0;
    for (const [k, v] of Object.entries(this.stats.xpByDay ?? {})) if (k >= start) sum += v;
    return sum;
  });

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
    if (task.externalId && !this.settings.schoologyIgnored.includes(task.externalId)) {
      this.updateSettings({ schoologyIgnored: [...this.settings.schoologyIgnored, task.externalId] });
    }
    this.removeTaskInternal(id, true);
    if (this.selectedTaskId === id) this.selectedTaskId = null;
    if (this.focusTaskId === id) this.focusTaskId = null;
    undo.push({ label: `Deleted “${task.title}”`, undo: () => this.restoreTaskInternal(snapshot) }, { kind: 'warn' });
  }

  bulkDelete(ids: string[]): void {
    const snaps = this.tasks.filter((t) => ids.includes(t.id)).map((t) => structuredClone($state.snapshot(t)) as Task);
    if (!snaps.length) return;
    this.tasks = this.tasks.filter((t) => !ids.includes(t.id));
    db.deleteTasks(ids).catch((e) => console.error(e));
    this.bury(
      'task',
      snaps.map((t) => t.id),
      snaps,
    );
    emit('changed', { reason: 'tasks' });
    this.clearSelection();
    undo.push(
      {
        label: `Deleted ${snaps.length} tasks`,
        undo: () => {
          const now = isoNow();
          const back = snaps.map((t) => ({ ...t, updatedAt: now }));
          this.unbury(
            'task',
            back.map((t) => t.id),
          );
          this.tasks = [...this.tasks, ...back];
          this.persistTasks(back);
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
        const now = isoNow();
        const back = snaps.map((t) => ({ ...t, updatedAt: now }));
        const m = new Map(back.map((t) => [t.id, t]));
        this.tasks = this.tasks.map((t) => m.get(t.id) ?? t);
        this.persistTasks(back);
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
        const now = isoNow();
        const back = snaps.map((t) => ({ ...t, updatedAt: now }));
        const m = new Map(back.map((t) => [t.id, t]));
        this.tasks = this.tasks.map((t) => m.get(t.id) ?? t);
        this.persistTasks(back);
      },
    });
  }

  // ---------- dependencies ----------
  /** Map of all tasks by id (for blocker lookups). */
  byId = $derived(new Map(this.tasks.map((t) => [t.id, t])));

  // ---------- time tracking ----------
  runningTimer = $derived(this.tasks.find((t) => t.timerStartedAt && !t.completedAt));

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

  // ---------- external sync (Schoology) ----------
  syncedTasks = $derived(this.tasks.filter((t) => t.source === 'schoology'));

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

  async resetAll(): Promise<void> {
    await db.clearAllData();
    db.clearSettings();
    resetVault();
    this.tasks = [];
    this.courses = [];
    this.templates = [];
    this.decks = [];
    this.cards = [];
    this.dayNotes = [];
    this.tombstones = [];
    this.ledger = [];
    this.stats = structuredClone(DEFAULT_STATS);
    this.settings = { ...db.loadSettings(), onboarded: true };
    db.saveSettings(this.settings);
    undo.stack = [];
    emit('changed', { reason: 'reset' });
  }

  /** Load a full dataset (import / sync). */
  async loadBundle(data: BundleData): Promise<void> {
    this.tombstones = data.tombstones ?? [];
    this.ledger = data.ledger ?? [];
    this.tasks = data.tasks;
    this.courses = data.courses;
    this.templates = data.templates;
    this.decks = data.decks ?? [];
    this.cards = data.cards ?? [];
    this.stats = { ...structuredClone(DEFAULT_STATS), ...data.stats, dailyGoal: this.settings.dailyGoal };
    this.dayNotes = data.dayNotes;
    await db.replaceAll({
      tasks: data.tasks,
      courses: data.courses,
      templates: data.templates,
      stats: $state.snapshot(this.stats) as Stats,
      dayNotes: data.dayNotes,
      decks: data.decks ?? [],
      cards: data.cards ?? [],
      tombstones: data.tombstones ?? [],
      ledger: data.ledger ?? [],
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

type PlanningMethods = typeof planningMethods;
type OrganizeMethods = typeof organizeMethods;
type NotecardMethods = typeof notecardsMethods;
type ExternalMethods = typeof externalMethods;
type AttachmentMethods = typeof attachmentMethods;
// The method groups live in ./store/*; merging them into the class type keeps store.method(...) typed.
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface Store extends PlanningMethods, OrganizeMethods, NotecardMethods, ExternalMethods, AttachmentMethods {}
Object.assign(Store.prototype, planningMethods, organizeMethods, notecardsMethods, externalMethods, attachmentMethods);

export const store = new Store();
