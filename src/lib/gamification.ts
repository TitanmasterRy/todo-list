import type { BreakRange, Priority, Stats, Task } from './types';
import { addDaysKey, dateKey, diffDays, dueKey, endOfDay, isDateOnly, parseDue, todayKey } from './dates';
import { t as tr } from './i18n/index.svelte';

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
  const labels = { aced: tr('grade.aced'), great: tr('grade.great'), good: tr('grade.good'), ok: tr('grade.graded'), done: tr('grade.graded') };
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
    xp: { xp: gained, tier: clearedAll ? 'great' : 'ok', label: clearedAll ? tr('grade.deckCleared') : tr('grade.studySession') },
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
type CollectibleId =
  | 'c_rocket'
  | 'c_crown'
  | 'c_gem'
  | 'c_fire'
  | 'c_unicorn'
  | 'c_bolt'
  | 'c_cat'
  | 'c_owl'
  | 'c_dragon'
  | 'c_trophy'
  | 'c_alien'
  | 'c_ghost'
  | 't_nightowl'
  | 't_earlybird'
  | 't_grinder'
  | 't_ace';
const collectible = (id: CollectibleId, emoji: string, kind: 'sticker' | 'title') => ({
  id,
  emoji,
  kind,
  get name() {
    return tr(`collect.${id}`);
  },
});
export const COLLECTIBLES: { id: string; name: string; emoji: string; kind: 'sticker' | 'title' }[] = [
  collectible('c_rocket', '🚀', 'sticker'),
  collectible('c_crown', '👑', 'sticker'),
  collectible('c_gem', '💎', 'sticker'),
  collectible('c_fire', '🔥', 'sticker'),
  collectible('c_unicorn', '🦄', 'sticker'),
  collectible('c_bolt', '⚡', 'sticker'),
  collectible('c_cat', '🐱', 'sticker'),
  collectible('c_owl', '🦉', 'sticker'),
  collectible('c_dragon', '🐉', 'sticker'),
  collectible('c_trophy', '🏆', 'sticker'),
  collectible('c_alien', '👽', 'sticker'),
  collectible('c_ghost', '👻', 'sticker'),
  collectible('t_nightowl', '🌙', 'title'),
  collectible('t_earlybird', '🐦', 'title'),
  collectible('t_grinder', '⚙️', 'title'),
  collectible('t_ace', '🅰️', 'title'),
];
/** Pick a collectible not yet owned (deterministic by seed). Returns undefined when everything is collected. */
export function rollCollectible(owned: string[], seed: number): (typeof COLLECTIBLES)[number] | undefined {
  const pool = COLLECTIBLES.filter((c) => !owned.includes(c.id));
  if (!pool.length) return undefined;
  return pool[Math.abs(seed) % pool.length];
}

// ---------- Levels: titles and unlocks ----------
// titles in the app language (level.1 … level.11)
export const LEVEL_TITLES = ['level.1', 'level.2', 'level.3', 'level.4', 'level.5', 'level.6', 'level.7', 'level.8', 'level.9', 'level.10', 'level.11'] as const;

export function levelTitle(level: number): string {
  return tr(LEVEL_TITLES[Math.min(LEVEL_TITLES.length - 1, Math.max(0, level - 1))]);
}

/** Accent colors unlock as you level: the first four are free, then one more every two levels. */
type AccentName = 'violet' | 'blue' | 'green' | 'amber' | 'sky' | 'pink' | 'orange' | 'red' | 'teal' | 'purple' | 'gold';
const accent = (color: string, id: AccentName, level: number) => ({
  color,
  level,
  get name() {
    return tr(`accent.${id}`);
  },
});
export const ACCENT_UNLOCKS: { color: string; name: string; level: number }[] = [
  accent('#6c5ce7', 'violet', 1),
  accent('#3b82f6', 'blue', 1),
  accent('#10b981', 'green', 1),
  accent('#f59e0b', 'amber', 1),
  accent('#0ea5e9', 'sky', 2),
  accent('#ec4899', 'pink', 4),
  accent('#f97316', 'orange', 6),
  accent('#ef4444', 'red', 8),
  accent('#14b8a6', 'teal', 10),
  accent('#a855f7', 'purple', 12),
  accent('#eab308', 'gold', 15),
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
  const gap = diffDays(lastDate, today) - 1 - breakDaysBetween(lastDate, today, stats.breaks); // missed days between lastDate and today
  if (gap <= 0) return current;
  return gap <= freezes ? current : 0;
}

/** Days strictly between a and b (keys, a < b) that fall inside a break. */
export function breakDaysBetween(aKey: string, bKey: string, breaks: BreakRange[] | undefined): number {
  if (!breaks?.length) return 0;
  let n = 0;
  for (let k = addDaysKey(aKey, 1); k < bKey; k = addDaysKey(k, 1)) if (breaks.some((b) => !b.deleted && b.from <= k && k <= b.to)) n++;
  return n;
}

/** The break that covers `day`, if any. */
export function activeBreak(breaks: BreakRange[] | undefined, day: string): BreakRange | undefined {
  return breaks?.find((b) => !b.deleted && b.from <= day && day <= b.to);
}

/** Union of two devices' break lists by id; a removal wins. */
export function mergeBreaks(a: BreakRange[] = [], b: BreakRange[] = []): BreakRange[] {
  const m = new Map<string, BreakRange>();
  for (const x of [...a, ...b]) {
    const prev = m.get(x.id);
    m.set(x.id, prev ? { ...prev, ...x, deleted: prev.deleted || x.deleted || undefined } : x);
  }
  return [...m.values()].sort((x, y) => (x.from < y.from ? -1 : 1));
}

export interface StreakUpdate {
  streak: Stats['streak'];
  freezesUsed: number;
  freezeEarned: boolean;
  broke: boolean;
}

/** Apply a completion on `day` to the streak. Missed days consume freezes automatically. */
export function updateStreak(prev: Stats['streak'], day: string, creditedAt?: number, breaks?: BreakRange[]): StreakUpdate & { creditedAt: number } {
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
    const gap = diffDays(s.lastDate, day) - 1 - breakDaysBetween(s.lastDate, day, breaks);
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

type BadgeId =
  | 'first_task'
  | 'tasks_10'
  | 'tasks_100'
  | 'tasks_1000'
  | 'streak_3'
  | 'streak_7'
  | 'streak_30'
  | 'streak_100'
  | 'inbox_zero'
  | 'ring_5'
  | 'early_bird'
  | 'night_owl'
  | 'exam_slayer'
  | 'marathon'
  | 'aced_5'
  | 'ahead_10'
  | 'perfect_week'
  | 'card_shark'
  | 'lucky'
  | 'synced'
  | 'level_10';
// name and description follow the app language
const badge = (id: BadgeId, emoji: string): BadgeDef => ({
  id,
  emoji,
  get name() {
    return tr(`badge.${id}`);
  },
  get description() {
    return tr(`badge.${id}.desc`);
  },
});

export const BADGES: BadgeDef[] = [
  badge('first_task', '🌱'),
  badge('tasks_10', '🔟'),
  badge('tasks_100', '💯'),
  badge('tasks_1000', '🏔️'),
  badge('streak_3', '🔥'),
  badge('streak_7', '🔥'),
  badge('streak_30', '🌋'),
  badge('streak_100', '☄️'),
  badge('inbox_zero', '📭'),
  badge('ring_5', '⭕'),
  badge('early_bird', '🐦'),
  badge('night_owl', '🦉'),
  badge('exam_slayer', '⚔️'),
  badge('marathon', '🏃'),
  badge('aced_5', '🅰️'),
  badge('ahead_10', '🚀'),
  badge('perfect_week', '🏅'),
  badge('card_shark', '🃏'),
  badge('lucky', '🍀'),
  badge('synced', '🔌'),
  badge('level_10', '🎓'),
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
  const streak = updateStreak(stats.streak, day, stats.freezeCreditedAt, stats.breaks);
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
