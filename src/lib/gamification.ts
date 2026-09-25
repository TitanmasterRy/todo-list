import type { Priority, Stats, Task } from './types';
import { addDaysKey, dateKey, diffDays, dueKey, endOfDay, isDateOnly, parseDue, todayKey } from './dates';

export const CRIT_CHANCE = 0.05;

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
  earlyDays: number; // whole days before the due day (0 = same day but before due)
  earlyMultiplier: number;
  longTask: boolean;
  frog: boolean;
  crit: boolean; // random critical hit (x2)
  powerHour: boolean; // x1.5 during the day's power hour
  comboCount: number;
  comboMultiplier: number;
  total: number;
}

/** Whole days between completion day and due day (negative when late). */
export function daysEarly(task: Pick<Task, 'dueAt'>, completedAt: Date): number | null {
  if (!task.dueAt) return null;
  return diffDays(dateKey(completedAt), dueKey(task.dueAt));
}

/** Tiered early bonus: 3+ days ×1.5, 1–2 days ×1.25, same day but before the deadline ×1.1. */
export function earlyMultiplierFor(task: Pick<Task, 'dueAt'>, completedAt: Date): { early: boolean; earlyDays: number; multiplier: number } {
  if (!completedEarly(task, completedAt)) return { early: false, earlyDays: 0, multiplier: 1 };
  const d = Math.max(0, daysEarly(task, completedAt) ?? 0);
  return { early: true, earlyDays: d, multiplier: d >= 3 ? 1.5 : d >= 1 ? 1.25 : 1.1 };
}

/** Compute XP for completing a task. comboCount = consecutive prior completions in the combo chain (0 = none). rng in [0,1) decides critical hits. */
export function computeXp(task: Task, completedAt: Date, comboCount: number, rng: () => number = Math.random, powerHour = false): XpBreakdown {
  const base = BASE_XP[task.priority] ?? 10;
  const subtaskBonus = 5 * (task.subtasks?.length ?? 0);
  let total = base + subtaskBonus;
  const e = earlyMultiplierFor(task, completedAt);
  const early = e.early;
  total *= e.multiplier;
  const longTask = (task.estimateMin ?? 0) >= 60;
  if (longTask) total *= 1.5;
  const frog = !!task.frog && task.frogDate === dateKey(completedAt);
  if (frog) total *= 2;
  const comboMultiplier = comboMultiplierFor(comboCount);
  total *= comboMultiplier;
  const crit = rng() < CRIT_CHANCE;
  if (crit) total *= 2;
  if (powerHour) total *= 1.5;
  return {
    base,
    subtaskBonus,
    early,
    earlyDays: e.earlyDays,
    earlyMultiplier: e.multiplier,
    longTask,
    frog,
    crit,
    powerHour,
    comboCount,
    comboMultiplier,
    total: Math.round(total),
  };
}

// ---------- Grades ----------
export interface GradeXp {
  xp: number;
  tier: 'aced' | 'great' | 'good' | 'ok' | 'done';
  label: string;
}

/** XP for entering a score: better grades pay more, heavier items pay more. */
export function gradeXp(score: number, weight = 0): GradeXp {
  const tier: GradeXp['tier'] = score >= 95 ? 'aced' : score >= 90 ? 'great' : score >= 80 ? 'good' : score >= 70 ? 'ok' : 'done';
  const base = { aced: 40, great: 30, good: 20, ok: 10, done: 5 }[tier];
  const w = Math.max(0, Math.min(100, weight || 0));
  const labels = { aced: 'Aced it!', great: 'Great grade', good: 'Solid grade', ok: 'Graded', done: 'Graded' };
  return { xp: Math.round(base * (1 + w / 100)), tier, label: labels[tier] };
}

export interface GradeResult {
  stats: Stats;
  xp: GradeXp;
  leveledUp: boolean;
  newLevel: number;
  newBadges: string[];
}

/** Pure: award XP for a score entered on a task (call once per task). */
export function applyGrade(prev: Stats, score: number, weight: number | undefined, today: string, openTasksRemaining: number): GradeResult {
  const stats: Stats = structuredClone(prev);
  const xp = gradeXp(score, weight);
  const prevLevel = levelForXp(stats.xp);
  stats.xp += xp.xp;
  stats.xpByDay = { ...(stats.xpByDay ?? {}), [today]: ((stats.xpByDay ?? {})[today] ?? 0) + xp.xp };
  stats.level = levelForXp(stats.xp);
  if (score >= 95) stats.acedCount = (stats.acedCount ?? 0) + 1;
  const newBadges = evaluateBadges(stats, { openTasksRemaining, today });
  stats.badges = [...stats.badges, ...newBadges];
  return { stats, xp, leveledUp: stats.level > prevLevel, newLevel: stats.level, newBadges };
}

/** Pure: XP for a notecard study session. +2 per correct answer, +10 bonus for clearing every due card. */
export function applyStudySession(prev: Stats, reviewed: number, correct: number, clearedAll: boolean, today: string, openTasksRemaining: number): GradeResult {
  const stats: Stats = structuredClone(prev);
  const gained = correct * 2 + (clearedAll && reviewed > 0 ? 10 : 0);
  const prevLevel = levelForXp(stats.xp);
  stats.xp += gained;
  stats.xpByDay = { ...(stats.xpByDay ?? {}), [today]: ((stats.xpByDay ?? {})[today] ?? 0) + gained };
  stats.level = levelForXp(stats.xp);
  stats.cardsReviewed = (stats.cardsReviewed ?? 0) + reviewed;
  const newBadges = evaluateBadges(stats, { openTasksRemaining, today });
  stats.badges = [...stats.badges, ...newBadges];
  return {
    stats,
    xp: { xp: gained, tier: clearedAll ? 'great' : 'ok', label: clearedAll ? 'Deck cleared' : 'Study session' },
    leveledUp: stats.level > prevLevel,
    newLevel: stats.level,
    newBadges,
  };
}

// ---------- Power hour ----------
/** Deterministic "power hour" for a day: one random hour between 15:00 and 21:00 (x1.5 XP). */
export function powerHourFor(day: string): number {
  let h = 0;
  for (const ch of day) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return 15 + (h % 7);
}
export function isPowerHour(now: Date, day: string): boolean {
  return now.getHours() === powerHourFor(day);
}
export const STREAK_MILESTONES = [3, 7, 14, 30, 50, 100, 365];

// ---------- Mystery rewards (cosmetic collection) ----------
export const COLLECTIBLES: { id: string; name: string; emoji: string; kind: 'sticker' | 'title' }[] = [
  { id: 'c_rocket', name: 'Rocket', emoji: '🚀', kind: 'sticker' },
  { id: 'c_crown', name: 'Crown', emoji: '👑', kind: 'sticker' },
  { id: 'c_gem', name: 'Gem', emoji: '💎', kind: 'sticker' },
  { id: 'c_fire', name: 'Inferno', emoji: '🔥', kind: 'sticker' },
  { id: 'c_unicorn', name: 'Unicorn', emoji: '🦄', kind: 'sticker' },
  { id: 'c_bolt', name: 'Bolt', emoji: '⚡', kind: 'sticker' },
  { id: 'c_cat', name: 'Study Cat', emoji: '🐱', kind: 'sticker' },
  { id: 'c_owl', name: 'Wise Owl', emoji: '🦉', kind: 'sticker' },
  { id: 'c_dragon', name: 'Dragon', emoji: '🐉', kind: 'sticker' },
  { id: 'c_trophy', name: 'Trophy', emoji: '🏆', kind: 'sticker' },
  { id: 'c_alien', name: 'Alien', emoji: '👽', kind: 'sticker' },
  { id: 'c_ghost', name: 'Ghost', emoji: '👻', kind: 'sticker' },
  { id: 't_nightowl', name: 'Night Owl', emoji: '🌙', kind: 'title' },
  { id: 't_earlybird', name: 'Early Bird', emoji: '🐦', kind: 'title' },
  { id: 't_grinder', name: 'The Grinder', emoji: '⚙️', kind: 'title' },
  { id: 't_ace', name: 'Ace', emoji: '🅰️', kind: 'title' },
];
/** Pick a collectible not yet owned (deterministic by seed). Returns undefined when everything is collected. */
export function rollCollectible(owned: string[], seed: number): (typeof COLLECTIBLES)[number] | undefined {
  const pool = COLLECTIBLES.filter((c) => !owned.includes(c.id));
  if (!pool.length) return undefined;
  return pool[Math.abs(seed) % pool.length];
}

// ---------- Levels: titles and unlocks ----------
export const LEVEL_TITLES = [
  'Freshman',
  'Note Taker',
  'Deadline Dodger',
  'Page Turner',
  'Problem Solver',
  'Study Machine',
  'Honor Roll',
  'Dean’s List',
  'Scholar',
  'Valedictorian',
  'Legend',
];

export function levelTitle(level: number): string {
  return LEVEL_TITLES[Math.min(LEVEL_TITLES.length - 1, Math.max(0, level - 1))];
}

/** Accent colors unlock as you level: the first four are free, then one more every two levels. */
export const ACCENT_UNLOCKS: { color: string; name: string; level: number }[] = [
  { color: '#6c5ce7', name: 'Violet', level: 1 },
  { color: '#3b82f6', name: 'Blue', level: 1 },
  { color: '#10b981', name: 'Green', level: 1 },
  { color: '#f59e0b', name: 'Amber', level: 1 },
  { color: '#0ea5e9', name: 'Sky', level: 2 },
  { color: '#ec4899', name: 'Pink', level: 4 },
  { color: '#f97316', name: 'Orange', level: 6 },
  { color: '#ef4444', name: 'Red', level: 8 },
  { color: '#14b8a6', name: 'Teal', level: 10 },
  { color: '#a855f7', name: 'Purple', level: 12 },
  { color: '#eab308', name: 'Gold', level: 15 },
];

export function accentUnlockedAt(level: number): typeof ACCENT_UNLOCKS {
  return ACCENT_UNLOCKS.filter((a) => a.level <= level);
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
  { id: 'aced_5', name: 'Aced It', emoji: '🅰️', description: 'Score 95% or better on 5 graded items.' },
  { id: 'ahead_10', name: 'Ahead of the Curve', emoji: '🚀', description: 'Finish 10 tasks three or more days early.' },
  { id: 'perfect_week', name: 'Perfect Week', emoji: '🏅', description: 'Close the daily ring seven days in a row.' },
  { id: 'card_shark', name: 'Card Shark', emoji: '🃏', description: 'Review 100 notecards.' },
  { id: 'lucky', name: 'Lucky', emoji: '🍀', description: 'Land 3 critical hits.' },
  { id: 'synced', name: 'Plugged In', emoji: '🔌', description: 'Sync assignments from Schoology.' },
  { id: 'level_10', name: 'Valedictorian', emoji: '🎓', description: 'Reach level 10.' },
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
  check('aced_5', (stats.acedCount ?? 0) >= 5);
  check('ahead_10', (stats.early3Count ?? 0) >= 10);
  check('perfect_week', ringClosedConsecutive(stats.ringDays, ctx.today, 7));
  check('card_shark', (stats.cardsReviewed ?? 0) >= 100);
  check('lucky', (stats.critCount ?? 0) >= 3);
  check('synced', (stats.syncedCount ?? 0) >= 1);
  check('level_10', levelForXp(stats.xp) >= 10);
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
  rng: () => number = Math.random,
  powerHour = false,
): CompletionResult {
  const stats: Stats = structuredClone(prev);
  const day = dateKey(completedAt);
  const nextCombo = advanceCombo(combo, completedAt.getTime());
  const xp = computeXp(task, completedAt, nextCombo.count, rng, powerHour);
  if (xp.crit) stats.critCount = (stats.critCount ?? 0) + 1;
  if (xp.early && xp.earlyDays >= 3) stats.early3Count = (stats.early3Count ?? 0) + 1;
  const prevLevel = levelForXp(stats.xp);
  stats.xp += xp.total;
  stats.xpByDay = { ...(stats.xpByDay ?? {}), [day]: ((stats.xpByDay ?? {})[day] ?? 0) + xp.total };
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
