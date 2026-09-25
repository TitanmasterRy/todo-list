export type Priority = 'low' | 'normal' | 'high' | 'urgent';

export type TaskType = 'homework' | 'reading' | 'exam' | 'project' | 'quiz' | 'other';

export interface Course {
  // "project" for non-school use
  id: string;
  name: string; // "Calc II"
  color: string; // hex accent
  emoji?: string;
  archived: boolean;
  credits?: number; // transcript
  term?: string; // e.g. "Fall 2026"
  finalGrade?: number; // override for the transcript, 0–100
  schoologyName?: string; // course name as it appears in the Schoology feed
  updatedAt?: string; // last-write-wins sync (missing on courses from older versions)
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
  score?: number; // grade earned (0–100 %), optional
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
  source?: 'schoology' | 'gmail' | 'classroom' | 'scan'; // synced/imported from elsewhere
  externalId?: string; // stable id in the external system
  url?: string; // link back to the assignment
  syncedAt?: string;
  gradedXpAt?: string; // when grade XP was awarded (once per task)
  autoDescribed?: boolean;
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
  acedCount: number; // scores >= 95
  early3Count: number; // completed 3+ days early
  cardsReviewed: number;
  critCount: number;
  syncedCount: number;
  xpByDay: Record<string, number>;
}

export interface Template {
  id: string;
  name: string; // used as @name in quick add
  task: Pick<Task, 'title' | 'notes' | 'courseId' | 'tags' | 'priority' | 'estimateMin' | 'type' | 'weight'> & {
    subtasks: string[];
  };
}

export interface Deck {
  id: string;
  name: string;
  courseId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Card {
  id: string;
  deckId: string;
  front: string;
  back: string;
  box: number; // Leitner box 1–5
  due: string; // YYYY-MM-DD
  reps: number;
  lapses: number;
  createdAt: string;
  updatedAt: string;
}

/** A deletion record, so sync can tell "deleted on another device" from "never seen". */
export type TombstoneKind = 'task' | 'course' | 'template' | 'deck' | 'card';
export interface Tombstone {
  kind: TombstoneKind;
  id: string;
  deletedAt: string;
  task?: Task; // snapshot kept for the trash can (tasks only, dropped after TRASH_DAYS)
}

/** Economy: every earn and spend is an append-only ledger entry, so wallets merge across devices by id. */
export type Currency = 'coins' | 'chips' | 'vouchers';
export type LedgerCurrency = Currency | `item:${string}`;
export interface LedgerEntry {
  id: string;
  at: string; // ISO time
  currency: LedgerCurrency;
  amount: number; // positive = earned/bought, negative = spent/used
  reason: string; // 'task', 'ring', 'shop:chips-100', 'casino:slots', 'arcade:snake', ...
  ref?: string; // task id, game id, ...
}

/** A game added by the site admin (games.json) or locally in the admin panel. */
export interface ArcadeGame {
  id: string;
  title: string;
  emoji?: string;
  description?: string;
  src?: string; // HTML file path relative to the site's games/ folder
  url?: string; // external embed link
  html?: string; // uploaded HTML (local admin games only)
  cost: number; // vouchers per play
  minutes?: number; // play time per voucher; unlimited when absent
  theme?: ThemePack;
  tags?: string[];
  local?: boolean; // added in this browser's admin panel
  builtIn?: boolean;
}

export interface DayNote {
  date: string; // YYYY-MM-DD
  note: string;
}

export type Theme = 'dark' | 'light' | 'system';
export type ThemePack = 'classic' | 'sleek' | 'cute' | 'arcade' | 'nature' | 'space' | 'paper';
export type AiProvider = 'anthropic' | 'openai' | 'gemini' | 'groq' | 'openrouter' | 'ollama' | 'custom';
export type SoundPack = 'soft' | 'click' | 'arcade' | 'bubble' | 'chime' | 'synth' | 'paper';

export interface Settings {
  theme: Theme;
  accent: string;
  soundsEnabled: boolean;
  soundPack: SoundPack;
  soundPromptShown: boolean;
  reducedMotion: boolean;
  celebrations: boolean; // confetti and checkbox particle bursts (separate from sounds and motion)
  highContrast: boolean;
  fontChoice: 'system' | 'atkinson' | 'lexend' | 'dyslexic';
  textScale: number; // percent: 100, 112, 125, 140
  dailyGoal: number;
  pomodoroWorkMin: number;
  pomodoroBreakMin: number;
  pomodoroLongBreakMin: number;
  weekStart: 0 | 1; // 0 Sunday, 1 Monday
  timeFormat: '12h' | '24h';
  gamification: boolean;
  accountUrl: string; // Supabase project URL override (else VITE_SUPABASE_URL)
  accountAnonKey: string; // Supabase anon key override (else VITE_SUPABASE_ANON_KEY)
  lastAccountSyncAt?: string;
  gistToken: string;
  gistId: string;
  lastExportAt?: string;
  lastSyncAt?: string;
  archiveAfterDays: number; // 0 disables
  autoDescribe: boolean; // fill notes/subtasks/estimate for new tasks
  schoologyFeedUrl: string;
  schoologyProxy: string; // optional CORS proxy prefix, e.g. https://my-worker.example.workers.dev/?url=
  schoologyAutoCreateCourses: boolean;
  schoologyIgnored: string[]; // externalIds deleted by the user
  lastSchoologySync?: string;
  lastSchoologyError?: string;
  aiApiKey: string; // optional Anthropic API key, stored only in localStorage
  aiModel: string;
  aiDescriptions: boolean; // use AI for auto-descriptions when a key is present
  aiProvider: AiProvider;
  aiKeys: Partial<Record<AiProvider, string>>; // per-provider keys (browser only)
  aiModels: Partial<Record<AiProvider, string>>; // chosen model per provider
  aiBaseUrl: string; // custom OpenAI-compatible endpoint (ollama / lm studio / other)
  aiModelCache: Partial<Record<AiProvider, string[]>>; // live model ids from the provider ("id|free" marks free OpenRouter models)
  weeklyXpGoal: number;
  themePack: ThemePack;
  timerPresets: { label: string; work: number; brk: number }[];
  notifyDueSoon: boolean;
  notifyLeadMin: number;
  notifyMorningDigest: boolean;
  powerHourEnabled: boolean;
  powerHourStart?: number; // hour of the day chosen for today
  powerHourDate?: string;
  collection: string[]; // cosmetic unlock ids earned from mystery rewards
  schoologyMode: 'ics' | 'api';
  schoologyDomain: string; // e.g. https://myschool.schoology.com (optional, for links)
  schoologyKey: string; // API consumer key (from app.schoology.com/api)
  schoologySecret: string;
  schoologyIntervalMin: number;
  schoologyImportGrades: boolean;
  spotifyClientId: string;
  spotifyRefreshToken: string;
  musicEmbedUrl: string;
  googleClientId: string;
  googleSyncEnabled: boolean;
  googleDriveFileId: string;
  lastGoogleSyncAt?: string;
  gmailQuery: string;
  googleClassroomEnabled: boolean;
  gmailIgnored: string[];
  localBackupEnabled: boolean;
  lastLocalBackupAt?: string;
  dailyCapacityMin: number; // planner: minutes of homework you can do per day
  targetGrade: number; // grade calculator default target %
  economyEnabled: boolean; // coins, shop, casino, arcade
  casinoEnabled: boolean;
  casinoBreakMin: number; // remind to take a homework break after N minutes of casino play (0 = off)
  arcadeAdmin: boolean; // show the arcade admin panel in Settings
  equippedTitle?: string; // shop cosmetic ids
  equippedFrame?: string;
  equippedConfetti?: string;
  onboarded: boolean;
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
  celebrations: true,
  highContrast: false,
  fontChoice: 'system',
  textScale: 100,
  dailyGoal: 3,
  pomodoroWorkMin: 25,
  pomodoroBreakMin: 5,
  pomodoroLongBreakMin: 15,
  weekStart: 1,
  timeFormat: '12h',
  gamification: true,
  accountUrl: '',
  accountAnonKey: '',
  gistToken: '',
  gistId: '',
  archiveAfterDays: 90,
  autoDescribe: true,
  schoologyFeedUrl: '',
  schoologyProxy: '',
  schoologyAutoCreateCourses: true,
  schoologyIgnored: [],
  aiApiKey: '',
  aiModel: 'claude-opus-5',
  aiDescriptions: false,
  aiProvider: 'anthropic',
  aiKeys: {},
  aiModels: {},
  aiBaseUrl: '',
  aiModelCache: {},
  weeklyXpGoal: 500,
  themePack: 'classic',
  timerPresets: [
    { label: 'Classic 25/5', work: 25, brk: 5 },
    { label: 'Deep 50/10', work: 50, brk: 10 },
    { label: 'Ultradian 90/20', work: 90, brk: 20 },
    { label: 'Sprint 15/3', work: 15, brk: 3 },
  ],
  notifyDueSoon: false,
  notifyLeadMin: 60,
  notifyMorningDigest: false,
  powerHourEnabled: true,
  collection: [],
  schoologyMode: 'ics',
  schoologyDomain: '',
  schoologyKey: '',
  schoologySecret: '',
  schoologyIntervalMin: 30,
  schoologyImportGrades: true,
  spotifyClientId: '',
  spotifyRefreshToken: '',
  musicEmbedUrl: '',
  googleClientId: '',
  googleSyncEnabled: false,
  googleDriveFileId: '',
  gmailQuery: 'newer_than:30d (assignment OR homework OR due OR quiz OR test OR project)',
  googleClassroomEnabled: true,
  gmailIgnored: [],
  localBackupEnabled: false,
  dailyCapacityMin: 180,
  targetGrade: 90,
  economyEnabled: true,
  casinoEnabled: true,
  casinoBreakMin: 20,
  arcadeAdmin: false,
  onboarded: false,
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
  acedCount: 0,
  early3Count: 0,
  cardsReviewed: 0,
  critCount: 0,
  syncedCount: 0,
  xpByDay: {},
};

export interface ExportBundle {
  version: 1;
  exportedAt: string;
  tasks: Task[];
  courses: Course[];
  templates: Template[];
  stats: Stats;
  dayNotes: DayNote[];
  decks?: Deck[];
  cards?: Card[];
  tombstones?: Tombstone[];
  ledger?: LedgerEntry[];
  settings?: Partial<Settings>;
}

export const PRIORITIES: Priority[] = ['low', 'normal', 'high', 'urgent'];
export const TASK_TYPES: TaskType[] = ['homework', 'reading', 'exam', 'project', 'quiz', 'other'];
