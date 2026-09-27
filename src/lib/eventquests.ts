// Seasonal event quests: three goals per event, counted over the whole event window (see seasons.ts).
// Kept apart from seasons.ts so the first load (the shop's date checks) doesn't carry them.
import type { Stats, Task } from './types';
import type { SeasonId, EventWindow } from './seasons';

export interface EventContext {
  tasks: Task[];
  stats: Stats;
  window: EventWindow;
}

export interface EventQuest {
  id: string;
  label: string;
  emoji: string;
  goal: number;
  reward: number; // coins
  progress: (c: EventContext) => number;
}

function localDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const inWin = (w: EventWindow, day: string) => day >= w.start && day <= w.end;
const doneIn = (c: EventContext) => c.tasks.filter((t) => t.completedAt && inWin(c.window, localDay(t.completedAt)));
const sumDays = (byDay: Record<string, number>, w: EventWindow) => Object.entries(byDay).reduce((a, [k, n]) => a + (inWin(w, k) ? n : 0), 0);
const ringDays = (c: EventContext) => c.stats.ringDays.filter((d) => inWin(c.window, d)).length;

/** Three quests per event, counted over the whole event window. Coins only for schoolwork, like daily quests. */
export const EVENT_QUESTS: Record<SeasonId, EventQuest[]> = {
  halloween: [
    { id: 'tasks13', label: 'Finish 13 tasks during the event', emoji: '🎃', goal: 13, reward: 40, progress: (c) => doneIn(c).length },
    { id: 'pomodoro', label: 'Finish 5 Pomodoros by candlelight', emoji: '🕯️', goal: 5, reward: 25, progress: (c) => sumDays(c.stats.pomodorosByDay, c.window) },
    { id: 'ring', label: 'Close your daily ring on 3 days', emoji: '🦇', goal: 3, reward: 30, progress: ringDays },
  ],
  winter: [
    { id: 'tasks12', label: 'Finish 12 tasks over the holidays', emoji: '🎁', goal: 12, reward: 40, progress: (c) => doneIn(c).length },
    { id: 'reading', label: 'Finish 2 reading tasks by the fire', emoji: '📖', goal: 2, reward: 20, progress: (c) => doneIn(c).filter((t) => t.type === 'reading').length },
    { id: 'ring', label: 'Close your daily ring on 4 days', emoji: '⛄', goal: 4, reward: 35, progress: ringDays },
  ],
  finals: [
    {
      id: 'exams',
      label: 'Finish 2 exam or quiz tasks',
      emoji: '📝',
      goal: 2,
      reward: 30,
      progress: (c) => doneIn(c).filter((t) => t.type === 'exam' || t.type === 'quiz').length,
    },
    { id: 'pomodoro', label: 'Finish 8 Pomodoros', emoji: '⏰', goal: 8, reward: 35, progress: (c) => sumDays(c.stats.pomodorosByDay, c.window) },
    { id: 'tasks10', label: 'Finish 10 tasks', emoji: '📚', goal: 10, reward: 30, progress: (c) => doneIn(c).length },
  ],
  summer: [
    { id: 'tasks8', label: 'Finish 8 tasks this summer', emoji: '🏖️', goal: 8, reward: 30, progress: (c) => doneIn(c).length },
    { id: 'reading', label: 'Finish 3 summer reading tasks', emoji: '📚', goal: 3, reward: 25, progress: (c) => doneIn(c).filter((t) => t.type === 'reading').length },
    { id: 'ring', label: 'Close your daily ring on 5 days', emoji: '🌊', goal: 5, reward: 35, progress: ringDays },
  ],
};

/** The ledger ref for an event quest claim: one per quest per event window. */
export function eventQuestRef(season: SeasonId, w: EventWindow, questId: string): string {
  return `event:${season}:${w.start}:${questId}`;
}
