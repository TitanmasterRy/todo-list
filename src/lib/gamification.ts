import type { Priority, Stats, Task } from './types';
import { addDaysKey, dateKey, diffDays, dueKey, endOfDay, isDateOnly, parseDue, todayKey } from './dates';

export const BASE_XP: Record<Priority, number> = { low: 5, normal: 10, high: 20, urgent: 30 };
export const COMBO_WINDOW_MS = 3 * 60 * 1000;
export const MAX_FREEZES = 2;

/** Total XP required to reach level n+1 (i.e. leave level n). Level 1 starts at 0 XP. */
export function xpForLevel(n: number): number {
  if (n <= 0) return 0;
  return Math.round(100 * Math.pow(n, 1.4));
}

export function levelForXp(xp: number): number {
  let n = 1;
  while (xp >= xpForLevel(n)) n++;
  return n;
}

export function levelProgress(xp: number): { level: number; into: number; needed: number; pct: number } {
  const level = levelForXp(xp);
  const floor = xpForLevel(level - 1);
  const ceil = xpForLevel(level);
  const into = xp - floor;
  const needed = ceil - floor;
  return { level, into, needed, pct: Math.max(0, Math.min(1, into / needed)) };
}

/** Was the task finished before it was due? Date-only tasks count if finished by end of that day. */
export function completedEarly(task: Pick<Task, 'dueAt'>, completedAt: Date): boolean {
  if (!task.dueAt) return false;
  if (isDateOnly(task.dueAt)) return completedAt.getTime() <= endOfDay(parseDue(task.dueAt)).getTime();
  return completedAt.getTime() < new Date(task.dueAt).getTime();
}

export interface XpBreakdown {
  base: number;
  subtaskBonus: number;
  early: boolean;
  longTask: boolean;
  frog: boolean;
  comboCount: number;
  comboMultiplier: number;
  total: number;
}

/** Compute XP for completing a task. comboCount = number of consecutive prior completions in the combo chain (0 = none). */
export function computeXp(task: Task, completedAt: Date, comboCount: number): XpBreakdown {
  const base = BASE_XP[task.priority] ?? 10;
  const subtaskBonus = 5 * (task.subtasks?.length ?? 0);
  let total = base + subtaskBonus;
  const early = completedEarly(task, completedAt);
  if (early) total *= 1.25;
  const longTask = (task.estimateMin ?? 0) >= 60;
  if (longTask) total *= 1.5;
  const frog = !!task.frog && task.frogDate === dateKey(completedAt);
  if (frog) total *= 2;
  const comboMultiplier = comboMultiplierFor(comboCount);
  total *= comboMultiplier;
  return { base, subtaskBonus, early, longTask, frog, comboCount, comboMultiplier, total: Math.round(total) };
}

export function comboMultiplierFor(comboCount: number): number {
  return Math.min(2, Math.round((1 + 0.1 * comboCount) * 10) / 10);
}

export interface ComboState {
  count: number; // consecutive completions inside the window
  lastAt: number; // epoch ms
}

export function advanceCombo(prev: ComboState | undefined, now: number): ComboState {
  if (prev && now - prev.lastAt <= COMBO_WINDOW_MS) {
    return { count: prev.count + 1, lastAt: now };
  }
  return { count: 0, lastAt: now };
}

/** The streak the UI should show, accounting for a broken streak that hasn't been re-evaluated yet. */
export function effectiveStreak(stats: Stats, today: string = todayKey()): number {
  const { current, lastDate, freezes } = stats.streak;
  if (!lastDate || current === 0) return 0;
  const gap = diffDays(lastDate, today) - 1; // missed days between lastDate and today
  if (gap <= 0) return current;
  return gap <= freezes ? current : 0;
}

export interface StreakUpdate {
  streak: Stats['streak'];
  freezesUsed: number;
  freezeEarned: boolean;
  broke: boolean;
}

/** Apply a completion on `day` to the streak. Missed days consume freezes automatically. */
export function updateStreak(prev: Stats['streak'], day: string, creditedAt?: number): StreakUpdate & { creditedAt: number } {
  const s = { ...prev };
  let freezesUsed = 0;
  let broke = false;
  let credited = creditedAt ?? 0;
  if (!s.lastDate) {
    s.current = 1;
  } else if (s.lastDate === day) {
    // already counted today
  } else if (day < s.lastDate) {
    // completing in the past (clock skew / import); ignore
  } else {
    const gap = diffDays(s.lastDate, day) - 1;
    if (gap === 0) {
      s.current += 1;
    } else if (gap <= s.freezes) {
      s.freezes -= gap;
      freezesUsed = gap;
      s.current += 1;
    } else {
      s.freezes = 0;
      s.current = 1;
      broke = true;
      credited = 0;
    }
  }
  s.lastDate = s.lastDate && day < s.lastDate ? s.lastDate : day;
  s.best = Math.max(s.best, s.current);
  let freezeEarned = false;
  if (s.current > 0 && s.current % 7 === 0 && credited !== s.current) {
    credited = s.current;
    if (s.freezes < MAX_FREEZES) {
      s.freezes += 1;
      freezeEarned = true;
    }
  }
  return { streak: s, freezesUsed, freezeEarned, broke, creditedAt: credited };
}

// ---------- Badges ----------
export interface BadgeDef {
  id: string;
  name: string;
  emoji: string;
  description: string;
}

export const BADGES: BadgeDef[] = [
  { id: 'first_task', name: 'First Task', emoji: '🌱', description: 'Complete your first task.' },
  { id: 'tasks_10', name: '10 Tasks', emoji: '🔟', description: 'Complete 10 tasks.' },
  { id: 'tasks_100', name: '100 Tasks', emoji: '💯', description: 'Complete 100 tasks.' },
  { id: 'tasks_1000', name: '1000 Tasks', emoji: '🏔️', description: 'Complete 1000 tasks.' },
  { id: 'streak_3', name: '3-Day Streak', emoji: '🔥', description: 'Complete a task three days in a row.' },
  { id: 'streak_7', name: '7-Day Streak', emoji: '🔥', description: 'Complete a task seven days in a row.' },
  { id: 'streak_30', name: '30-Day Streak', emoji: '🌋', description: 'Complete a task thirty days in a row.' },
  { id: 'streak_100', name: '100-Day Streak', emoji: '☄️', description: 'Complete a task a hundred days in a row.' },
  { id: 'inbox_zero', name: 'Inbox Zero', emoji: '📭', description: 'Finish every open task.' },
  { id: 'ring_5', name: 'Ring ×5', emoji: '⭕', description: 'Close the daily goal ring five days in a row.' },
  { id: 'early_bird', name: 'Early Bird', emoji: '🐦', description: 'Complete 10 tasks before they were due.' },
  { id: 'night_owl', name: 'Night Owl', emoji: '🦉', description: 'Complete a task between 11 pm and 4 am.' },
  { id: 'exam_slayer', name: 'Exam Slayer', emoji: '⚔️', description: 'Complete 10 exam tasks.' },
  { id: 'marathon', name: 'Marathon', emoji: '🏃', description: 'Finish 4 pomodoros in one day.' },
];

export function badgeById(id: string): BadgeDef | undefined {
  return BADGES.find((b) => b.id === id);
}

export function ringClosedConsecutive(ringDays: string[], endDay: string, n: number): boolean {
  const set = new Set(ringDays);
  for (let i = 0; i < n; i++) {
    if (!set.has(addDaysKey(endDay, -i))) return false;
  }
  return true;
}

/** Evaluate which badges are newly earned given the current stats + context. */
export function evaluateBadges(stats: Stats, ctx: { openTasksRemaining: number; completedAt?: Date; today: string }): string[] {
  const have = new Set(stats.badges);
  const earned: string[] = [];
  const check = (id: string, cond: boolean) => {
    if (cond && !have.has(id)) earned.push(id);
  };
  const t = stats.totalCompleted;
  check('first_task', t >= 1);
  check('tasks_10', t >= 10);
  check('tasks_100', t >= 100);
  check('tasks_1000', t >= 1000);
  const st = stats.streak.current;
  check('streak_3', st >= 3);
  check('streak_7', st >= 7);
  check('streak_30', st >= 30);
  check('streak_100', st >= 100);
  check('inbox_zero', t >= 1 && ctx.openTasksRemaining === 0);
  check('ring_5', ringClosedConsecutive(stats.ringDays, ctx.today, 5));
  check('early_bird', stats.earlyCount >= 10);
  if (ctx.completedAt) {
    const h = ctx.completedAt.getHours();
    check('night_owl', h >= 23 || h < 4);
  }
  check('exam_slayer', stats.examCount >= 10);
  check('marathon', (stats.pomodorosByDay[ctx.today] ?? 0) >= 4);
  return earned;
}

export interface CompletionResult {
  stats: Stats;
  xp: XpBreakdown;
  leveledUp: boolean;
  newLevel: number;
  ringClosed: boolean; // closed for the first time today with this completion
  newBadges: string[];
  streak: StreakUpdate;
  combo: ComboState;
}

/** Pure: apply a task completion to stats. Returns a new Stats object and what happened. */
export function applyCompletion(
  prev: Stats,
  task: Task,
  completedAt: Date,
  combo: ComboState | undefined,
  openTasksRemaining: number,
): CompletionResult {
  const stats: Stats = structuredClone(prev);
  const day = dateKey(completedAt);
  const nextCombo = advanceCombo(combo, completedAt.getTime());
  const xp = computeXp(task, completedAt, nextCombo.count);
  const prevLevel = levelForXp(stats.xp);
  stats.xp += xp.total;
  stats.level = levelForXp(stats.xp);
  stats.totalCompleted += 1;
  stats.completionsByDay[day] = (stats.completionsByDay[day] ?? 0) + 1;
  if (xp.early) stats.earlyCount += 1;
  if (task.type === 'exam') stats.examCount += 1;
  const streak = updateStreak(stats.streak, day, stats.freezeCreditedAt);
  stats.streak = streak.streak;
  stats.freezeCreditedAt = streak.creditedAt;
  const goal = stats.dailyGoal || 3;
  const countToday = stats.completionsByDay[day];
  let ringClosed = false;
  if (countToday >= goal && !stats.ringDays.includes(day)) {
    stats.ringDays = [...stats.ringDays.slice(-60), day];
    ringClosed = true;
  }
  const newBadges = evaluateBadges(stats, { openTasksRemaining, completedAt, today: day });
  stats.badges = [...stats.badges, ...newBadges];
  return {
    stats,
    xp,
    leveledUp: stats.level > prevLevel,
    newLevel: stats.level,
    ringClosed,
    newBadges,
    streak,
    combo: nextCombo,
  };
}

/** Reverse a completion's effect on counters (used by undo). XP/streak are restored via snapshot, this is a helper for stat recomputation. */
export function recomputeCompletionsByDay(tasks: Task[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of tasks) {
    if (!t.completedAt) continue;
    const k = dateKey(new Date(t.completedAt));
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

export function dueKeyOf(task: Task): string | undefined {
  return task.dueAt ? dueKey(task.dueAt) : undefined;
}
