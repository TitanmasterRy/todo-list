// Daily quests: three small goals a day, picked from a pool by the date (same on every device),
// progress computed from your real data, coins when you claim them.
import type { Card, Stats, Task } from './types';

export interface QuestContext {
  today: string;
  tasks: Task[];
  stats: Stats;
  cards: Card[];
  dailyGoal: number;
}

export interface QuestDef {
  id: string;
  label: string;
  emoji: string;
  goal: number;
  reward: number; // coins
  progress: (c: QuestContext) => number;
  /** only offered when it can be done (e.g. there are notecards to review) */
  available?: (c: QuestContext) => boolean;
}

const doneToday = (c: QuestContext) => c.tasks.filter((t) => t.completedAt && localDay(t.completedAt) === c.today);
function localDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const QUESTS: QuestDef[] = [
  { id: 'finish3', label: 'Finish 3 tasks', emoji: '✅', goal: 3, reward: 10, progress: (c) => doneToday(c).length },
  { id: 'finish5', label: 'Finish 5 tasks', emoji: '🔥', goal: 5, reward: 18, progress: (c) => doneToday(c).length },
  {
    id: 'early',
    label: 'Finish a task before its due day',
    emoji: '⏩',
    goal: 1,
    reward: 12,
    progress: (c) => doneToday(c).filter((t) => t.dueAt && t.dueAt.slice(0, 10) > c.today).length,
    available: (c) => c.tasks.some((t) => !t.completedAt && t.dueAt && t.dueAt.slice(0, 10) > c.today),
  },
  { id: 'pomodoro', label: 'Finish a Pomodoro', emoji: '🍅', goal: 1, reward: 8, progress: (c) => c.stats.pomodorosByDay[c.today] ?? 0 },
  { id: 'pomodoro3', label: 'Finish 3 Pomodoros', emoji: '⏱️', goal: 3, reward: 15, progress: (c) => c.stats.pomodorosByDay[c.today] ?? 0 },
  {
    id: 'cards',
    label: 'Review 10 notecards',
    emoji: '🃏',
    goal: 10,
    reward: 10,
    progress: (c) => c.cards.filter((k) => k.reps > 0 && localDay(k.updatedAt) === c.today).length,
    available: (c) => c.cards.length >= 10,
  },
  {
    id: 'high',
    label: 'Finish a high-priority task',
    emoji: '❗',
    goal: 1,
    reward: 10,
    progress: (c) => doneToday(c).filter((t) => t.priority === 'high' || t.priority === 'urgent').length,
    available: (c) => c.tasks.some((t) => !t.completedAt && (t.priority === 'high' || t.priority === 'urgent')),
  },
  {
    id: 'reading',
    label: 'Finish a reading task',
    emoji: '📖',
    goal: 1,
    reward: 8,
    progress: (c) => doneToday(c).filter((t) => t.type === 'reading').length,
    available: (c) => c.tasks.some((t) => !t.completedAt && t.type === 'reading'),
  },
  {
    id: 'frog',
    label: 'Eat your frog',
    emoji: '🐸',
    goal: 1,
    reward: 12,
    progress: (c) => doneToday(c).filter((t) => t.frog && t.frogDate === c.today).length,
    available: (c) => c.tasks.some((t) => t.frog && t.frogDate === c.today),
  },
  { id: 'ring', label: 'Close your daily ring', emoji: '⭕', goal: 1, reward: 10, progress: (c) => ((c.stats.completionsByDay[c.today] ?? 0) >= c.dailyGoal ? 1 : 0) },
  {
    id: 'overdue',
    label: 'Clear an overdue task',
    emoji: '🧹',
    goal: 1,
    reward: 12,
    progress: (c) => doneToday(c).filter((t) => t.dueAt && t.dueAt.slice(0, 10) < c.today).length,
    available: (c) => c.tasks.some((t) => !t.completedAt && t.dueAt && t.dueAt.slice(0, 10) < c.today),
  },
];

export const ALL_DONE_BONUS = 15;

/** Deterministic hash of a string to [0, 1). */
export function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 100000) / 100000;
}

/** Today's three quests: the same set on every device for the same day and data. Never both "finish 3" and "finish 5". */
export function questsFor(c: QuestContext): QuestDef[] {
  const pool = QUESTS.filter((q) => !q.available || q.available(c));
  const ranked = pool.map((q) => ({ q, r: hash01(`${c.today}:${q.id}`) })).sort((a, b) => a.r - b.r);
  const out: QuestDef[] = [];
  for (const { q } of ranked) {
    if (out.length === 3) break;
    if ((q.id === 'finish3' && out.some((x) => x.id === 'finish5')) || (q.id === 'finish5' && out.some((x) => x.id === 'finish3'))) continue;
    if ((q.id === 'pomodoro' && out.some((x) => x.id === 'pomodoro3')) || (q.id === 'pomodoro3' && out.some((x) => x.id === 'pomodoro'))) continue;
    out.push(q);
  }
  return out;
}

// ---------- deal of the day ----------
export const DEAL_ITEMS = [
  'booster',
  'freeze',
  'voucher-5',
  'chips-550',
  'frame-gold',
  'frame-neon',
  'frame-leaf',
  'confetti-coins',
  'confetti-hearts',
  'confetti-stars',
  'confetti-books',
  'title-night-owl',
  'title-speedrunner',
];
export const DEAL_DISCOUNT = 0.3;

/** One shop item at 30% off, rotating daily. Items you already own (unique) are skipped. */
export function dealOfDay(day: string, owned: (id: string) => boolean): string | undefined {
  const choices = DEAL_ITEMS.filter((id) => !owned(id));
  if (!choices.length) return undefined;
  return choices[Math.floor(hash01(`deal:${day}`) * choices.length)];
}
