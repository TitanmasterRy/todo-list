export type Priority = 'low' | 'normal' | 'high' | 'urgent';

export type TaskType = 'homework' | 'reading' | 'exam' | 'project' | 'quiz' | 'other';

export interface Course {
  // "project" for non-school use
  id: string;
  name: string; // "Calc II"
  color: string; // hex accent
  emoji?: string;
  archived: boolean;
}

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface Recurrence {
  kind: 'daily' | 'weekly' | 'everyNDays' | 'weekdays';
  n?: number; // everyNDays
  days?: number[]; // 0–6 for weekly
  until?: string;
}

export interface Task {
  id: string;
  title: string;
  notes?: string; // markdown
  courseId?: string;
  tags: string[];
  priority: Priority;
  dueAt?: string; // ISO datetime; date-only (YYYY-MM-DD) allowed
  estimateMin?: number;
  type?: TaskType;
  weight?: number; // grade weight %, optional
  subtasks: Subtask[];
  recurrence?: Recurrence;
  createdAt: string;
  completedAt?: string;
  updatedAt: string; // used for last-write-wins sync
  order: number; // manual sort within a view
  deferredCount: number; // times snoozed (feeds weekly review)
  pinnedDay?: string; // no-date task pinned into Today (YYYY-MM-DD)
  frog?: boolean; // "eat the frog" pick for the day
  frogDate?: string; // YYYY-MM-DD the frog pick applies to
  archived?: boolean; // archived completed tasks (kept for stats)
  templateId?: string;
}

export interface Stats {
  xp: number;
  level: number;
  streak: { current: number; best: number; lastDate: string; freezes: number };
  dailyGoal: number; // tasks per day, default 3
  completionsByDay: Record<string, number>; // 'YYYY-MM-DD' -> count
  badges: string[];
  // extras used by the dopamine layer
  earlyCount: number; // completed before due
  examCount: number; // completed exam-type tasks
  totalCompleted: number;
  ringDays: string[]; // last days on which the ring closed (for "Ring x5")
  ringCelebratedDate?: string; // last date the full-screen confetti fired
  pomodorosByDay: Record<string, number>;
  freezeCreditedAt?: number; // streak length when last freeze was credited
}

export interface Template {
  id: string;
  name: string; // used as @name in quick add
  task: Pick<Task, 'title' | 'notes' | 'courseId' | 'tags' | 'priority' | 'estimateMin' | 'type' | 'weight'> & {
    subtasks: string[];
  };
}

export interface DayNote {
  date: string; // YYYY-MM-DD
  note: string;
}

export type Theme = 'dark' | 'light' | 'system';
export type SoundPack = 'soft' | 'click' | 'arcade';

export interface Settings {
  theme: Theme;
  accent: string;
  soundsEnabled: boolean;
  soundPack: SoundPack;
  soundPromptShown: boolean;
  reducedMotion: boolean;
  dailyGoal: number;
  pomodoroWorkMin: number;
  pomodoroBreakMin: number;
  pomodoroLongBreakMin: number;
  weekStart: 0 | 1; // 0 Sunday, 1 Monday
  timeFormat: '12h' | '24h';
  gamification: boolean;
  gistToken: string;
  gistId: string;
  lastExportAt?: string;
  lastSyncAt?: string;
  archiveAfterDays: number; // 0 disables
  onboarded: boolean;
  demoSeeded: boolean;
  lastFrogPromptDate?: string;
  lastRecapDate?: string;
  lastWeeklyReviewDate?: string;
  lastBackupReminderAt?: string;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  accent: '#6c5ce7',
  soundsEnabled: false,
  soundPack: 'soft',
  soundPromptShown: false,
  reducedMotion: false,
  dailyGoal: 3,
  pomodoroWorkMin: 25,
  pomodoroBreakMin: 5,
  pomodoroLongBreakMin: 15,
  weekStart: 1,
  timeFormat: '12h',
  gamification: true,
  gistToken: '',
  gistId: '',
  archiveAfterDays: 90,
  onboarded: false,
  demoSeeded: false,
};

export const DEFAULT_STATS: Stats = {
  xp: 0,
  level: 1,
  streak: { current: 0, best: 0, lastDate: '', freezes: 0 },
  dailyGoal: 3,
  completionsByDay: {},
  badges: [],
  earlyCount: 0,
  examCount: 0,
  totalCompleted: 0,
  ringDays: [],
  pomodorosByDay: {},
};

export interface ExportBundle {
  version: 1;
  exportedAt: string;
  tasks: Task[];
  courses: Course[];
  templates: Template[];
  stats: Stats;
  dayNotes: DayNote[];
  settings?: Partial<Settings>;
}

export const PRIORITIES: Priority[] = ['low', 'normal', 'high', 'urgent'];
export const TASK_TYPES: TaskType[] = ['homework', 'reading', 'exam', 'project', 'quiz', 'other'];
