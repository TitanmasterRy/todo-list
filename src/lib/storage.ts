import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { ArcadeGame, AttachmentBlob, Card, SchoolSchedule, Course, DayNote, Deck, LedgerEntry, Stats, Task, Template, Tombstone, Settings } from './types';
import { DEFAULT_SETTINGS, DEFAULT_STATS } from './types';

interface TodoDB extends DBSchema {
  tasks: { key: string; value: Task; indexes: { byDue: string; byCourse: string } };
  courses: { key: string; value: Course };
  templates: { key: string; value: Template };
  meta: { key: string; value: unknown };
  dayNotes: { key: string; value: DayNote };
  decks: { key: string; value: Deck };
  cards: { key: string; value: Card; indexes: { byDeck: string } };
  ledger: { key: string; value: LedgerEntry };
  games: { key: string; value: ArcadeGame };
  attachments: { key: string; value: AttachmentBlob; indexes: { byTask: string } };
}

export const DB_NAME = 'homework-todo';
export const DB_VERSION = 4;
const SETTINGS_KEY = 'homework-todo:settings';

let dbPromise: Promise<IDBPDatabase<TodoDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<TodoDB>> {
  if (!dbPromise) {
    dbPromise = openDB<TodoDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const tasks = db.createObjectStore('tasks', { keyPath: 'id' });
          tasks.createIndex('byDue', 'dueAt');
          tasks.createIndex('byCourse', 'courseId');
          db.createObjectStore('courses', { keyPath: 'id' });
          db.createObjectStore('templates', { keyPath: 'id' });
          db.createObjectStore('meta');
          db.createObjectStore('dayNotes', { keyPath: 'date' });
        }
        if (oldVersion < 2) {
          db.createObjectStore('decks', { keyPath: 'id' });
          const cards = db.createObjectStore('cards', { keyPath: 'id' });
          cards.createIndex('byDeck', 'deckId');
        }
        if (oldVersion < 3) {
          db.createObjectStore('ledger', { keyPath: 'id' });
          db.createObjectStore('games', { keyPath: 'id' });
        }
        if (oldVersion < 4) {
          const att = db.createObjectStore('attachments', { keyPath: 'id' });
          att.createIndex('byTask', 'taskId');
        }
      },
    });
  }
  return dbPromise;
}

/** For tests: drop the cached connection so a fresh DB can be opened. */
export function resetDBCache(): void {
  dbPromise = null;
}

// ---------- Tasks ----------
export async function getAllTasks(): Promise<Task[]> {
  const db = await getDB();
  return db.getAll('tasks');
}

export async function putTask(task: Task): Promise<void> {
  const db = await getDB();
  await db.put('tasks', task);
}

export async function putTasks(tasks: Task[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('tasks', 'readwrite');
  await Promise.all([...tasks.map((t) => tx.store.put(t)), tx.done]);
}

export async function deleteTask(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('tasks', id);
}

export async function deleteTasks(ids: string[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('tasks', 'readwrite');
  await Promise.all([...ids.map((id) => tx.store.delete(id)), tx.done]);
}

// ---------- Courses ----------
export async function getAllCourses(): Promise<Course[]> {
  const db = await getDB();
  return db.getAll('courses');
}

export async function putCourse(course: Course): Promise<void> {
  const db = await getDB();
  await db.put('courses', course);
}

export async function deleteCourse(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('courses', id);
}

// ---------- Templates ----------
export async function getAllTemplates(): Promise<Template[]> {
  const db = await getDB();
  return db.getAll('templates');
}

export async function putTemplate(t: Template): Promise<void> {
  const db = await getDB();
  await db.put('templates', t);
}

export async function deleteTemplate(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('templates', id);
}

// ---------- Decks & cards ----------
export async function getAllDecks(): Promise<Deck[]> {
  const db = await getDB();
  return db.getAll('decks');
}
export async function putDeck(d: Deck): Promise<void> {
  const db = await getDB();
  await db.put('decks', d);
}
export async function deleteDeck(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['decks', 'cards'], 'readwrite');
  await tx.objectStore('decks').delete(id);
  const cards = await tx.objectStore('cards').index('byDeck').getAllKeys(id);
  await Promise.all([...cards.map((k) => tx.objectStore('cards').delete(k)), tx.done]);
}
export async function getAllCards(): Promise<Card[]> {
  const db = await getDB();
  return db.getAll('cards');
}
export async function putCards(cards: Card[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('cards', 'readwrite');
  await Promise.all([...cards.map((c) => tx.store.put(c)), tx.done]);
}
export async function deleteCard(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('cards', id);
}

// ---------- Economy ledger ----------
export async function getLedger(): Promise<LedgerEntry[]> {
  const db = await getDB();
  return db.getAll('ledger');
}
export async function putLedgerEntries(entries: LedgerEntry[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('ledger', 'readwrite');
  await Promise.all([...entries.map((e) => tx.store.put(e)), tx.done]);
}

// ---------- Local arcade games (admin panel) ----------
export async function getLocalGames(): Promise<ArcadeGame[]> {
  const db = await getDB();
  return db.getAll('games');
}
export async function putLocalGame(g: ArcadeGame): Promise<void> {
  const db = await getDB();
  await db.put('games', g);
}
export async function deleteLocalGame(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('games', id);
}

// ---------- Tombstones (meta) ----------
export async function getTombstones(): Promise<Tombstone[]> {
  return ((await getMeta<Tombstone[]>('tombstones')) ?? []).filter(Boolean);
}
export async function putTombstones(list: Tombstone[]): Promise<void> {
  await putMeta('tombstones', list);
}

// ---------- Day notes ----------
export async function getAllDayNotes(): Promise<DayNote[]> {
  const db = await getDB();
  return db.getAll('dayNotes');
}

export async function putDayNote(n: DayNote): Promise<void> {
  const db = await getDB();
  await db.put('dayNotes', n);
}

// ---------- Stats (meta) ----------
export async function getStats(): Promise<Stats> {
  const db = await getDB();
  const s = (await db.get('meta', 'stats')) as Partial<Stats> | undefined;
  return { ...structuredClone(DEFAULT_STATS), ...(s ?? {}) };
}

export async function putStats(stats: Stats): Promise<void> {
  const db = await getDB();
  await db.put('meta', stats, 'stats');
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const db = await getDB();
  return (await db.get('meta', key)) as T | undefined;
}

export async function putMeta(key: string, value: unknown): Promise<void> {
  const db = await getDB();
  await db.put('meta', value, key);
}

// ---------- School timetable ----------
export async function getSchedule(): Promise<SchoolSchedule | undefined> {
  return getMeta<SchoolSchedule>('schedule');
}

export async function putSchedule(s: SchoolSchedule): Promise<void> {
  await putMeta('schedule', s);
}

// ---------- Attachments (files on tasks; this device only) ----------
export async function putAttachment(a: AttachmentBlob): Promise<void> {
  const db = await getDB();
  await db.put('attachments', a);
}

export async function getAttachment(id: string): Promise<AttachmentBlob | undefined> {
  const db = await getDB();
  return db.get('attachments', id);
}

export async function deleteAttachments(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const db = await getDB();
  const tx = db.transaction('attachments', 'readwrite');
  await Promise.all([...ids.map((id) => tx.store.delete(id)), tx.done]);
}

/** Every stored file's id and task, without loading the files. */
export async function listAttachments(): Promise<{ id: string; taskId: string }[]> {
  const db = await getDB();
  const out: { id: string; taskId: string }[] = [];
  let cur = await db.transaction('attachments').store.index('byTask').openKeyCursor();
  while (cur) {
    out.push({ id: String(cur.primaryKey), taskId: String(cur.key) });
    cur = await cur.continue();
  }
  return out;
}

// ---------- Wipe ----------
export async function clearAllData(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['tasks', 'courses', 'templates', 'meta', 'dayNotes', 'decks', 'cards', 'ledger', 'games', 'attachments'], 'readwrite');
  await Promise.all([
    tx.objectStore('attachments').clear(),
    tx.objectStore('ledger').clear(),
    tx.objectStore('games').clear(),
    tx.objectStore('tasks').clear(),
    tx.objectStore('courses').clear(),
    tx.objectStore('templates').clear(),
    tx.objectStore('meta').clear(),
    tx.objectStore('dayNotes').clear(),
    tx.objectStore('decks').clear(),
    tx.objectStore('cards').clear(),
    tx.done,
  ]);
}

/** Replace the whole dataset atomically (used by import and Gist sync). */
export async function replaceAll(data: {
  tasks: Task[];
  courses: Course[];
  templates: Template[];
  stats: Stats;
  dayNotes: DayNote[];
  decks?: Deck[];
  cards?: Card[];
  tombstones?: Tombstone[];
  ledger?: LedgerEntry[];
  schedule?: SchoolSchedule;
}): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['tasks', 'courses', 'templates', 'meta', 'dayNotes', 'decks', 'cards', 'ledger'], 'readwrite');
  const ledger = tx.objectStore('ledger');
  const decks = tx.objectStore('decks');
  const cards = tx.objectStore('cards');
  const tasks = tx.objectStore('tasks');
  const courses = tx.objectStore('courses');
  const templates = tx.objectStore('templates');
  const meta = tx.objectStore('meta');
  const notes = tx.objectStore('dayNotes');
  await Promise.all([tasks.clear(), courses.clear(), templates.clear(), notes.clear(), decks.clear(), cards.clear(), ledger.clear()]);
  await Promise.all([
    ...(data.ledger ?? []).map((e) => ledger.put(e)),
    meta.put(data.tombstones ?? [], 'tombstones'),
    data.schedule ? meta.put(data.schedule, 'schedule') : meta.delete('schedule'),
    ...(data.decks ?? []).map((d) => decks.put(d)),
    ...(data.cards ?? []).map((c) => cards.put(c)),
    ...data.tasks.map((t) => tasks.put(t)),
    ...data.courses.map((c) => courses.put(c)),
    ...data.templates.map((t) => templates.put(t)),
    ...data.dayNotes.map((n) => notes.put(n)),
    meta.put(data.stats, 'stats'),
    tx.done,
  ]);
}

// ---------- Settings (localStorage) ----------
export function loadSettings(): Settings {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(SETTINGS_KEY) : null;
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearSettings(): void {
  try {
    localStorage.removeItem(SETTINGS_KEY);
  } catch {
    /* ignore */
  }
}
